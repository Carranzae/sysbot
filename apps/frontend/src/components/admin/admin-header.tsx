'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Settings, Bell, Activity, Database, Shield, Zap, Users, BarChart3, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function AdminHeader() {
    const router = useRouter()
    const { user, logout } = useAuthStore()
    const [quickActionsOpen, setQuickActionsOpen] = useState(false)
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const userInitials = useMemo(() => {
        if (!user) return 'SA'
        const first = user.firstName?.charAt(0) ?? ''
        const last = user.lastName?.charAt(0) ?? ''
        return `${first}${last}`.toUpperCase() || 'SA'
    }, [user])

    const handleLogout = () => {
        logout()
        router.push('/admin/login')
    }

    const systemStats = [
        { label: 'Sistema', value: 'Operativo', icon: Activity, color: 'text-emerald-500', bg: 'bg-slate-50 border-slate-100 hover:bg-emerald-50/20 hover:border-emerald-100' },
        { label: 'Base de Datos', value: 'Activa', icon: Database, color: 'text-blue-500', bg: 'bg-slate-50 border-slate-100 hover:bg-blue-50/20 hover:border-blue-100' },
        { label: 'Seguridad', value: 'Normal', icon: Shield, color: 'text-purple-500', bg: 'bg-slate-50 border-slate-100 hover:bg-purple-50/20 hover:border-purple-100' },
    ]

    const quickActions = [
        { label: 'Ver todos los usuarios', icon: Users, href: '/admin/users', description: 'Gestionar cuentas y permisos' },
        { label: 'Analíticas del sistema', icon: BarChart3, href: '/admin/analytics', description: 'Métricas y reportes' },
        { label: 'Configuración global', icon: Settings, href: '/admin/config', description: 'Parámetros del sistema' },
        { label: 'Logs de seguridad', icon: Shield, href: '/admin/security', description: 'Auditoría y monitoreo' },
    ]

    return (
        <>
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/50 bg-luxury-glass px-8 py-4 backdrop-blur-md">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] font-syst">Panel de Super Administrador</p>
                        <span className="text-xs text-slate-300 font-mono">•</span>
                        <p className="text-xs text-slate-500 font-mono">{currentTime.toLocaleString('es-ES')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-800 font-syst leading-none">Sybot Control Center</h1>
                            <p className="text-xs font-semibold text-slate-500 mt-1 font-syst">Gestión completa del sistema</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {systemStats.map((stat) => {
                                const Icon = stat.icon
                                return (
                                    <div
                                        key={stat.label}
                                        className={cn(
                                            'flex items-center gap-3.5 rounded-2xl border px-3.5 py-1.5 transition-all hover:shadow-sm shadow-none',
                                            stat.bg
                                        )}
                                    >
                                        <Icon className={cn('h-4 w-4', stat.color)} />
                                        <div className="text-left leading-tight">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase font-syst">{stat.label}</p>
                                            <p className={cn('text-xs font-extrabold font-syst', stat.color)}>{stat.value}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl font-bold font-syst shadow-sm"
                        onClick={() => setQuickActionsOpen(true)}
                    >
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="hidden lg:inline">Acciones Rápidas</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl font-bold font-syst shadow-sm"
                        onClick={() => router.push('/admin/notifications')}
                    >
                        <Bell className="h-4 w-4 text-blue-500" />
                        <span className="hidden lg:inline">Alertas</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl font-bold font-syst shadow-sm"
                        onClick={() => router.push('/admin/config')}
                    >
                        <Settings className="h-4 w-4 text-purple-500" />
                        <span className="hidden lg:inline">Configuración</span>
                    </Button>

                    <div className="flex items-center gap-3 border-l border-slate-200 pl-4 ml-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-sm font-black shadow-sm font-syst">
                            {userInitials}
                        </div>
                        <div className="leading-tight">
                            <p className="text-sm font-extrabold text-slate-800 font-syst">
                                {user ? `${user.firstName} ${user.lastName}` : 'Super Admin'}
                            </p>
                            <p className="text-[10px] font-black text-red-500 tracking-wider font-syst">SUPER ADMINISTRADOR</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-sm hover:bg-red-50 hover:text-red-600 rounded-xl font-syst"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden xl:inline">Salir</span>
                        </Button>
                    </div>
                </div>
            </header>

            {quickActionsOpen && (
                <div className="fixed inset-0 z-45 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setQuickActionsOpen(false)}>
                    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-syst">Super Admin</p>
                                <p className="text-lg font-extrabold text-slate-800 font-syst">Acciones Rápidas</p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl" onClick={() => setQuickActionsOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-6">
                            {quickActions.map((action) => {
                                const Icon = action.icon
                                return (
                                    <button
                                        key={action.label}
                                        className="flex items-start gap-4 rounded-2xl border border-slate-100 p-4 text-left hover:border-primary/45 hover:bg-primary/5 transition-all hover:shadow-md duration-300"
                                        onClick={() => {
                                            router.push(action.href)
                                            setQuickActionsOpen(false)
                                        }}
                                    >
                                        <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                                            <Icon className="h-5 w-5 text-slate-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 font-syst">{action.label}</p>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed font-syst">{action.description}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
