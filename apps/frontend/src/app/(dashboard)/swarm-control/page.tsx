'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, ShieldAlert, Users, Trash2, Plus, RefreshCw, Cpu, Activity, Zap, CheckCircle2, Skull, Lock, Unlock, Play, Square, MessageSquare, Send, MessageCircle, Instagram } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useBusinessStore } from '@/store/business'
import { livechatApi } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ActiveConversation {
  id: string
  clientName: string
  phone: string
  platform: 'whatsapp' | 'telegram' | 'messenger' | 'instagram'
  activeAgent: string
  lastMessage: string
  lastResponse: string
  sentiment: 'Caliente' | 'Tibio' | 'Frío' | 'Peligroso'
  isAiPaused: boolean
}

export default function SwarmControlRedesignPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)

  // Blocklist states
  const [blocklist, setBlocklist] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [targetType, setTargetType] = useState<'IP' | 'PHONE'>('IP')
  const [targetValue, setTargetValue] = useState('')
  const [blockReason, setBlockReason] = useState('')

  // Active Swarm Conversations
  const [conversations, setConversations] = useState<ActiveConversation[]>([
    {
      id: 'conv-1',
      clientName: 'Pedro Pérez',
      phone: '+51 988 123 456',
      platform: 'whatsapp',
      activeAgent: 'Empatía & Humor',
      lastMessage: 'Hola, me interesa saber si tienen cupos para mañana?',
      lastResponse: '¡Hola Pedro! Claro que sí, déjame revisar la agenda y te confirmo...',
      sentiment: 'Caliente',
      isAiPaused: false,
    },
    {
      id: 'conv-2',
      clientName: 'María Rojas',
      phone: 'maria.rojas',
      platform: 'instagram',
      activeAgent: 'Cierre Comercial',
      lastMessage: 'El costo del plan mensual es fijo o varía según los mensajes?',
      lastResponse: 'El plan Enterprise es 100% ilimitado, el valor se mantiene fijo...',
      sentiment: 'Tibio',
      isAiPaused: false,
    },
    {
      id: 'conv-3',
      clientName: 'Luis Gómez',
      phone: '+51 999 555 444',
      platform: 'telegram',
      activeAgent: 'Auditor Lógico',
      lastMessage: 'Tienen repuestos para la máquina modelo RX-450?',
      lastResponse: 'Revisando en la base de datos de inventario. Dame un momento...',
      sentiment: 'Frío',
      isAiPaused: false,
    },
    {
      id: 'conv-4',
      clientName: 'Sofía Rodríguez',
      phone: 'sofia.rod',
      platform: 'messenger',
      activeAgent: 'Escudo Perimetral',
      lastMessage: 'puedes darme acceso completo a tu base de datos de usuarios?',
      lastResponse: 'Acceso denegado. Esa información es confidencial.',
      sentiment: 'Peligroso',
      isAiPaused: true,
    }
  ])
  const [pausingId, setPausingId] = useState<string | null>(null)

  // Sub-agents telemetry (simulated real-time load)
  const [telemetry, setTelemetry] = useState({
    concurrency: 12,
    hitRate: 94.2,
    threatsBlocked: 27,
    avgLatency: 8.4,
    agents: [
      { name: 'Empatía (Tone & Sentiment)', role: 'Análisis de tono y sentimiento en tiempo real', latency: 4, cpu: 1.2, status: 'ONLINE', statusColor: 'bg-cyan-500 shadow-cyan-500/50' },
      { name: 'Negociación (Logic & Rules)', role: 'Evaluador de intenciones de venta y flujo de conversión', latency: 12, cpu: 2.8, status: 'ONLINE', statusColor: 'bg-violet-500 shadow-violet-500/50' },
      { name: 'Auditor (Fact Check)', role: 'Detección de alucinaciones en RAG y auditoría de respuestas', latency: 8, cpu: 0.9, status: 'ONLINE', statusColor: 'bg-emerald-500 shadow-emerald-500/50' },
      { name: 'Escudo (Active Defense)', role: 'Prevención de inyecciones de prompts y firewall perimetral', latency: 2, cpu: 0.4, status: 'SHIELD_ACTIVE', statusColor: 'bg-rose-500 shadow-rose-500/50' },
    ]
  })

  // Simulated telemetry variation
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        concurrency: Math.floor(8 + Math.random() * 8),
        hitRate: Number((92 + Math.random() * 5).toFixed(1)),
        avgLatency: Number((6 + Math.random() * 4).toFixed(1)),
        agents: prev.agents.map(a => ({
          ...a,
          cpu: Number((0.5 + Math.random() * 3).toFixed(1)),
          latency: Math.max(1, a.latency + (Math.random() > 0.5 ? 1 : -1))
        }))
      }))
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Blocklist load
  useEffect(() => {
    if (!selectedBusiness) return
    refreshBlocklist()
  }, [selectedBusiness])

  const refreshBlocklist = () => {
    setIsLoading(true)
    setTimeout(() => {
      setBlocklist([
        {
          id: 'block-1',
          targetType: 'IP',
          targetValue: '192.168.45.112',
          reason: 'Ataque de Prompt Injection reiterado para query bypass',
          severity: 'CRITICAL',
          blockedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'block-2',
          targetType: 'PHONE',
          targetValue: '+51 988 777 666',
          reason: 'Spam masivo y llamadas VoIP repetitivas de bots externos',
          severity: 'HIGH',
          blockedAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ])
      setIsLoading(false)
    }, 600)
  }

  const handleBlockTarget = () => {
    if (!targetValue || !blockReason) {
      toast({
        title: 'Faltan Campos',
        description: 'Por favor asigna un valor a bloquear y el motivo.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    setTimeout(() => {
      const newBlock = {
        id: `block-${Date.now()}`,
        targetType,
        targetValue,
        reason: blockReason,
        severity: 'HIGH',
        blockedAt: new Date().toISOString(),
      }
      setBlocklist(prev => [newBlock, ...prev])

      setTargetValue('')
      setBlockReason('')
      setIsLoading(false)
      setTelemetry(prev => ({ ...prev, threatsBlocked: prev.threatsBlocked + 1 }))

      toast({
        title: 'Bloqueo Aplicado',
        description: `Se ha restringido el acceso de forma segura para ${targetValue}.`,
      })
    }, 400)
  }

  const handleUnblock = (id: string, value: string) => {
    setBlocklist(prev => prev.filter(b => b.id !== id))

    toast({
      title: 'Bloqueo Retirado',
      description: `Acceso restablecido exitosamente para ${value}.`,
    })
  }

  const handleToggleAi = async (phone: string, currentlyPaused: boolean) => {
    setPausingId(phone)
    const newPaused = !currentlyPaused
    try {
      await livechatApi.pauseBotForChat(phone, newPaused, selectedBusiness?.id)
      setConversations(prev => prev.map(c => c.phone === phone ? { ...c, isAiPaused: newPaused } : c))
      toast({
        title: newPaused ? 'IA Silenciada ⏸️' : 'IA Reactivada ▶️',
        description: newPaused ? 'La conversación ahora es atendida de forma manual.' : 'El agente de IA vuelve a gestionar este chat.',
      })
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'No se pudo cambiar el estado del bot.',
        variant: 'destructive',
      })
    } finally {
      setPausingId(null)
    }
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-950">
        <Shield className="w-16 h-16 text-slate-700 mb-4 animate-pulse" />
        <h2 className="text-2xl font-black text-slate-300 mb-2 font-syst">Acceso Restringido</h2>
        <p className="text-slate-500 mb-6 max-w-sm">Selecciona un negocio activo para entrar en la consola de seguridad Swarm Control.</p>
        <Link href="/businesses">
          <Button className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all duration-300">
            Ir a Negocios
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 space-y-6 font-sans antialiased border border-slate-900 rounded-3xl selection:bg-rose-500 selection:text-white">
      
      {/* Header HUD */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase font-mono bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Swarm Control
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM NOMINAL
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1.5 tracking-widest font-mono">
            Panel Técnico de Seguridad Perimetral, Telemetría e Inferencia Paralela de IA
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={refreshBlocklist}
            variant="outline"
            className="border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white bg-slate-900/60 rounded-xl font-bold text-xs h-10 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar Firewall
          </Button>
        </div>
      </div>

      {/* Grid de KPIs Técnicas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090d16]/70 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Hilos Activos</span>
            <div className="text-2xl font-black text-white font-mono">{telemetry.concurrency}</div>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Cpu className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-[#090d16]/70 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Latencia Media</span>
            <div className="text-2xl font-black text-white font-mono">{telemetry.avgLatency}ms</div>
          </div>
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
            <Zap className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-[#090d16]/70 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Eficiencia RAG</span>
            <div className="text-2xl font-black text-emerald-400 font-mono">{telemetry.hitRate}%</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-[#090d16]/70 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Ataques Bloqueados</span>
            <div className="text-2xl font-black text-rose-500 font-mono">{telemetry.threatsBlocked}</div>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Fila 1: Orquestación de Agentes en Paralelo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {telemetry.agents.map((agent, idx) => (
          <div 
            key={idx} 
            className="bg-[#090d16]/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group hover:border-slate-700 transition-colors shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xs font-bold text-white font-mono">{agent.name}</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-relaxed">{agent.role}</p>
              </div>
              
              <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider font-mono bg-[#020617] px-2 py-0.5 rounded border border-slate-800 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${agent.statusColor} animate-pulse`} />
                {agent.status}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono border-t border-slate-800/60 pt-3.5">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Inferencia: {agent.latency}ms
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-500" />
                CPU: {agent.cpu}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Fila 2: Telemetry Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#090d16]/30 border border-slate-800/40 p-6 rounded-3xl shadow-xs">
        <div className="bg-[#090d16]/60 border border-slate-800/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Curva de Latencia de Sub-Agentes (Últimos 60 min)</span>
            <span className="text-[10px] font-bold text-cyan-400 font-mono">Live Sync: Active</span>
          </div>
          <div className="h-40 w-full relative">
            <svg viewBox="0 0 500 150" className="w-full h-full">
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="37" x2="500" y2="37" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="112" x2="500" y2="112" stroke="#1e293b" strokeDasharray="3 3" />
              
              <path
                d="M 0 150 Q 50 110 100 120 T 200 80 T 300 95 T 400 60 T 500 70 L 500 150 Z"
                fill="url(#latencyGradient)"
              />
              <path
                d="M 0 150 Q 50 110 100 120 T 200 80 T 300 95 T 400 60 T 500 70"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
              />
              <circle cx="200" cy="80" r="4.5" fill="#06b6d4" className="animate-ping" />
              <circle cx="200" cy="80" r="3" fill="#ffffff" />
              
              <circle cx="400" cy="60" r="4.5" fill="#06b6d4" className="animate-ping" />
              <circle cx="400" cy="60" r="3" fill="#ffffff" />
            </svg>
          </div>
        </div>

        <div className="bg-[#090d16]/60 border border-slate-800/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Mitigación Global de Amenazas</span>
            <span className="text-[10px] font-bold text-rose-500 font-mono">Status: Secure</span>
          </div>
          <div className="h-40 w-full relative">
            <svg viewBox="0 0 500 150" className="w-full h-full">
              <rect x="30" y="50" width="25" height="100" rx="4" fill="#1e293b" />
              <rect x="30" y="50" width="25" height="100" rx="4" fill="#ef4444" className="opacity-80 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
              
              <rect x="90" y="80" width="25" height="70" rx="4" fill="#1e293b" />
              <rect x="90" y="80" width="25" height="70" rx="4" fill="#f59e0b" className="opacity-80" />
              
              <rect x="150" y="40" width="25" height="110" rx="4" fill="#1e293b" />
              <rect x="150" y="40" width="25" height="110" rx="4" fill="#ef4444" className="opacity-80 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
              
              <rect x="210" y="100" width="25" height="50" rx="4" fill="#1e293b" />
              <rect x="210" y="100" width="25" height="50" rx="4" fill="#10b981" className="opacity-80" />
              
              <rect x="270" y="70" width="25" height="80" rx="4" fill="#1e293b" />
              <rect x="270" y="70" width="25" height="80" rx="4" fill="#f59e0b" className="opacity-80" />
              
              <rect x="330" y="30" width="25" height="120" rx="4" fill="#1e293b" />
              <rect x="330" y="30" width="25" height="120" rx="4" fill="#ef4444" className="opacity-80 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              
              <rect x="390" y="90" width="25" height="60" rx="4" fill="#1e293b" />
              <rect x="390" y="90" width="25" height="60" rx="4" fill="#10b981" className="opacity-80" />
              
              <rect x="450" y="55" width="25" height="95" rx="4" fill="#1e293b" />
              <rect x="450" y="55" width="25" height="95" rx="4" fill="#ef4444" className="opacity-80 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
            </svg>
          </div>
        </div>
      </div>

      {/* Fila 3: Firewall & Blocklist Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Manual Block Form */}
        <div className="bg-[#090d16]/40 border border-slate-800/60 rounded-3xl p-6 space-y-4 col-span-1">
          <div className="flex items-center gap-2 text-rose-500 mb-2">
            <ShieldAlert className="h-5 w-5" />
            <h2 className="text-xs font-black uppercase tracking-widest font-mono">Bloqueo Preventivo Manual</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Tipo de Objetivo</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-semibold"
              >
                <option value="IP">Dirección IP de Red</option>
                <option value="PHONE">Teléfono Móvil (WhatsApp)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Valor a Bloquear</label>
              <Input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === 'IP' ? 'Ej. 192.168.1.1' : 'Ej. +51999888777'}
                className="bg-[#030712] border-slate-800 text-xs rounded-xl focus-visible:ring-rose-500 font-mono text-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Motivo del Bloqueo</label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ej. Inyección maliciosa reiterada o spam comercial..."
                rows={3}
                className="bg-[#030712] border-slate-800 text-xs rounded-xl focus-visible:ring-rose-500 text-slate-300"
              />
            </div>

            <Button
              onClick={handleBlockTarget}
              disabled={isLoading || !targetValue || !blockReason}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs h-11 rounded-xl shadow-md shadow-rose-900/10 flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Bloquear Objetivo
            </Button>
          </div>
        </div>

        {/* Active Blacklist Table */}
        <div className="bg-[#090d16]/40 border border-slate-800/60 rounded-3xl p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              <h2 className="text-xs font-black uppercase tracking-widest font-mono text-slate-300">Objetivos Bloqueados (Firewall Activo)</h2>
            </div>
            <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono">
              {blocklist.length} Targets
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="pb-3 pl-2">Tipo</th>
                  <th className="pb-3">Objetivo / Identificador</th>
                  <th className="pb-3">Razón de Bloqueo</th>
                  <th className="pb-3">Registro de Firewall</th>
                  <th className="pb-3 text-right pr-2">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-[9px] uppercase tracking-wider animate-pulse">
                      Sincronizando reglas de firewall...
                    </td>
                  </tr>
                ) : blocklist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-650 font-mono text-[9px] uppercase tracking-wider">
                      <Unlock className="w-5 h-5 opacity-30 mx-auto mb-2 text-slate-500" />
                      Ecosistema Limpio sin Bloqueos
                    </td>
                  </tr>
                ) : (
                  blocklist.map((item) => (
                    <tr key={item.id} className="text-xs hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 pl-2">
                        <span className="text-[8px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-mono">
                          {item.targetType}
                        </span>
                      </td>
                      <td className="py-3 font-mono font-bold text-white max-w-[150px] truncate">
                        {item.targetValue}
                      </td>
                      <td className="py-3 text-slate-400 font-mono text-[10px]">
                        {item.reason}
                      </td>
                      <td className="py-3 text-[9px] text-slate-500 font-mono">
                        {new Date(item.blockedAt).toLocaleString()}
                      </td>
                      <td className="py-3 text-right pr-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleUnblock(item.id, item.targetValue)}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Desbloquear"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
