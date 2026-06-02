'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, LogOut, Bell, LifeBuoy, Plus, Sparkles, X, Settings, Building2, FileText, Radio, Database, ChevronDown, User } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useBusinessStore } from '@/store/business'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { notificationsApi } from '@/lib/api'
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
      <header className="sticky top-0 z-20 w-full bg-luxury-glass border-b border-white/5 px-4 py-3 flex items-center gap-3 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen((prev) => !prev)} aria-label="Toggle menu" className="text-slate-300">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">SYST</p>
          <p className="text-sm font-black text-white leading-tight">{selectedBusiness?.name || 'Sin negocio'}</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          Salir
        </Button>
      </header>

      {mobileNavOpen && (
        <div className="md:hidden border-b border-white/5 bg-luxury-glass px-4 py-3 space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tu negocio</p>
          <div className="space-y-2">
            {businesses.length === 0 ? (
              <Link href="/businesses" className="text-sm font-semibold text-primary">
                Configura tu primer negocio
              </Link>
            ) : (
              businesses.map((business) => (
                <button
                  key={business.id}
                  className={cn(
                    'w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                    selectedBusiness?.id === business.id 
                      ? 'border-primary bg-primary/10 text-primary font-bold' 
                      : 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10'
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

      <header className="sticky top-0 z-30 hidden md:flex items-center justify-between bg-luxury-glass border-b border-white/5 px-8 py-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">Panel Empresarial</p>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xl font-black text-white">{selectedBusiness?.name || 'Selecciona un negocio'}</p>
              <p className="text-xs font-semibold text-slate-400">Rubro: <span className="text-slate-300">{formattedIndustry}</span></p>
            </div>
            <Button variant="outline" size="sm" asChild className="border-white/10 hover:border-primary/50 bg-white/5 hover:bg-primary/10 text-slate-300 hover:text-primary transition-all duration-300">
              <Link href="/businesses">Cambiar negocio</Link>
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Bot {selectedBusiness ? 'activo' : 'inactivo'}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notificaciones" onClick={handleOpenNotifications} className="text-slate-400 hover:text-white hover:bg-white/5">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Centro de ayuda" onClick={() => setHelpCenterOpen(true)} className="text-slate-400 hover:text-white hover:bg-white/5">
            <LifeBuoy className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 border-l border-white/10 pl-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group">
                  <div className="h-10 w-10 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-sm font-black shadow-[0_0_10px_rgba(99,102,241,0.15)] group-hover:border-primary/60 transition-all duration-300">
                    {userInitials}
                  </div>
                  <ChevronDown className="h-3 w-3 absolute -bottom-1 -right-1 bg-black border border-white/10 text-slate-400 rounded-full" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#0b0c10] border border-white/10 text-slate-300">
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/profile" className="flex items-center gap-2 font-semibold">
                    <User className="h-4 w-4" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <div className="border-t border-white/5 my-1"></div>
                <div className="px-2 py-1 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Configuraciones
                </div>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/businesses" className="flex items-center gap-2 font-semibold">
                    <Building2 className="h-4 w-4" />
                    Negocios
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/files" className="flex items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4" />
                    Archivos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/channels" className="flex items-center gap-2 font-semibold">
                    <Radio className="h-4 w-4" />
                    Canales
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/bot-builder" className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4" />
                    Bots
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/integrations/crm" className="flex items-center gap-2 font-semibold">
                    <Database className="h-4 w-4" />
                    Gestión
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-white">
                  <Link href="/settings" className="flex items-center gap-2 font-semibold">
                    <Settings className="h-4 w-4" />
                    Ajustes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 font-semibold">
                  <LogOut className="h-4 w-4" />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>

      <footer className="border-t border-white/5 bg-black/40 px-4 py-3 text-[10px] text-slate-500 flex items-center justify-between md:hidden font-bold">
        <span>{user ? `${user.firstName} ${user.lastName}` : 'Usuario'}</span>
        <span>SYST © {new Date().getFullYear()}</span>
      </footer>

      {notificationsOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-[#0a0b10] border-l border-white/5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Centro de notificaciones</p>
                <p className="text-lg font-black text-white">
                  {selectedBusiness?.name || 'Negocio'} · {formattedIndustry}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-white hover:bg-white/5">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 luxury-scrollbar">
              {notificationsLoading ? (
                <p className="text-sm text-slate-400 font-medium">Cargando notificaciones...</p>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium">Aún no hay notificaciones recientes.</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-xl border border-white/5 px-4 py-3 bg-white/5 hover:bg-white/10 transition-all duration-300"
                  >
                    <p className="text-sm font-bold text-white">{notification.title || 'Notificación'}</p>
                    <p className="text-xs text-slate-400 mt-1">{notification.description || 'Sin descripción'}</p>
                    <div className="mt-2 text-[10px] text-slate-500 font-bold flex items-center justify-between">
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                      <span className={notification.isSent ? 'text-emerald-400' : 'text-amber-400'}>
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
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl bg-[#0a0b10] border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Acciones rápidas</p>
                <p className="text-lg font-black text-white">
                  {selectedBusiness?.name || 'Negocio'} · {formattedIndustry}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActionCenterOpen(false)} className="text-slate-400 hover:text-white hover:bg-white/5">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="block rounded-xl border border-white/5 bg-white/5 px-4 py-3 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
                  onClick={() => setActionCenterOpen(false)}
                >
                  <p className="font-bold text-white">{action.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {helpCenterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-[#0a0b10] border-l border-white/5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Centro de ayuda</p>
                <p className="text-lg font-black text-white">Soporte SYST</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setHelpCenterOpen(false)} className="text-slate-400 hover:text-white hover:bg-white/5">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 luxury-scrollbar">
              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm font-bold text-white">Documentación</p>
                <p className="text-xs text-slate-400 mt-1">
                  Guías rápidas para configurar tu bot y conectar integraciones.
                </p>
                <Button variant="link" className="px-0 text-primary mt-2 font-bold" asChild>
                  <Link href="/docs">Ver documentación &rarr;</Link>
                </Button>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm font-bold text-white">Equipo de soporte</p>
                <p className="text-xs text-slate-400 mt-1">Escríbenos para activar integraciones o resolver dudas.</p>
                <div className="mt-3 space-y-1 text-xs text-slate-300 font-semibold">
                  <p>WhatsApp: +51 900 123 456</p>
                  <p>Email: soporte@syst.ai</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm font-bold text-white">Estado de la plataforma</p>
                <p className="text-xs text-slate-400 mt-1">Último chequeo: {new Date().toLocaleString()}</p>
                <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
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
    </div>
  )
}
