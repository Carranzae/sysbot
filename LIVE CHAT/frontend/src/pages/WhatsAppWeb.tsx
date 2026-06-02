import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, QrCode, CheckCircle, XCircle, Loader2,
  RefreshCw, Smartphone, ShieldCheck, Sparkles, Bot,
  Zap, Ban, WifiOff, AlertTriangle
} from 'lucide-react'
import { apiClient } from '../services/api'
import { useStore } from '../store/useStore'
import { io, Socket } from 'socket.io-client'
import toast from 'react-hot-toast'

// ─── Tipos de estado de la sesión ──────────────────────────────────────────
type SessionStatus = 'idle' | 'loading' | 'connecting' | 'qr' | 'connected' | 'disconnecting' | 'disconnected' | 'error'

export default function WhatsAppWeb() {
  const { currentUser: user } = useStore()

  // ─── Estado principal ───────────────────────────────────────────────────
  const [status, setStatus]         = useState<SessionStatus>('idle')
  const [qr, setQr]                 = useState<string | null>(null)
  const [botEnabled, setBotEnabled] = useState<boolean>(true)
  const [togglingBot, setTogglingBot] = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [qrExpired, setQrExpired]   = useState(false)

  // ─── Estado de vinculación por código ──────────────────────────────────
  const [usePairingCode, setUsePairingCode] = useState<boolean>(false)
  const [pairingPhone, setPairingPhone]     = useState<string>(user?.phone || '')
  const [pairingCode, setPairingCode]       = useState<string | null>(null)

  // ─── Refs para evitar race conditions ──────────────────────────────────
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const socketRef      = useRef<Socket | null>(null)
  const isMounted      = useRef(true)
  const qrTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchInFlight  = useRef(false)   // evitar fetches paralelos

  // ─── Cleanup global ────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      stopPolling()
      if (qrTimerRef.current) clearTimeout(qrTimerRef.current)
    }
  }, [])

  // ─── Helpers de polling ─────────────────────────────────────────────────
  const stopPolling  = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  const startPolling = (fn: () => void, ms = 5000) => {
    stopPolling()
    pollRef.current = setInterval(fn, ms)
  }

  // ─── Fetch de estado (protegido contra race conditions) ─────────────────
  const fetchStatus = useCallback(async () => {
    if (fetchInFlight.current || !isMounted.current) return
    fetchInFlight.current = true
    try {
      const data = await apiClient.getWhatsAppWebStatus()
      if (!isMounted.current) return
      const s = data.status as SessionStatus
      
      // Si el backend dice que ya está conectado, forzar el cambio sin importar el estado local
      if (s === 'connected') {
        setStatus('connected')
        setQr(null)
        setErrorMsg(null)
        stopPolling()
        return
      }

      // Para otros estados, respetar la transición manual (no sobrescribir si estamos operando)
      if (status === 'connecting' || status === 'disconnecting') return
      
      setStatus(s)
      if (s === 'qr') { 
        if (data.qr) {
          setQr(data.qr)
          setPairingCode(null)
        } else if ((data as any).code) {
          setQr(null)
          setPairingCode((data as any).code)
        }
        setQrExpired(false) 
      }
    } catch {
      // silencio: si el backend cae, no romper la UI
    } finally {
      fetchInFlight.current = false
    }
  }, [status])

  // ─── Arranque: fetch inicial + polling lento ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      setStatus('loading')
      await fetchStatus()
      // Si no está conectado, lanzar polling para detectar cuando se conecte
      startPolling(fetchStatus, 6000)
    }
    init()
    apiClient.getWhatsAppBotEnabled()
      .then(d => { if (isMounted.current) setBotEnabled(d.enabled) })
      .catch(() => {})
    return stopPolling
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── WebSocket: QR y ready en tiempo real ───────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const socket = io(import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`, {
      query: { userId: user.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_user_room', user.id)
    })

    socket.on('whatsapp_qr', (payload: { qr: string | null; code?: string }) => {
      if (!isMounted.current) return
      if (payload.qr) {
        setQr(payload.qr)
        setPairingCode(null)
      } else if (payload.code) {
        setQr(null)
        setPairingCode(payload.code)
      }
      setStatus('qr')
      setQrExpired(false)
      // QR expira en 60 segundos si no se escanea
      if (qrTimerRef.current) clearTimeout(qrTimerRef.current)
      qrTimerRef.current = setTimeout(() => {
        if (isMounted.current) setQrExpired(true)
      }, 60000)
    })

    socket.on('whatsapp_code', (payload: { code: string }) => {
      if (!isMounted.current) return
      setQr(null)
      setPairingCode(payload.code)
      setStatus('qr')
      setQrExpired(false)
      if (qrTimerRef.current) clearTimeout(qrTimerRef.current)
      qrTimerRef.current = setTimeout(() => {
        if (isMounted.current) setQrExpired(true)
      }, 60000)
    })

    socket.on('whatsapp_ready', () => {
      if (!isMounted.current) return
      setStatus('connected')
      setQr(null)
      setErrorMsg(null)
      setQrExpired(false)
      stopPolling()
      if (qrTimerRef.current) clearTimeout(qrTimerRef.current)
      toast.success('¡WhatsApp conectado exitosamente! ✅')
    })

    socket.on('whatsapp_status', (payload: { status: string }) => {
      if (!isMounted.current) return
      if (payload.status === 'disconnected') {
        setStatus('disconnected')
        setQr(null)
        startPolling(fetchStatus, 6000) // reanudar polling
      }
    })

    socket.on('disconnect', () => {
      // Socket caído no significa que WhatsApp se cayó — no cambiar status
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Conectar sesión ────────────────────────────────────────────────────
  const handleConnect = async () => {
    if (status === 'connecting' || status === 'connected') return
    setStatus('connecting')
    setQr(null)
    setPairingCode(null)
    setErrorMsg(null)
    setQrExpired(false)
    try {
      const data = await (apiClient as any).request('/api/whatsapp/web/start', {
        method: 'POST',
        body: JSON.stringify({ usePairingCode, phone: pairingPhone })
      })
      if (!isMounted.current) return
      if (data?.qr) {
        setQr(data.qr)
        setPairingCode(null)
        setStatus('qr')
      } else if (data?.code) {
        setQr(null)
        setPairingCode(data.code)
        setStatus('qr')
      } else if (data?.status === 'connected') {
        setStatus('connected')
        stopPolling()
      } else if (data?.status) {
        setStatus(data.status as SessionStatus)
      }
      // Si no recibimos QR inmediato, el socket lo traerá — mantener 'connecting' brevemente
    } catch (err: any) {
      if (!isMounted.current) return
      const msg = err?.message || 'No se pudo iniciar la conexión'
      setErrorMsg(msg)
      setStatus('error')
      toast.error(msg)
    }
  }

  // ─── Desconectar sesión ─────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) return
    setStatus('disconnecting')
    try {
      await apiClient.disconnectWhatsAppWeb()
      if (!isMounted.current) return
      setStatus('disconnected')
      setQr(null)
      toast.success('Sesión cerrada correctamente')
      startPolling(fetchStatus, 6000)
    } catch {
      if (!isMounted.current) return
      toast.error('Error al cerrar la sesión')
      setStatus('connected') // revertir si falla
    }
  }

  // ─── Toggle del bot ─────────────────────────────────────────────────────
  const handleToggleBot = async () => {
    if (togglingBot) return
    setTogglingBot(true)
    const next = !botEnabled
    try {
      await apiClient.setWhatsAppBotEnabled(next)
      if (!isMounted.current) return
      setBotEnabled(next)
      toast[next ? 'success' : 'error'](
        next ? '🤖 Bot ACTIVADO — respondiendo automáticamente' : '🔇 Bot PAUSADO — responderás tú manualmente',
        { icon: next ? '✅' : '⚠️' }
      )
    } catch {
      toast.error('Error al cambiar el estado del bot')
    } finally {
      if (isMounted.current) setTogglingBot(false)
    }
  }

  // ─── Regenerar QR expirado ──────────────────────────────────────────────
  const handleRegenerateQr = () => {
    setQrExpired(false)
    setQr(null)
    handleConnect()
  }

  // ─── Derivar labels del status ──────────────────────────────────────────
  const isLoading = status === 'idle' || status === 'loading' || status === 'connecting'
  const isConnected = status === 'connected'

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 flex items-center space-x-3">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <span>Vincular WhatsApp</span>
          </h1>
          <p className="text-gray-600 font-medium">
            Automatiza tus notificaciones de envío usando tu propio número
          </p>
        </div>

        {/* ─── TOGGLE DEL BOT ─────────────────────────────── */}
        <div className={`rounded-2xl border-2 p-5 transition-all duration-300 ${
          botEnabled && isConnected
            ? 'bg-green-50 border-green-300 shadow-green-100 shadow-lg'
            : 'bg-gray-100 border-gray-300'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-xl ${botEnabled && isConnected ? 'bg-green-500' : 'bg-gray-400'}`}>
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-lg">Bot de Respuesta Automática</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {botEnabled
                    ? '🟢 Activo — La IA responde a tus clientes automáticamente'
                    : '🔴 Pausado — Los mensajes llegan pero tú respondes manualmente'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center space-x-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-full border border-red-200">
                    <Ban className="w-3 h-3" />
                    <span>Grupos: siempre ignorados</span>
                  </span>
                  <span className="inline-flex items-center space-x-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-full border border-red-200">
                    <Ban className="w-3 h-3" />
                    <span>Estados: siempre ignorados</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleBot}
              disabled={togglingBot || !isConnected}
              className={`px-6 py-3 rounded-xl font-black transition-all transform active:scale-95 flex items-center space-x-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                botEnabled
                  ? 'bg-white text-red-600 border-2 border-red-200 hover:bg-red-50'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-green-200'
              }`}
            >
              {togglingBot ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Procesando...</span></>
              ) : botEnabled ? (
                <><Bot className="w-5 h-5" /><span>PAUSAR BOT</span></>
              ) : (
                <><Zap className="w-5 h-5" /><span>ACTIVAR BOT</span></>
              )}
            </button>
          </div>

          {!isConnected && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-medium">
              ⚠️ Debes vincular tu WhatsApp primero para poder activar o desactivar el bot.
            </p>
          )}
        </div>

        {/* ─── QR / STATUS ──────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col items-center justify-center text-center min-h-80">

            {/* ── MÁQUINA DE ESTADOS (if/else — NUNCA dos bloques a la vez) ── */}
            {isLoading && !qr ? (
              /* ① INICIANDO / CONECTANDO */
              <div className="space-y-4 py-12">
                <Loader2 className="w-16 h-16 text-green-500 animate-spin mx-auto" />
                <p className="text-gray-500 font-bold animate-pulse">
                  {status === 'connecting' ? 'Iniciando WhatsApp Web… espera el QR…' : 'Verificando estado de sesión…'}
                </p>
              </div>

            ) : status === 'disconnecting' ? (
              /* ② CERRANDO SESIÓN */
              <div className="space-y-4 py-12">
                <Loader2 className="w-16 h-16 text-orange-400 animate-spin mx-auto" />
                <p className="text-orange-500 font-bold animate-pulse">Cerrando sesión de WhatsApp…</p>
              </div>

            ) : status === 'error' ? (
              /* ③ ERROR */
              <div className="space-y-5 py-10">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-red-700">Error de conexión</h2>
                  <p className="text-gray-500 text-sm mt-1">{errorMsg || 'No se pudo conectar con el servidor'}</p>
                </div>
                <button
                  onClick={handleConnect}
                  className="w-full py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all"
                >
                  Reintentar
                </button>
              </div>

            ) : status === 'qr' && pairingCode && !qrExpired ? (
              /* ④ B: CÓDIGO DE VINCULACIÓN LISTO */
              <div className="space-y-6 w-full max-w-sm">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl border-4 border-indigo-500 shadow-2xl relative">
                  <Smartphone className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-bounce" />
                  
                  {/* CÓDIGO FORMATEADO */}
                  <div className="flex justify-center items-center space-x-1.5 text-center my-4 font-mono font-black text-2xl md:text-3xl text-indigo-900 tracking-wider">
                    {pairingCode.includes('-') ? (
                      pairingCode.split('-').map((block, i) => (
                        <div key={i} className="flex items-center">
                          <span className="bg-white px-3 py-2 rounded-xl shadow-md border border-indigo-100">
                            {block}
                          </span>
                          {i === 0 && <span className="mx-2 text-indigo-400 font-sans">-</span>}
                        </div>
                      ))
                    ) : (
                      <>
                        <span className="bg-white px-3 py-2 rounded-xl shadow-md border border-indigo-100">
                          {pairingCode.slice(0, 4)}
                        </span>
                        <span className="mx-2 text-indigo-400 font-sans">-</span>
                        <span className="bg-white px-3 py-2 rounded-xl shadow-md border border-indigo-100">
                          {pairingCode.slice(4)}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pairingCode)
                      toast.success('¡Código copiado al portapapeles! 📋')
                    }}
                    className="mt-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all duration-200 active:scale-95 mx-auto flex items-center space-x-1.5"
                  >
                    <span>Copiar código</span>
                  </button>
                </div>

                <div>
                  <h2 className="text-xl font-black text-gray-900 mb-2">Ingresa el código en tu celular</h2>
                  <p className="text-gray-600 text-sm">
                    Abre WhatsApp → Dispositivos Vinculados → Vincular con número de teléfono
                  </p>
                </div>
                
                <button
                  onClick={handleRegenerateQr}
                  className="flex items-center space-x-2 text-indigo-600 font-bold hover:underline mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerar Código</span>
                </button>
              </div>

            ) : status === 'qr' && qr && !qrExpired ? (
              /* ④ A: QR LISTO */
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-3xl border-4 border-green-500 shadow-2xl relative">
                  <img src={qr} alt="WhatsApp QR" className="w-64 h-64 mx-auto" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">Escanea el código QR</h2>
                  <p className="text-gray-600 text-sm">
                    Abre WhatsApp → Menú o Configuración → Dispositivos vinculados
                  </p>
                </div>
                <button
                  onClick={handleRegenerateQr}
                  className="flex items-center space-x-2 text-green-600 font-bold hover:underline mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerar QR</span>
                </button>
              </div>

            ) : status === 'qr' && qrExpired ? (
              /* ⑤ QR / CÓDIGO EXPIRADO */
              <div className="space-y-5 py-10">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <WifiOff className="w-10 h-10 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-amber-700">{pairingCode ? 'Código Expirado' : 'QR Expirado'}</h2>
                  <p className="text-gray-500 text-sm mt-1">{pairingCode ? 'El código de vinculación venció. Genera uno nuevo.' : 'El código QR venció. Genera uno nuevo.'}</p>
                </div>
                <button
                  onClick={handleRegenerateQr}
                  className={`w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                    pairingCode
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                      : 'bg-green-600 hover:bg-green-700 shadow-green-200'
                  }`}
                >
                  <RefreshCw className="w-5 h-5 inline mr-2" />
                  {pairingCode ? 'Nuevo Código' : 'Nuevo QR'}
                </button>
              </div>

            ) : status === 'connected' ? (
              /* ⑥ CONECTADO */
              <div className="space-y-6 py-8">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-green-700">¡Conectado!</h2>
                  <p className="text-gray-600 font-medium mt-2">
                    Tu WhatsApp está vinculado y {botEnabled ? 'respondiendo automáticamente.' : 'en modo silencioso.'}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center space-x-3 text-left">
                  <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-800 font-bold">
                    Sesión activa. No cierres la sesión desde tu teléfono para mantener la automatización.
                  </p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors"
                >
                  Cerrar Sesión
                </button>
              </div>

            ) : (
              /* ⑦ DESCONECTADO */
              <div className="space-y-6 py-6 w-full">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-12 h-12 text-gray-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Desconectado</h2>
                  <p className="text-gray-500 text-sm mt-1">Vincula tu cuenta para comenzar</p>
                </div>

                {/* OPCIÓN DE VINCULACIÓN */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-left max-w-sm mx-auto space-y-4">
                  <p className="text-xs font-black text-gray-700 uppercase tracking-wider">Método de Vinculación</p>
                  
                  <div className="flex bg-gray-200 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setUsePairingCode(false)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        !usePairingCode ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Código QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsePairingCode(true)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        usePairingCode ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Código de Teléfono
                    </button>
                  </div>

                  {usePairingCode && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <label className="text-xs font-bold text-gray-600">Número de WhatsApp (con código de país)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">📞</span>
                        <input
                          type="text"
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value)}
                          placeholder="Ej: 51989353316"
                          className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-9 pr-3 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">No incluyas el signo "+" ni espacios.</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleConnect}
                  className={`w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                    usePairingCode
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                      : 'bg-green-600 hover:bg-green-700 shadow-green-200'
                  }`}
                >
                  Conectar ahora
                </button>
              </div>
            )}

          </div>

          {/* Instrucciones */}
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Smartphone className="w-32 h-32 rotate-12" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-4 flex items-center space-x-2">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                  <span>¿Cómo funciona?</span>
                </h3>
                <ul className="space-y-4">
                  {[
                    'Escanea el QR con la app de WhatsApp de tu negocio.',
                    'El sistema mantiene la sesión activa en nuestros servidores seguros.',
                    'Cuando marques un pedido como "Enviado", avisamos automáticamente a tu cliente.',
                    '¡Nuestra IA redactará el mensaje para que sea profesional y venda más!',
                  ].map((text, i) => (
                    <li key={i} className="flex items-start space-x-3">
                      <div className="bg-white/20 px-2 py-0.5 rounded-lg font-bold text-sm flex-shrink-0">{i + 1}</div>
                      <p className="text-sm">{text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6">
              <h4 className="font-black text-amber-900 mb-2 flex items-center space-x-2">
                <QrCode className="w-5 h-5" />
                <span>Recomendaciones</span>
              </h4>
              <ul className="text-sm text-amber-800 space-y-2 list-disc list-inside font-medium">
                <li>Usa un número de WhatsApp Business para mayor profesionalismo.</li>
                <li>Asegúrate de tener buena conexión a internet en tu teléfono.</li>
                <li>No cierres la sesión "WhatsApp Web" desde los ajustes de tu celular.</li>
                <li>El bot <strong>nunca responde en grupos ni estados</strong>, solo chats privados.</li>
                <li>Usa el toggle de arriba para pausar el bot si quieres responder manualmente.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
