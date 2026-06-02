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
        { label: 'Sistema', value: 'Operativo', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Base de Datos', value: 'Activa', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Seguridad', value: 'Normal', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    ]

    const quickActions = [
        { label: 'Ver todos los usuarios', icon: Users, href: '/admin/users', description: 'Gestionar cuentas y permisos' },
        { label: 'Analíticas del sistema', icon: BarChart3, href: '/admin/analytics', description: 'Métricas y reportes' },
        { label: 'Configuración global', icon: Settings, href: '/admin/config', description: 'Parámetros del sistema' },
        { label: 'Logs de seguridad', icon: Shield, href: '/admin/security', description: 'Auditoría y monitoreo' },
    ]

    return (
        <>
            <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-8 py-4 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <p className="text-xs uppercase text-gray-500 tracking-[0.2em]">Panel de Super Administrador</p>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-gray-500 font-mono">{currentTime.toLocaleString('es-ES')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">SYST Control Center</h1>
                            <p className="text-sm text-gray-600">Gestión completa del sistema</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {systemStats.map((stat) => {
                                const Icon = stat.icon
                                return (
                                    <div
                                        key={stat.label}
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all hover:shadow-md',
                                            stat.bg,
                                            'border-gray-200'
                                        )}
                                    >
                                        <Icon className={cn('h-4 w-4', stat.color)} />
                                        <div className="text-left">
                                            <p className="text-xs text-gray-500">{stat.label}</p>
                                            <p className={cn('text-xs font-semibold', stat.color)}>{stat.value}</p>
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
                        className="gap-2 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                        onClick={() => setQuickActionsOpen(true)}
                    >
                        <Zap className="h-4 w-4" />
                        <span className="hidden lg:inline">Acciones Rápidas</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                        onClick={() => router.push('/admin/notifications')}
                    >
                        <Bell className="h-4 w-4" />
                        <span className="hidden lg:inline">Alertas</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
                        onClick={() => router.push('/admin/config')}
                    >
                        <Settings className="h-4 w-4" />
                        <span className="hidden lg:inline">Configuración</span>
                    </Button>

                    <div className="flex items-center gap-3 border-l pl-4 ml-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center text-sm font-bold shadow-lg ring-2 ring-red-200">
                            {userInitials}
                        </div>
                        <div className="leading-tight">
                            <p className="text-sm font-bold text-gray-900">
                                {user ? `${user.firstName} ${user.lastName}` : 'Super Admin'}
                            </p>
                            <p className="text-xs font-semibold text-red-600">SUPER ADMINISTRADOR</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-sm hover:bg-red-50 hover:text-red-600"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden xl:inline">Salir</span>
                        </Button>
                    </div>
                </div>
            </header>

            {quickActionsOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setQuickActionsOpen(false)}>
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800">
                            <div>
                                <p className="text-xs uppercase text-slate-400 tracking-wide">Super Admin</p>
                                <p className="text-lg font-bold text-white">Acciones Rápidas</p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setQuickActionsOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-6">
                            {quickActions.map((action) => {
                                const Icon = action.icon
                                return (
                                    <button
                                        key={action.label}
                                        className="flex items-start gap-4 rounded-xl border border-gray-200 p-4 text-left hover:border-primary hover:bg-primary/5 transition-all hover:shadow-md"
                                        onClick={() => {
                                            router.push(action.href)
                                            setQuickActionsOpen(false)
                                        }}
                                    >
                                        <div className="rounded-lg bg-slate-100 p-2">
                                            <Icon className="h-5 w-5 text-slate-700" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900">{action.label}</p>
                                            <p className="text-sm text-gray-500 mt-1">{action.description}</p>
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
