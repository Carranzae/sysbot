'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'react-qr-code'
import { Menu, LogOut, Bell, LifeBuoy, Plus, Sparkles, X, Settings, Building2, FileText, Radio, Database, ChevronDown, User, CreditCard, Send, MessageCircle, Instagram } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useBusinessStore } from '@/store/business'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { notificationsApi, businessApi, whatsappApi, metaApi, oauthApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { connectWebSocket, disconnectWebSocket, joinBusinessRoom, joinUserRoom, leaveBusinessRoom, leaveUserRoom, subscribeToAdminNotifications } from '@/lib/websocket'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const router = useRouter()
  const { user, logout, token } = useAuthStore()
  const { businesses, selectedBusiness, setSelectedBusiness, clearBusinesses } = useBusinessStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [actionCenterOpen, setActionCenterOpen] = useState(false)
  const [helpCenterOpen, setHelpCenterOpen] = useState(false)
  const [liveNotification, setLiveNotification] = useState<any | null>(null)

  // Slide-over configuration panel states
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<'channels' | 'business' | 'subscription' | 'webhooks'>('channels')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // WhatsApp Web connection states
  const [waConnected, setWaConnected] = useState(false)
  const [waPhoneNumber, setWaPhoneNumber] = useState('')
  const [waQrData, setWaQrData] = useState('')
  const [waLastConnected, setWaLastConnected] = useState<Date | null>(null)
  const [waInitializing, setWaInitializing] = useState(false)

  // Telegram states
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramConnected, setTelegramConnected] = useState(false)

  // Meta connection states
  const [metaConnection, setMetaConnection] = useState<any>(null)

  const handleDisconnectMeta = async (platform: 'facebook' | 'instagram') => {
    if (!selectedBusiness) return
    try {
      setSettingsSaving(true)
      const payload =
        platform === 'facebook'
          ? { messengerAccessToken: null, messengerEnabled: false, messengerConnected: false }
          : { instagramAccessToken: null, instagramEnabled: false, instagramConnected: false };
      await metaApi.updateConnection(selectedBusiness.id, payload)
      
      // Refresh status
      const metaResponse = await metaApi.getConnection(selectedBusiness.id)
      setMetaConnection(metaResponse.data)

      toast({
        title: `Desconectado`,
        description: `La cuenta de ${platform === 'facebook' ? 'Facebook Messenger' : 'Instagram Direct'} ha sido desconectada.`,
      })
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'No se pudo desconectar la cuenta.',
        variant: 'destructive',
      })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleConnectMeta = async (platform: 'facebook' | 'instagram') => {
    if (!selectedBusiness) return
    const business = selectedBusiness
    try {
      setSettingsSaving(true)
      const response = await oauthApi.getMetaStartUrl(platform, business.id)
      window.open(response.data.url, '_blank', 'noopener,noreferrer')
      toast({
        title: 'OAuth Iniciado',
        description: 'Completa la autenticacion en la nueva pestana y luego recarga la configuracion.',
      })
      return
    } catch (e: any) {
      toast({
        title: 'No se pudo iniciar Meta OAuth',
        description: e.response?.data?.message || e.message || 'Revisa META_APP_ID y META_APP_SECRET en Railway.',
        variant: 'destructive',
      })
      return
    } finally {
      setSettingsSaving(false)
    }
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
    const url = `${base}/oauth/${platform}/start?businessId=${encodeURIComponent(business.id)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    toast({
      title: 'OAuth Iniciado',
      description: 'Completa la autenticación en la nueva pestaña y luego recarga la configuración.',
    })
  }

  // Business Profile states
  const [businessRuc, setBusinessRuc] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPrefix, setBusinessPrefix] = useState('B001-')
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState(0)

  // Webhook states
  const [webhookUrl, setWebhookUrl] = useState('')

  const fetchTechnicalSettings = async () => {
    if (!selectedBusiness) return
    try {
      setSettingsLoading(true)
      // WhatsApp status
      try {
        const waRes = await whatsappApi.getStatus(selectedBusiness.id)
        const waData = waRes.data
        const waConn = waData.connected || waData.status?.connected || waData.status === 'READY' || waData.status?.statusString === 'READY'
        setWaConnected(waConn)
        setWaPhoneNumber(waData.phoneNumber || waData.status?.phoneNumber || '')
        setWaLastConnected(waData.lastConnected ? new Date(waData.lastConnected) : null)
      } catch (e) {
        console.error('Error fetching WA status:', e)
      }

      // Meta connection
      try {
        const metaResponse = await metaApi.getConnection(selectedBusiness.id)
        setMetaConnection(metaResponse.data)
      } catch (e) {
        console.error('Error fetching Meta connection:', e)
      }

      // Bot config
      try {
        const botConfigRes = await businessApi.getBotConfig(selectedBusiness.id)
        const botConfig = botConfigRes.data
        if (botConfig.whatsappWebNumber) {
          setWaPhoneNumber((current) => current || botConfig.whatsappWebNumber)
        }
        setTelegramToken(botConfig.telegramBotToken || '')
        setTelegramConnected(botConfig.telegramConnected || false)
        setBusinessPrefix(botConfig.invoicePrefix || 'B001-')
        setLastInvoiceNumber(botConfig.lastInvoiceNumber || 0)
        setBusinessRuc(botConfig.businessRUC || '')
      } catch (e) {
        console.error('Error fetching bot config:', e)
      }

      // Contact settings
      try {
        const contactRes = await businessApi.getContactSettings(selectedBusiness.id)
        setBusinessAddress(contactRes.data.supportEmail || '')
      } catch (e) {
        console.error('Error fetching contact settings:', e)
      }

      // Webhook/Payment settings
      try {
        const paymentRes = await businessApi.getPaymentSettings(selectedBusiness.id)
        setWebhookUrl(paymentRes.data.webhookUrl || '')
        if (paymentRes.data.whatsappNumber) {
          setWaPhoneNumber((current) => current || paymentRes.data.whatsappNumber)
        }
      } catch (e) {
        console.error('Error fetching payment settings:', e)
      }

    } catch (error) {
      console.error('Error loading technical settings:', error)
    } finally {
      setSettingsLoading(false)
    }
  }

  useEffect(() => {
    if (settingsPanelOpen && selectedBusiness) {
      fetchTechnicalSettings()
    }
  }, [settingsPanelOpen, selectedBusiness])

  useEffect(() => {
    if (!settingsPanelOpen || !selectedBusiness || !waQrData) return
    const statusInterval = setInterval(async () => {
      try {
        const response = await whatsappApi.getStatus(selectedBusiness.id)
        const waData = response.data
        const waConn = waData.connected || waData.status?.connected || waData.status === 'READY' || waData.status?.statusString === 'READY'
        if (waConn) {
          setWaConnected(true)
          setWaQrData('')
          toast({
            title: '¡WhatsApp Conectado!',
            description: 'Tu negocio está ahora activo en WhatsApp Web.',
          })
          clearInterval(statusInterval)
        }
      } catch (error) {
        console.error('Error checking WhatsApp status:', error)
      }
    }, 4005)
    return () => clearInterval(statusInterval)
  }, [settingsPanelOpen, selectedBusiness, waQrData])

  const handleConnectWhatsApp = async () => {
    if (!selectedBusiness) return
    try {
      const phoneNumber = waPhoneNumber.trim().replace(/[^\d+]/g, '')
      if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
        toast({
          title: 'Numero requerido',
          description: 'Ingresa el numero en formato internacional, por ejemplo +51987654321.',
          variant: 'destructive',
        })
        return
      }
      setWaPhoneNumber(phoneNumber)
      setWaInitializing(true)
      await whatsappApi.initWeb(selectedBusiness.id, phoneNumber)
      const qr = await waitForQr()
      if (!qr) {
        toast({
          title: 'QR todavia en preparacion',
          description: 'El servidor inicio WhatsApp Web, pero WhatsApp aun no entrego el QR. Espera unos segundos o intenta de nuevo.',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Código QR Generado',
        description: 'Escanea el código QR con tu WhatsApp.',
      })
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'No se pudo iniciar WhatsApp Web',
        variant: 'destructive',
      })
    } finally {
      setWaInitializing(false)
    }
  }

  const waitForQr = async (attempts = 12): Promise<string> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const qr = await refreshQr()
      if (qr) return qr
      await new Promise(resolve => setTimeout(resolve, attempt < 4 ? 1500 : 3000))
    }
    return ''
  }

  const refreshQr = async (): Promise<string> => {
    if (!selectedBusiness) return ''
    try {
      const res = await whatsappApi.getQr(selectedBusiness.id)
      const qr = res.data.qr || ''
      setWaQrData(qr)
      return qr
    } catch (e) {
      console.error('Error refreshing QR:', e)
      return ''
    }
  }

  const handleDisconnectWhatsApp = async () => {
    if (!selectedBusiness) return
    try {
      await whatsappApi.deleteSession(selectedBusiness.id)
      setWaConnected(false)
      setWaQrData('')
      toast({
        title: 'WhatsApp Desconectado',
        description: 'La sesión de WhatsApp Web ha sido finalizada.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo cerrar la sesión de WhatsApp',
        variant: 'destructive',
      })
    }
  }

  const handleConnectTelegram = async () => {
    if (!selectedBusiness || !telegramToken.trim()) return
    try {
      setSettingsSaving(true)
      await businessApi.connectTelegram(selectedBusiness.id, { botToken: telegramToken })
      setTelegramConnected(true)
      toast({
        title: 'Telegram Conectado',
        description: 'El bot ha sido conectado con éxito.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar Telegram.',
        variant: 'destructive',
      })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!selectedBusiness) return
    try {
      setSettingsSaving(true)
      await businessApi.disconnectTelegram(selectedBusiness.id)
      setTelegramConnected(false)
      setTelegramToken('')
      toast({
        title: 'Telegram Desconectado',
        description: 'Bot de Telegram desconectado.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo desconectar Telegram.',
        variant: 'destructive',
      })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!selectedBusiness) return
    try {
      setSettingsSaving(true)
      await businessApi.updateBotConfig(selectedBusiness.id, {
        invoicePrefix: businessPrefix,
        lastInvoiceNumber: Number(lastInvoiceNumber),
        businessRUC: businessRuc,
      })
      toast({
        title: 'Configuración guardada',
        description: 'Los datos de la empresa se han guardado.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración.',
        variant: 'destructive',
      })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveWebhook = async () => {
    if (!selectedBusiness) return
    try {
      setSettingsSaving(true)
      await businessApi.updatePaymentSettings(selectedBusiness.id, {
        webhookUrl: webhookUrl,
      })
      toast({
        title: 'Webhook guardado',
        description: 'La URL de webhook se ha actualizado.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el webhook.',
        variant: 'destructive',
      })
    } finally {
      setSettingsSaving(false)
    }
  }

  const userInitials = useMemo(() => {
    if (!user) return 'US'
    const first = user.firstName?.charAt(0) ?? ''
    const last = user.lastName?.charAt(0) ?? ''
    return `${first}${last}`.toUpperCase() || 'US'
  }, [user])

  const formattedIndustry = selectedBusiness?.industryType
    ? selectedBusiness.industryType.replace('_', ' ')
    : 'Sin rubro'

  const quickActions = useMemo(() => {
    if (!selectedBusiness) return []
    const industry = selectedBusiness.industryType
    const actions: Record<string, { label: string; href: string; description: string }[]> = {
      RESTAURANT: [
        { label: 'Nuevo Pedido', href: '/orders?create=true', description: 'Registra un pedido manual' },
        { label: 'Nuevo Cliente', href: '/leads?create=true', description: 'Captura datos de un cliente' },
      ],
      CLINIC: [
        { label: 'Agendar Cita', href: '/appointments?create=true', description: 'Registra una cita médica' },
        { label: 'Enviar Recordatorio', href: '/notifications?create=true', description: 'Configura una notificación' },
      ],
    }
    return actions[industry] ?? [
      { label: 'Crear lead', href: '/leads?create=true', description: 'Añade un lead rápidamente' },
      { label: 'Enviar mensaje', href: '/messages', description: 'Continúa una conversación' },
    ]
  }, [selectedBusiness])

  useEffect(() => {
    if (!notificationsOpen || !selectedBusiness) return
    const fetchNotifications = async () => {
      try {
        setNotificationsLoading(true)
        const { data } = await notificationsApi.getAll(selectedBusiness.id)
        setNotifications(data)
      } catch (error) {
        toast({
          title: 'No se pudieron cargar las notificaciones',
          description: 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        })
      } finally {
        setNotificationsLoading(false)
      }
    }
    fetchNotifications()
  }, [notificationsOpen, selectedBusiness, toast])

  const handleOpenNotifications = () => {
    if (!selectedBusiness) {
      toast({
        title: 'Selecciona un negocio',
        description: 'Necesitas elegir un negocio para ver sus notificaciones.',
      })
      return
    }
    setNotificationsOpen(true)
  }

  const handleOpenActionCenter = () => {
    if (!selectedBusiness) {
      toast({
        title: 'Selecciona un negocio',
        description: 'Elige un negocio para ejecutar acciones rápidas.',
      })
      return
    }
    setActionCenterOpen(true)
  }

  const handleLogout = () => {
    logout()
    clearBusinesses()
    setNotificationsOpen(false)
    setActionCenterOpen(false)
    setHelpCenterOpen(false)
    router.push('/login')
  }

  useEffect(() => {
    if (!token || !user) return

    const socket = connectWebSocket(token)
    joinUserRoom(user.id)
    const unsubscribe = subscribeToAdminNotifications((notification) => {
      setNotifications((prev) => [notification, ...prev])
      setLiveNotification(notification)
      toast({
        title: notification.title || 'Nueva notificación',
        description: notification.description || notification.message || 'Tienes una alerta nueva.',
      })
    })

    return () => {
      unsubscribe()
      leaveUserRoom(user.id)
      disconnectWebSocket()
    }
  }, [token, user, toast])

  useEffect(() => {
    if (!token || !selectedBusiness) return
    joinBusinessRoom(selectedBusiness.id)
    return () => {
      if (selectedBusiness?.id) {
        leaveBusinessRoom(selectedBusiness.id)
      }
    }
  }, [token, selectedBusiness])

  return (
    <div className="flex flex-1 flex-col min-h-screen">
      <header className="sticky top-0 z-20 w-full bg-luxury-glass border-b border-slate-200/50 px-4 py-3 flex items-center gap-3 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen((prev) => !prev)} aria-label="Toggle menu" className="text-slate-600">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary font-syst">SYST</p>
          <p className="text-sm font-black text-slate-800 leading-tight font-syst">{selectedBusiness?.name || 'Sin negocio'}</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          Salir
        </Button>
      </header>

      {mobileNavOpen && (
        <div className="md:hidden border-b border-slate-200/50 bg-luxury-glass px-4 py-3 space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tu negocio</p>
          <div className="space-y-2">
            {businesses.length === 0 ? (
              <Link href="/businesses" className="text-sm font-semibold text-primary font-syst">
                Configura tu primer negocio
              </Link>
            ) : (
              businesses.map((business) => (
                <button
                  key={business.id}
                  className={cn(
                    'w-full text-left text-sm px-3 py-2 rounded-xl border transition-colors',
                    selectedBusiness?.id === business.id 
                      ? 'border-primary bg-primary/10 text-primary font-bold' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                  onClick={() => {
                    setSelectedBusiness(business)
                    setMobileNavOpen(false)
                  }}
                >
                  {business.name}
                  <span className="block text-[10px] text-slate-500 font-medium">
                    {business.industryType.replace('_', ' ')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 hidden md:flex items-center justify-between bg-luxury-glass border-b border-slate-200/50 px-8 py-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] font-syst">Panel Empresarial</p>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xl font-extrabold text-slate-800 font-syst">{selectedBusiness?.name || 'Selecciona un negocio'}</p>
              <p className="text-xs font-semibold text-slate-500">Rubro: <span className="text-slate-700">{formattedIndustry}</span></p>
            </div>
            <Button variant="outline" size="sm" asChild className="border-slate-200 hover:border-primary/50 bg-white hover:bg-primary/5 text-slate-600 hover:text-primary transition-all duration-300 shadow-sm rounded-xl">
              <Link href="/businesses">Cambiar negocio</Link>
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-200 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Bot {selectedBusiness ? 'activo' : 'inactivo'}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notificaciones" onClick={handleOpenNotifications} className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Configuración técnica" onClick={() => { setSettingsPanelOpen(true); setActiveSettingsTab('channels'); }} className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Centro de ayuda" onClick={() => setHelpCenterOpen(true)} className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl">
            <LifeBuoy className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-sm font-black shadow-sm group-hover:border-primary/50 transition-all duration-300 font-syst">
                    {userInitials}
                  </div>
                  <ChevronDown className="h-3 w-3 absolute -bottom-1 -right-1 bg-white border border-slate-200 text-slate-500 rounded-full" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white border border-slate-200 text-slate-700 shadow-xl rounded-2xl p-1.5">
                <DropdownMenuItem asChild className="focus:bg-slate-50 focus:text-primary rounded-xl cursor-pointer">
                  <Link href="/profile" className="flex items-center gap-2 font-semibold font-syst">
                    <User className="h-4 w-4" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <div className="border-t border-slate-100 my-1.5"></div>
                <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider font-syst">
                  Configuraciones
                </div>
                <DropdownMenuItem asChild className="focus:bg-slate-50 focus:text-primary rounded-xl cursor-pointer">
                  <Link href="/businesses" className="flex items-center gap-2 font-semibold font-syst">
                    <Building2 className="h-4 w-4" />
                    Negocios
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSettingsPanelOpen(true); setActiveSettingsTab('channels'); }} className="focus:bg-slate-50 focus:text-primary rounded-xl cursor-pointer">
                  <span className="flex items-center gap-2 font-semibold font-syst">
                    <Radio className="h-4 w-4" />
                    Canales de Chat
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSettingsPanelOpen(true); setActiveSettingsTab('business'); }} className="focus:bg-slate-50 focus:text-primary rounded-xl cursor-pointer">
                  <span className="flex items-center gap-2 font-semibold font-syst">
                    <Settings className="h-4 w-4" />
                    Ajustes de Empresa
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSettingsPanelOpen(true); setActiveSettingsTab('subscription'); }} className="focus:bg-slate-50 focus:text-primary rounded-xl cursor-pointer">
                  <span className="flex items-center gap-2 font-semibold font-syst">
                    <CreditCard className="h-4 w-4" />
                    Suscripción
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSettingsPanelOpen(true); setActiveSettingsTab('webhooks'); }} className="focus:bg-slate-50 focus:text-primary rounded-xl cursor-pointer">
                  <span className="flex items-center gap-2 font-semibold font-syst">
                    <Database className="h-4 w-4" />
                    APIs & Webhooks
                  </span>
                </DropdownMenuItem>
                <div className="border-t border-slate-100 my-1.5"></div>
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-600 focus:bg-red-50 focus:text-red-700 rounded-xl cursor-pointer font-semibold font-syst">
                  <LogOut className="h-4 w-4" />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>

      <footer className="border-t border-slate-200/50 bg-slate-50/50 px-4 py-3 text-[10px] text-slate-400 flex items-center justify-between md:hidden font-bold">
        <span>{user ? `${user.firstName} ${user.lastName}` : 'Usuario'}</span>
        <span>SYST © {new Date().getFullYear()}</span>
      </footer>

      {notificationsOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-white border-l border-slate-200/50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Centro de notificaciones</p>
                <p className="text-lg font-extrabold text-slate-800 font-syst">
                  {selectedBusiness?.name || 'Negocio'} · {formattedIndustry}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 luxury-scrollbar">
              {notificationsLoading ? (
                <p className="text-sm text-slate-500 font-medium">Cargando notificaciones...</p>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-slate-400 font-medium">Aún no hay notificaciones recientes.</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-2xl border border-slate-100 px-4 py-3 bg-slate-50/50 hover:bg-slate-50 hover:shadow-sm transition-all duration-300"
                  >
                    <p className="text-sm font-bold text-slate-800">{notification.title || 'Notificación'}</p>
                    <p className="text-xs text-slate-500 mt-1">{notification.description || 'Sin descripción'}</p>
                    <div className="mt-2 text-[10px] text-slate-400 font-bold flex items-center justify-between">
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      <span className={notification.isSent ? 'text-emerald-600' : 'text-amber-600'}>
                        {notification.isSent ? 'Enviado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {actionCenterOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acciones rápidas</p>
                <p className="text-lg font-extrabold text-slate-800 font-syst">
                  {selectedBusiness?.name || 'Negocio'} · {formattedIndustry}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActionCenterOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="block rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                  onClick={() => setActionCenterOpen(false)}
                >
                  <p className="font-bold text-slate-800">{action.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {helpCenterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-white border-l border-slate-200/50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Centro de ayuda</p>
                <p className="text-lg font-extrabold text-slate-800 font-syst">Soporte SYST</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setHelpCenterOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 luxury-scrollbar">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-sm font-bold text-slate-800 font-syst">Documentación</p>
                <p className="text-xs text-slate-500 mt-1">
                  Guías rápidas para configurar tu bot y conectar integraciones.
                </p>
                <Button variant="link" className="px-0 text-primary mt-2 font-bold font-syst" asChild>
                  <Link href="/docs">Ver documentación &rarr;</Link>
                </Button>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-sm font-bold text-slate-800 font-syst">Equipo de soporte</p>
                <p className="text-xs text-slate-500 mt-1">Escríbenos para activar integraciones o resolver dudas.</p>
                <div className="mt-3 space-y-1 text-xs text-slate-600 font-semibold font-syst">
                  <p>WhatsApp: +51 900 123 456</p>
                  <p>Email: soporte@syst.ai</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-sm font-bold text-slate-800 font-syst">Estado de la plataforma</p>
                <p className="text-xs text-slate-500 mt-1">Último chequeo: {new Date().toLocaleString()}</p>
                <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-200">
                  <Sparkles className="h-3 w-3" />
                  Todos los servicios operativos
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!liveNotification} onOpenChange={(open) => !open && setLiveNotification(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {liveNotification?.title || 'Nueva comunicación'}
            </DialogTitle>
            <DialogDescription>
              {liveNotification?.description || liveNotification?.message || 'Revisa las notificaciones de tu panel.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {liveNotification?.businessName && (
              <p className="text-xs uppercase text-gray-500">Negocio: {liveNotification.businessName}</p>
            )}
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              {liveNotification?.message && <p className="leading-relaxed text-gray-800">{liveNotification.message}</p>}
              {liveNotification?.metadata?.adminType && (
                <span className="text-xs font-medium text-primary/80">
                  Tipo: {liveNotification.metadata.adminType}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { setNotificationsOpen(true); setLiveNotification(null) }}>
                Ver todas las notificaciones
              </Button>
              <Button variant="outline" onClick={() => setLiveNotification(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {settingsPanelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm transition-all duration-300">
          <div className="h-full w-full max-w-xl bg-slate-900 border-l border-slate-800 text-white flex flex-col shadow-2xl relative transition-transform duration-300 transform translate-x-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5 bg-slate-950">
              <div>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest font-syst">CONFIGURACIÓN TÉCNICA</p>
                <h3 className="text-lg font-black text-white font-syst">
                  {selectedBusiness?.name || 'Ajustes del Negocio'}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsPanelOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 py-2 overflow-x-auto gap-2">
              <button
                onClick={() => setActiveSettingsTab('channels')}
                className={cn(
                  'px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 border flex items-center gap-2 whitespace-nowrap',
                  activeSettingsTab === 'channels'
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
                )}
              >
                <Radio className="h-3.5 w-3.5" />
                Canales
              </button>
              <button
                onClick={() => setActiveSettingsTab('business')}
                className={cn(
                  'px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 border flex items-center gap-2 whitespace-nowrap',
                  activeSettingsTab === 'business'
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Empresa
              </button>
              <button
                onClick={() => setActiveSettingsTab('subscription')}
                className={cn(
                  'px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 border flex items-center gap-2 whitespace-nowrap',
                  activeSettingsTab === 'subscription'
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
                )}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Suscripción
              </button>
              <button
                onClick={() => setActiveSettingsTab('webhooks')}
                className={cn(
                  'px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 border flex items-center gap-2 whitespace-nowrap',
                  activeSettingsTab === 'webhooks'
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
                )}
              >
                <Database className="h-3.5 w-3.5" />
                Webhooks
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 luxury-scrollbar bg-slate-900/50">
              {settingsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p className="text-sm text-slate-400">Cargando configuración...</p>
                </div>
              ) : (
                <>
                  {/* TAB: CHANNELS */}
                  {activeSettingsTab === 'channels' && (
                    <div className="space-y-6">
                      <div className="p-5 rounded-2xl border border-slate-850 bg-slate-950/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center border border-green-500/20">
                              <Radio className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white font-syst">WhatsApp Web</h4>
                              <p className="text-[10px] text-slate-400">Conexión directa mediante código QR</p>
                            </div>
                          </div>
                          <span className={cn(
                            'px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full border',
                            waConnected
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}>
                            {waConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>

                        {waConnected ? (
                          <div className="space-y-4">
                            <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-805">
                              <p><span className="font-bold text-white">Número:</span> {waPhoneNumber || 'Desconocido'}</p>
                              {waLastConnected && (
                                <p><span className="font-bold text-white">Última sincronización:</span> {waLastConnected.toLocaleString()}</p>
                              )}
                            </div>
                            <Button
                              variant="destructive"
                              className="w-full rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200"
                              onClick={handleDisconnectWhatsApp}
                            >
                              Cerrar Sesión WhatsApp
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-400">
                              Inicializa el cliente Baileys y escanea el código QR desde tu celular para activar las respuestas automáticas.
                            </p>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Numero de WhatsApp
                              </label>
                              <input
                                value={waPhoneNumber}
                                onChange={(event) => setWaPhoneNumber(event.target.value)}
                                placeholder="+51987654321"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
                              />
                            </div>

                            {waQrData && (
                              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-700 w-48 h-48 mx-auto">
                                {waQrData.startsWith('data:') || waQrData.length > 500 ? (
                                  <img src={waQrData.startsWith('data:') ? waQrData : `data:image/png;base64,${waQrData}`} alt="WhatsApp QR Code" className="w-40 h-40 object-contain" />
                                ) : (
                                  <QRCode value={waQrData} size={160} />
                                )}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                className="flex-1 rounded-xl bg-primary hover:bg-primary-hover border border-primary/20"
                                onClick={handleConnectWhatsApp}
                                disabled={waInitializing}
                              >
                                {waInitializing ? 'Iniciando...' : (waQrData ? 'Actualizar QR' : 'Generar Código QR')}
                              </Button>
                              {waQrData && (
                                <Button
                                  variant="outline"
                                  className="rounded-xl border-slate-800 text-slate-300 hover:text-white"
                                  onClick={() => setWaQrData('')}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-5 rounded-2xl border border-slate-850 bg-slate-950/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                              <Send className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white font-syst">Telegram Bot</h4>
                              <p className="text-[10px] text-slate-400">Vincula tu BotToken de BotFather</p>
                            </div>
                          </div>
                          <span className={cn(
                            'px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full border',
                            telegramConnected
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}>
                            {telegramConnected ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 block">Bot Token</label>
                            <input
                              type="password"
                              value={telegramToken}
                              onChange={(e) => setTelegramToken(e.target.value)}
                              placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
                              disabled={telegramConnected}
                            />
                          </div>

                          {telegramConnected ? (
                            <Button
                              variant="destructive"
                              className="w-full rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200"
                              onClick={handleDisconnectTelegram}
                              disabled={settingsSaving}
                            >
                              Desconectar Bot
                            </Button>
                          ) : (
                            <Button
                              className="w-full rounded-xl bg-primary hover:bg-primary-hover border border-primary/20"
                              onClick={handleConnectTelegram}
                              disabled={settingsSaving || !telegramToken.trim()}
                            >
                              {settingsSaving ? 'Conectando...' : 'Conectar Bot Telegram'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Facebook Messenger Card */}
                      <div className="p-5 rounded-2xl border border-slate-850 bg-slate-950/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                              <MessageCircle className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white font-syst">Facebook Messenger</h4>
                              <p className="text-[10px] text-slate-400">Automatiza tus chats de Facebook</p>
                            </div>
                          </div>
                          <span className={cn(
                            'px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full border',
                            metaConnection?.messengerConnected
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}>
                            {metaConnection?.messengerConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {metaConnection?.messengerConnected ? (
                            <>
                              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-805">
                                <p><span className="font-bold text-white">Página vinculada:</span> {metaConnection.messengerPageId || 'Desconocido'}</p>
                              </div>
                              <Button
                                variant="destructive"
                                className="w-full rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200"
                                onClick={() => handleDisconnectMeta('facebook')}
                                disabled={settingsSaving}
                              >
                                Desconectar Facebook Messenger
                              </Button>
                            </>
                          ) : (
                            <Button
                              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/20"
                              onClick={() => handleConnectMeta('facebook')}
                            >
                              Vincular con Facebook
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Instagram Direct Card */}
                      <div className="p-5 rounded-2xl border border-slate-850 bg-slate-950/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl" />
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center border border-pink-500/20">
                              <Instagram className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white font-syst">Instagram Direct</h4>
                              <p className="text-[10px] text-slate-400">Mensajes directos de Instagram</p>
                            </div>
                          </div>
                          <span className={cn(
                            'px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full border',
                            metaConnection?.instagramConnected
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}>
                            {metaConnection?.instagramConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {metaConnection?.instagramConnected ? (
                            <>
                              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-805">
                                <p><span className="font-bold text-white">Cuenta vinculada:</span> {metaConnection.instagramAccountId || 'Desconocido'}</p>
                              </div>
                              <Button
                                variant="destructive"
                                className="w-full rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200"
                                onClick={() => handleDisconnectMeta('instagram')}
                                disabled={settingsSaving}
                              >
                                Desconectar Instagram Direct
                              </Button>
                            </>
                          ) : (
                            <Button
                              className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 text-white border border-pink-500/20"
                              onClick={() => handleConnectMeta('instagram')}
                            >
                              Vincular con Instagram
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: BUSINESS */}
                  {activeSettingsTab === 'business' && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300 block">RUC de la Empresa</label>
                        <input
                          type="text"
                          value={businessRuc}
                          onChange={(e) => setBusinessRuc(e.target.value)}
                          placeholder="20608945231"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300 block">Correo de Asistencia</label>
                        <input
                          type="email"
                          value={businessAddress}
                          onChange={(e) => setBusinessAddress(e.target.value)}
                          placeholder="contacto@empresa.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-300 block">Prefijo de Boletas</label>
                          <input
                            type="text"
                            value={businessPrefix}
                            onChange={(e) => setBusinessPrefix(e.target.value)}
                            placeholder="B001-"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-300 block">Último Correlativo</label>
                          <input
                            type="number"
                            value={lastInvoiceNumber}
                            onChange={(e) => setLastInvoiceNumber(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full rounded-xl bg-primary hover:bg-primary-hover border border-primary/20 mt-4"
                        onClick={handleSaveProfile}
                        disabled={settingsSaving}
                      >
                        {settingsSaving ? 'Guardando...' : 'Guardar Cambios de Empresa'}
                      </Button>
                    </div>
                  )}

                  {/* TAB: SUBSCRIPTION */}
                  {activeSettingsTab === 'subscription' && (
                    <div className="space-y-5">
                      <div className="p-5 rounded-2xl border border-slate-850 bg-slate-950/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-violet-400">PLAN CONTRATADO</p>
                        <h4 className="text-xl font-extrabold text-white mt-1 font-syst">Enterprise AI Suite</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Soporte omnicanal de alta capacidad</p>
                        
                        <div className="mt-5 space-y-3">
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-slate-300">Mensajes de IA mensuales</span>
                              <span className="text-white">5,324 / 10,000</span>
                            </div>
                            <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div className="bg-primary h-full rounded-full" style={{ width: '53.24%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-slate-300">Almacenamiento de Conocimiento</span>
                              <span className="text-white">12.4 MB / 100 MB</span>
                            </div>
                            <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div className="bg-violet-500 h-full rounded-full" style={{ width: '12.4%' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl border border-slate-850 bg-slate-950/40">
                        <h4 className="text-sm font-bold text-white mb-3 font-syst">Características Incluidas</h4>
                        <ul className="space-y-2 text-xs text-slate-400">
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Inferencia con Llama-3 8B y Groq API
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Canales ilimitados de WhatsApp Web y Telegram
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Facturación electrónica integrada (Boleta/Factura)
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Acceso a Swarm Control & logs de auditoría
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* TAB: WEBHOOKS */}
                  {activeSettingsTab === 'webhooks' && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300 block">Clave de API (Secret Key)</label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value="sb_live_048f3eaabf6b46a39c9c8230e3d29297"
                            readOnly
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono focus:outline-none"
                          />
                          <Button
                            variant="outline"
                            className="rounded-xl border-slate-850 hover:bg-slate-800"
                            onClick={() => {
                              navigator.clipboard.writeText('sb_live_048f3eaabf6b46a39c9c8230e3d29297')
                              toast({ title: 'Copiado', description: 'API Key copiada al portapapeles.' })
                            }}
                          >
                            Copiar
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300 block">URL de Webhook (Pagos / Eventos)</label>
                        <input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://mi-servidor.com/webhook"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                        <p className="text-[10px] text-slate-500">Recibe eventos síncronos en tiempo real cuando se verifique un pago o se gane un prospecto.</p>
                      </div>

                      <Button
                        className="w-full rounded-xl bg-primary hover:bg-primary-hover border border-primary/20 mt-4"
                        onClick={handleSaveWebhook}
                        disabled={settingsSaving}
                      >
                        {settingsSaving ? 'Guardando...' : 'Guardar Configuración Webhook'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
