import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Users,
  Cpu,
  Bot,
  Zap,
  Phone,
  Database,
  Terminal,
  RefreshCw,
  Play,
  Pause,
  Download,
  AlertCircle,
  CheckCircle2,
  ListFilter
} from 'lucide-react'
import { apiClient } from '../services/api'

interface CommandCenterProps {
  setActiveTab?: (tab: 'chat' | 'connect' | 'calls' | 'agents' | 'command') => void
}

interface ActivityLog {
  id: string
  time: string
  source: 'SYSTEM' | 'BOT' | 'SWARM' | 'TELEPHONY'
  message: string
  type: 'info' | 'success' | 'warn' | 'error'
}

export default function CommandCenter({ setActiveTab }: CommandCenterProps) {
  const [whatsappStatus, setWhatsappStatus] = useState<string>('cargando...')
  const [botEnabled, setBotEnabled] = useState<boolean>(false)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [logs, setLogs] = useState<ActivityLog[]>([
    { id: '1', time: '12:21:40', source: 'BOT', message: 'Bot respondió a cliente +51 987 654 321', type: 'success' },
    { id: '2', time: '12:20:12', source: 'SWARM', message: 'Agente de Empatía detectó tono negativo y adaptó respuesta', type: 'info' },
    { id: '3', time: '12:18:55', source: 'TELEPHONY', message: 'Nueva llamada registrada en CRM: María García (4m 32s)', type: 'info' },
    { id: '4', time: '12:15:30', source: 'SYSTEM', message: 'Sincronización de usuarios de Sysbot ejecutada exitosamente', type: 'success' },
    { id: '5', time: '12:02:11', source: 'BOT', message: 'Respuesta automática omitida: usuario pausó el bot manualmente', type: 'warn' },
    { id: '6', time: '11:58:04', source: 'SYSTEM', message: 'Conexión con base de datos principal PostgreSQL establecida', type: 'success' }
  ])

  // Fetch status on mount
  useEffect(() => {
    let active = true
    
    async function loadStatus() {
      try {
        const wa = await apiClient.getWhatsAppWebStatus()
        if (active) setWhatsappStatus(wa.status)
      } catch (err) {
        if (active) setWhatsappStatus('desconectado')
      }

      try {
        const bot = await apiClient.getWhatsAppBotEnabled()
        if (active) setBotEnabled(bot.enabled)
      } catch (err) {
        if (active) setBotEnabled(false)
      }
    }

    loadStatus()
    const interval = setInterval(loadStatus, 15000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const handleToggleBot = async () => {
    try {
      const res = await apiClient.setWhatsAppBotEnabled(!botEnabled)
      setBotEnabled(res.enabled)
      
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        time: new Date().toTimeString().split(' ')[0],
        source: 'BOT',
        message: `Bot IA ha sido ${res.enabled ? 'activado' : 'desactivado'} manualmente`,
        type: res.enabled ? 'success' : 'warn'
      }
      setLogs(prev => [newLog, ...prev])
    } catch (err) {
      alert('No se pudo cambiar el estado del Bot')
    }
  }

  const handleSyncAgents = async () => {
    setSyncing(true)
    // Simulate API call to force sync
    await new Promise(resolve => setTimeout(resolve, 15000))
    setSyncing(false)
    
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      time: new Date().toTimeString().split(' ')[0],
      source: 'SWARM',
      message: 'Enjambre de agentes IA resincronizado con base de datos copilot_expert',
      type: 'success'
    }
    setLogs(prev => [newLog, ...prev])
  }

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sysbot_livechat_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Zap className="text-emerald-400 fill-emerald-400/20" />
            Centro de Mando Unificado
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Panel operativo del sistema de chat y enrutamiento inteligente.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-white/5 rounded-xl text-xs font-semibold text-slate-300">
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          <span>Sistema Operando Correctamente</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mensajes Hoy</p>
              <p className="text-3xl font-bold text-white mt-2">247</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chats Activos</p>
              <p className="text-3xl font-bold text-white mt-2">18</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bot Responses</p>
              <p className="text-3xl font-bold text-white mt-2">189</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-5 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Agentes Activos</p>
              <p className="text-3xl font-bold text-white mt-2">4/4</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* System Status Panel */}
        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-white mb-6">Estado de la Infraestructura</h2>
          
          <div className="space-y-4 flex-1">
            {/* WhatsApp Status */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/20" />
                <span className="text-sm font-semibold text-slate-200">WhatsApp Web</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase ${
                whatsappStatus === 'connected' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {whatsappStatus === 'connected' ? 'CONECTADO ✅' : 'DESCONECTADO ❌'}
              </span>
            </div>

            {/* Bot Status */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${botEnabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className="text-sm font-semibold text-slate-200">Bot IA (WhatsApp)</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase ${
                botEnabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {botEnabled ? 'ACTIVO 🟢' : 'INACTIVO 🔴'}
              </span>
            </div>

            {/* Swarm Engine */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">Swarm Engine</span>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase">
                ONLINE ⚡
              </span>
            </div>

            {/* Telephony (Twilio) */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-slate-200">Telephony (Twilio)</span>
              </div>
              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold uppercase">
                STANDBY 🟡
              </span>
            </div>

            {/* Redis Cache */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">Redis Cache</span>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase">
                CONECTADO ✅
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-white/5 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-slate-400" />
              Actividad del Servidor
            </h2>
            <span className="text-xs text-slate-500">Live feeds</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto flex-1 pr-1">
            {logs.map((log) => {
              let dotColor = 'bg-slate-400'
              if (log.type === 'success') dotColor = 'bg-emerald-400'
              if (log.type === 'warn') dotColor = 'bg-amber-400'
              if (log.type === 'error') dotColor = 'bg-rose-400'

              return (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-950/30 hover:bg-slate-950/60 border border-white/[0.02] rounded-xl transition-all">
                  <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        log.source === 'BOT' ? 'bg-violet-500/10 text-violet-400' :
                        log.source === 'SWARM' ? 'bg-amber-500/10 text-amber-400' :
                        log.source === 'TELEPHONY' ? 'bg-sky-500/10 text-sky-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {log.source}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{log.time}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">{log.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Quick Actions Row */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Acciones de Control Rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Pause/Resume Bot */}
          <button
            onClick={handleToggleBot}
            className={`flex items-center justify-center gap-3 p-4 rounded-xl font-semibold border transition-all text-sm ${
              botEnabled
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            {botEnabled ? (
              <>
                <Pause className="w-5 h-5 shrink-0" />
                Pausar Bot IA
              </>
            ) : (
              <>
                <Play className="w-5 h-5 shrink-0" />
                Reanudar Bot IA
              </>
            )}
          </button>

          {/* View Chats */}
          <button
            onClick={() => setActiveTab?.('chat')}
            className="flex items-center justify-center gap-3 p-4 rounded-xl font-semibold border border-white/5 bg-slate-800/50 hover:bg-slate-800 text-white transition-all text-sm"
          >
            <MessageSquare className="w-5 h-5 text-slate-400" />
            Ver Chats Activos
          </button>

          {/* Sync Agents */}
          <button
            onClick={handleSyncAgents}
            disabled={syncing}
            className="flex items-center justify-center gap-3 p-4 rounded-xl font-semibold border border-white/5 bg-slate-800/50 hover:bg-slate-800 text-white transition-all text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Agentes'}
          </button>

          {/* Export Logs */}
          <button
            onClick={handleExportLogs}
            className="flex items-center justify-center gap-3 p-4 rounded-xl font-semibold border border-white/5 bg-slate-800/50 hover:bg-slate-800 text-white transition-all text-sm"
          >
            <Download className="w-5 h-5 text-slate-400" />
            Exportar Logs
          </button>

        </div>
      </div>
    </div>
  )
}
