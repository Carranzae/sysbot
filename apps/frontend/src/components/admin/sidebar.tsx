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
        <aside className="hidden md:flex md:w-64 lg:w-72 xl:w-80 h-screen sticky top-0 flex-col bg-luxury-glass border-r border-slate-200/50 overflow-hidden z-50 text-slate-800 font-syst">
            <div className="px-6 pt-8 pb-6 border-b border-slate-200/50">
                <div className="flex items-center gap-3">
                    <img src="/sybot_logo.png" alt="Sybot Logo" className="h-10 w-10 object-contain rounded-xl shadow-sm bg-white p-1 border border-slate-100" />
                    <div>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-800 font-syst">Sybot Admin</h1>
                        <p className="text-[9px] font-black tracking-widest text-primary uppercase font-syst">Control Total</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                <ul className="space-y-1.5">
                    {adminNav.map((item) => {
                        const Icon = item.icon
                        const active = pathname === item.href
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-300 relative group border border-transparent',
                                        active 
                                            ? 'bg-primary/10 text-primary border-primary/20 shadow-[0_4px_12px_rgba(29,78,216,0.05)] font-syst' 
                                            : 'text-slate-600 hover:text-primary hover:bg-slate-100/50'
                                    )}
                                >
                                    <Icon className={cn('h-4 w-4 transition-transform duration-300 group-hover:scale-105', active ? 'text-primary' : 'text-slate-500 group-hover:text-primary')} />
                                    <span className="font-syst">{item.title}</span>
                                    {active && (
                                        <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary" />
                                    )}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            <div className="px-4 py-6 border-t border-slate-200/50 bg-slate-50/50 backdrop-blur-md">
                <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-1">Sesión de Super Admin</p>
                    <p className="text-xs font-bold text-red-600 mt-1 uppercase tracking-wide">
                        Acceso Irrestricto
                    </p>
                </div>
            </div>
        </aside>
    )
}
