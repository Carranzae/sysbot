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
  Phone,
  Inbox
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/store/business'
import { Button } from '@/components/ui/button'

type NavItem = {
  title: string
  href?: string
  icon: any
  children?: NavItem[]
  isSubmenu?: boolean
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Omnicanal', href: '/omnichannel', icon: Inbox },
  { title: 'Mensajes', href: '/messages', icon: MessageSquare },
  { title: 'IA Studio', href: '/ai-studio', icon: Sparkles },
  { title: 'CRM', href: '/crm', icon: Users },
  { title: 'Swarm Control', href: '/swarm-control', icon: Activity },
]

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

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 xl:w-80 h-screen sticky top-0 flex-col bg-luxury-glass border-r border-slate-200/50 overflow-hidden z-50">
      <div className="px-6 pt-8 pb-6 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <img src="/sybot_logo.png" alt="Sybot Logo" className="h-10 w-10 object-contain rounded-xl shadow-sm bg-white p-1 border border-slate-100" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-blue-950 font-syst">Sybot AI</h1>
            <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase font-syst">ENTERPRISE HUB</p>
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

      <div className="px-4 py-5 border-t border-slate-200/50 bg-slate-50/50 backdrop-blur-md space-y-4">
        {/* Navigation items for integrations and billing */}
        <div className="space-y-1">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-300 text-slate-600 hover:text-primary hover:bg-slate-100/50',
              pathname === '/settings' && 'text-primary bg-primary/10 border-primary/20'
            )}
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span className="font-syst">Integrations</span>
          </Link>

          <Link
            href="/settings?tab=billing"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-300 text-slate-600 hover:text-primary hover:bg-slate-100/50"
          >
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span className="font-syst">Billing</span>
          </Link>
        </div>

        {/* Upgrade Plan Button */}
        <div className="pt-1">
          <Link href="/settings?tab=billing">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3 text-xs tracking-wide shadow-sm hover:shadow-md transition-all duration-300 font-syst h-11">
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
