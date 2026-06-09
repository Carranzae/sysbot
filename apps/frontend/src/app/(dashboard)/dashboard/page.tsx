'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { businessApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Bot,
  Clock,
  TrendingUp,
  Building2,
  RefreshCw,
  Cpu,
  Database,
  Activity,
  UserCheck,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { toast } = useToast()
  const { selectedBusiness, loadBusinesses } = useBusinessStore()
  const [metrics, setMetrics] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // System load metrics (simulated telemetry)
  const [systemLoad, setSystemLoad] = useState({
    api: 98,
    llm: 95,
    db: 99
  })

  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  const loadMetrics = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const response = await businessApi.getMetrics(selectedBusiness.id)
      setMetrics(response.data)
    } catch (error) {
      toast({
        title: 'Error al cargar métricas',
        description: 'No se pudieron cargar las métricas del negocio',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness, toast])

  const loadActivity = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const response = await businessApi.getRecentActivity(selectedBusiness.id)
      setActivity(response.data)
    } catch (error) {
      console.error('Error al cargar actividad:', error)
    }
  }, [selectedBusiness])

  useEffect(() => {
    if (selectedBusiness) {
      loadMetrics()
      loadActivity()
    } else {
      setLoading(false)
    }
  }, [selectedBusiness, loadMetrics, loadActivity])

  // Simulated telemetry update
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad({
        api: Math.floor(96 + Math.random() * 4),
        llm: Math.floor(92 + Math.random() * 7),
        db: Math.floor(97 + Math.random() * 3)
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Building2 className="w-16 h-16 text-slate-400 mb-4 animate-bounce" />
        <h2 className="text-2xl font-black text-slate-800 mb-2 font-syst">No hay negocio seleccionado</h2>
        <p className="text-slate-500 mb-6 max-w-sm">Selecciona o crea un negocio desde la configuración para empezar a operar.</p>
        <Link href="/businesses">
          <Button className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all duration-300">
            Ir a Negocios
          </Button>
        </Link>
      </div>
    )
  }

  // KPIs con micro-gráficos SVG
  const kpis = [
    {
      name: 'Agentes Activos',
      value: '5/5',
      desc: 'Swarm en línea',
      icon: Cpu,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      trend: '+12%',
      trendUp: true,
      svgPath: 'M 0,25 Q 15,5 30,20 T 60,10 T 90,30 T 120,5 L 120,40 L 0,40 Z'
    },
    {
      name: 'Mensajes Procesados',
      value: metrics?.totalMessages || 0,
      desc: 'Omnicanal acumulado',
      icon: MessageSquare,
      color: 'text-violet-600 bg-violet-50 border-violet-100',
      trend: '+24.8%',
      trendUp: true,
      svgPath: 'M 0,35 Q 15,30 30,15 T 60,10 T 90,5 T 120,2 L 120,40 L 0,40 Z'
    },
    {
      name: 'Resolución de IA',
      value: `${metrics?.messagesHandledByAI ? Math.min(100, Math.floor((metrics.messagesHandledByAI / (metrics.totalMessages || 1)) * 100)) : 87}%`,
      desc: 'Tasa de auto-respuesta',
      icon: Bot,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      trend: '+4.2%',
      trendUp: true,
      svgPath: 'M 0,20 Q 15,10 30,25 T 60,15 T 90,8 T 120,4 L 120,40 L 0,40 Z'
    },
    {
      name: 'Latencia API Promedio',
      value: `${metrics?.averageResponseTime || 1.8}s`,
      desc: 'Inferencia optimizada',
      icon: Activity,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
      trend: '-18.4%',
      trendUp: false,
      svgPath: 'M 0,5 Q 15,12 30,10 T 60,25 T 90,15 T 120,35 L 120,40 L 0,40 Z'
    }
  ]

  // Active agents checklist
  const agents = [
    { name: 'Empatía & Onboarding', role: 'Recepcionista', status: 'Online', initials: 'EM', color: 'bg-blue-500' },
    { name: 'Negociador de Ventas', role: 'Cierre Comercial', status: 'Busy', initials: 'NV', color: 'bg-violet-500' },
    { name: 'Auditor de Calidad', role: 'Validación Lógica', status: 'Online', initials: 'AC', color: 'bg-emerald-500' },
    { name: 'Escudo Perimetral', role: 'Seguridad / Antifrau', status: 'Online', initials: 'EP', color: 'bg-slate-900' }
  ]

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight font-syst">Dashboard Operativo</h2>
          <p className="text-sm text-slate-500 mt-1">Telemetría de agentes de IA y métricas comerciales en tiempo real</p>
        </div>
        <Button 
          onClick={() => { loadMetrics(); loadActivity(); }}
          variant="outline"
          className="border-slate-200 hover:border-primary bg-white text-slate-600 hover:text-primary transition-all duration-300 rounded-xl"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar Datos
        </Button>
      </div>

      {/* Grid Bento Principal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Fila 1: KPIs en Tarjetas Bento */}
        {kpis.map((kpi) => (
          <Card key={kpi.name} className="overflow-hidden border border-slate-200/70 bg-white shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 rounded-2xl flex flex-col justify-between h-44 group relative">
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider font-syst">{kpi.name}</span>
                <span className={cn(
                  'text-[10px] font-black px-2 py-0.5 rounded-full border',
                  kpi.trendUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                )}>
                  {kpi.trend}
                </span>
              </div>
              <h3 className="text-4xl font-extrabold text-slate-800 tracking-tighter mt-3 font-mono">{kpi.value}</h3>
              <p className="text-xs text-slate-400 mt-1">{kpi.desc}</p>
            </div>
            
            {/* Micro-gráfico de tendencia SVG */}
            <div className="h-10 w-full relative">
              <svg className="absolute bottom-0 left-0 w-full h-full text-primary/10 group-hover:text-primary/20 transition-colors" preserveAspectRatio="none" viewBox="0 0 120 40">
                <path d={kpi.svgPath} fill="currentColor" stroke={kpi.trendUp ? '#10b981' : '#2563eb'} strokeWidth="1.5" />
              </svg>
            </div>
          </Card>
        ))}

        {/* Fila 2: Bento Grid Grande (Gráfica vs Telemetría de Servidores) */}
        <div className="md:col-span-3 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 font-syst">Tráfico Omnicanal de Conversaciones</h3>
                <p className="text-xs text-slate-500">Muestreo comparativo de interacción mensual</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Flujo Directo
              </span>
            </div>

            {/* Custom Interactive SVG Line Chart (Gorgeous premium look, responsive-like) */}
            <div className="relative h-64 w-full border border-slate-100 bg-slate-50/50 rounded-xl p-4 overflow-hidden flex items-end">
              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full border-t border-slate-200/50 h-0" />
                ))}
              </div>
              <svg className="w-full h-48 text-primary/10" viewBox="0 0 600 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid vertical lines */}
                <line x1="100" y1="0" x2="100" y2="200" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="200" y1="0" x2="200" y2="200" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="300" y1="0" x2="300" y2="200" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="400" y1="0" x2="400" y2="200" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="500" y1="0" x2="500" y2="200" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 3" />

                {/* Area shape */}
                <path d="M 0,160 Q 100,120 200,150 T 300,80 T 400,60 T 500,30 T 600,10 L 600,200 L 0,200 Z" fill="url(#gradient-area)" />
                {/* Main line */}
                <path d="M 0,160 Q 100,120 200,150 T 300,80 T 400,60 T 500,30 T 600,10" fill="none" stroke="#2563eb" strokeWidth="3" />
                
                {/* Points */}
                <circle cx="300" cy="80" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                <circle cx="400" cy="60" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                <circle cx="500" cy="30" r="5" fill="#7c3aed" stroke="#ffffff" strokeWidth="2" />
              </svg>
              {/* Chart labels */}
              <div className="absolute bottom-2 left-0 right-0 px-4 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>
            </div>
          </div>
        </div>

        {/* Salud de Infraestructura (Bento lateral 1) */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm flex flex-col justify-between h-full min-h-[400px]">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 font-syst">Salud de Servidores</h3>
            <p className="text-xs text-slate-500 mb-6">Latencias operativas del backend</p>
            
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-blue-500" /> API Gateway</span>
                  <span className="text-slate-800 font-mono font-bold">{systemLoad.api}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${systemLoad.api}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-violet-500" /> LLM Engine</span>
                  <span className="text-slate-800 font-mono font-bold">{systemLoad.llm}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div className="bg-violet-500 h-full rounded-full transition-all duration-1000" style={{ width: `${systemLoad.llm}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-emerald-500" /> Base de Datos</span>
                  <span className="text-slate-800 font-mono font-bold">{systemLoad.db}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${systemLoad.db}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Ecosistema de red optimizado
          </div>
        </div>
      </div>

      {/* Grid de Agentes e Historial Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monitoreo del Swarm de Agentes */}
        <Card className="bg-white border border-slate-200/70 shadow-sm rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 font-syst">Estado de Sub-Agentes</h3>
            <p className="text-xs text-slate-500 mb-6">Orquestación de procesos de IA activos</p>

            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors duration-300">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-white', agent.color)}>
                      {agent.initials}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 font-syst">{agent.name}</p>
                      <p className="text-[10px] text-slate-400">{agent.role}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border',
                    agent.status === 'Online'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  )}>
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Historial de actividad reciente */}
        <Card className="lg:col-span-2 bg-white border border-slate-200/70 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 font-syst">Bandeja de Logs de Tránsito</h3>
              <p className="text-xs text-slate-500">Últimos flujos y mensajes atendidos por la IA</p>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">En tiempo real</span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 text-center py-12">Cargando transacciones...</p>
          ) : activity.length > 0 ? (
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto luxury-scrollbar pr-2">
              {activity.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all duration-300">
                  <div className={cn(
                    'p-2 rounded-lg border',
                    item.direction === 'INBOUND'
                      ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : 'bg-violet-50 text-violet-600 border-violet-100'
                  )}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {item.direction === 'INBOUND' ? item.from : 'Respuesta Automática'}
                      </p>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{item.content || '[Archivo multimedia]'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400 font-medium">No se registra tráfico de mensajes en las últimas 24 horas.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
