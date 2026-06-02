'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    Settings,
    Shield,
    Server,
    Activity,
    Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'

const adminNav = [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { title: 'Motor de IA', href: '/admin/ai-engine', icon: Brain },
    { title: 'Monitoreo Avanzado', href: '/admin/monitoring', icon: Activity },
    { title: 'Analíticas PRO', href: '/admin/analytics', icon: LayoutDashboard },
    { title: 'Usuarios y Negocios', href: '/admin/users', icon: Users },
    { title: 'Notificaciones', href: '/admin/notifications', icon: Server },
    { title: 'Seguridad y Logs', href: '/admin/security', icon: Shield },
    { title: 'Configuración Global', href: '/admin/config', icon: Settings },
]

export function AdminSidebar() {
    const pathname = usePathname()

    return (
        <aside className="hidden md:flex md:w-64 lg:w-72 xl:w-80 h-screen sticky top-0 flex-col border-r bg-slate-900 text-white">
            <div className="px-6 pt-8 pb-6 border-b border-slate-800">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Panel de Control</div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Server className="h-6 w-6 text-red-500" />
                    SUPER ADMIN
                </h1>
                <p className="text-sm text-slate-400 mt-1">Control Total</p>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6">
                <ul className="space-y-1">
                    {adminNav.map((item) => {
                        const Icon = item.icon
                        const active = pathname === item.href
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        active ? 'bg-red-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    )}
                                >
                                    <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-slate-400')} />
                                    {item.title}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            <div className="px-4 py-6 border-t border-slate-800 bg-slate-900">
                <div className="rounded-lg border border-slate-700 p-4 bg-slate-800/50">
                    <p className="text-xs text-slate-400">Sesión de Super Admin</p>
                    <p className="text-xs text-red-400 mt-1 font-bold">ACCESO IRRESTRICTO</p>
                </div>
            </div>
        </aside>
    )
}
