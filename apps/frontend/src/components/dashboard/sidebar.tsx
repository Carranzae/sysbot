'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Building2,
  FileText,
  MessageSquare,
  Settings,
  CalendarCheck,
  ShoppingBag,
  Utensils,
  Stethoscope,
  GraduationCap,
  HomeIcon,
  Users,
  Wrench,
  Activity,
  Sparkles,
  Send,
  Radio,
  Database,
  ChevronDown,
  ChevronRight,
  CreditCard,
  UserCheck,
  TrendingUp,
  BarChart3,
  PieChart,
  DollarSign,
  Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/store/business'

type NavItem = {
  title: string
  href?: string
  icon: any
  children?: NavItem[]
  isSubmenu?: boolean
}

const baseNav: NavItem[] = [
  { title: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Mensajes', href: '/messages', icon: MessageSquare },
  { title: 'Bot Builder', href: '/bot-builder', icon: Sparkles },
  { title: 'Canales', href: '/channels', icon: Radio },
  { title: 'Conocimiento', href: '/files', icon: FileText },
  { title: 'CRM', href: '/leads', icon: Users },
  { title: 'Call Center', href: '/crm/call-center', icon: Phone },
  { title: 'Swarm Control', href: '/swarm-control', icon: Activity },
  { title: 'Configuración', href: '/settings', icon: Settings },
  { title: 'Suscripción', href: '/dashboard/subscription', icon: CreditCard },
]

const industryNav: Record<string, NavItem[]> = {
  RESTAURANT: [
    { title: 'Pedidos', href: '/orders', icon: Utensils },
    { title: 'Leads', href: '/leads', icon: Users },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  RETAIL: [
    { title: 'Pedidos', href: '/orders', icon: ShoppingBag },
    { title: 'Leads', href: '/leads', icon: Users },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  SERVICES: [
    { title: 'Citas', href: '/appointments', icon: CalendarCheck },
    { title: 'Leads', href: '/leads', icon: Users },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  CLINIC: [
    { title: 'Citas', href: '/appointments', icon: Stethoscope },
    { title: 'Control Clínico', href: '/clinic', icon: Activity },
    { title: 'Notificaciones', href: '/notifications', icon: Activity },
    { title: 'Recomendaciones', href: '/recommendations', icon: Send },
  ],
  ACADEMY: [
    { title: 'Citas', href: '/appointments', icon: GraduationCap },
    { title: 'Leads', href: '/leads', icon: Users },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  REAL_ESTATE: [
    { title: 'Leads', href: '/leads', icon: HomeIcon },
    { title: 'Mensajes', href: '/messages', icon: MessageSquare },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  AUTOMOTIVE: [
    { title: 'Pedidos', href: '/orders', icon: ShoppingBag },
    { title: 'Citas', href: '/appointments', icon: CalendarCheck },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  TECHNOLOGY: [
    { title: 'Pedidos', href: '/orders', icon: Wrench },
    { title: 'Leads', href: '/leads', icon: Users },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
  OTHER: [
    { title: 'Citas', href: '/appointments', icon: CalendarCheck },
    { title: 'Leads', href: '/leads', icon: Users },
    { title: 'Recomendaciones', href: '/recommendations', icon: Sparkles },
  ],
}

function mergeNav(base: NavItem[], extra: NavItem[]) {
  const map = new Map<string, NavItem>()
  base.forEach((item) => {
    if (item.href) map.set(item.href, item)
  })
  extra.forEach((item) => {
    if (!map.has(item.href || '')) {
      map.set(item.href || '', item)
    }
  })
  return Array.from(map.values())
}

function SimpleNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon
  const active = pathname === item.href

  return (
    <li>
      <Link
        href={item.href || ''}
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
}

export function Sidebar() {
  const pathname = usePathname()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)

  const navItems = mergeNav(baseNav, selectedBusiness ? industryNav[selectedBusiness.industryType] ?? [] : [])

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 xl:w-80 h-screen sticky top-0 flex-col bg-luxury-glass border-r border-slate-200/50 overflow-hidden z-50">
      <div className="px-6 pt-8 pb-6 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <img src="/sybot_logo.png" alt="Sybot Logo" className="h-10 w-10 object-contain rounded-xl shadow-sm bg-white p-1 border border-slate-100" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800 font-syst">Sybot</h1>
            <p className="text-[9px] font-black tracking-widest text-primary uppercase font-syst">Enterprise AI</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        <ul className="space-y-1.5">
          {navItems.map((item) => (
            <SimpleNavItem key={item.href || item.title || 'nav-item'} item={item} pathname={pathname || ''} />
          ))}
        </ul>
      </nav>

      <div className="px-4 py-6 border-t border-slate-200/50 bg-slate-50/50 backdrop-blur-md">
        {selectedBusiness ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Negocio Activo</p>
            <p className="text-base font-extrabold text-slate-800 truncate font-syst">{selectedBusiness.name}</p>
            <p className="text-xs font-bold text-primary mt-0.5">
              {selectedBusiness.industryType.replace('_', ' ')}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedBusiness.categories.slice(0, 3).map((category) => (
                <span
                  key={category}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide font-syst"
                >
                  {category}
                </span>
              ))}
              {selectedBusiness.categories.length > 3 && (
                <span className="text-[10px] text-slate-400 font-bold">+{selectedBusiness.categories.length - 3}</span>
              )}
            </div>
            <Link
              href="/businesses"
              className="mt-4 inline-flex items-center text-xs font-bold text-primary hover:underline transition-colors group"
            >
              <span>Cambiar o configurar</span>
              <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-xs font-bold text-slate-500 shadow-sm">
            No has configurado ningún negocio.{' '}
            <Link href="/businesses" className="text-primary hover:underline">
              Configura el primero
            </Link>
            .
          </div>
        )}
      </div>
    </aside>
  )
}
