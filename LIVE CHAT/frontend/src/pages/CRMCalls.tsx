import { useState, useMemo } from 'react'
import {
  Phone,
  PhoneOff,
  PhoneMissed,
  Clock,
  Star,
  Search,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'COMPLETED' | 'MISSED' | 'BUSY' | 'FAILED'
type Sentiment = 'Positivo' | 'Neutral' | 'Negativo'

interface CallEntry {
  id: string
  contact: string
  phone: string
  duration: string
  status: CallStatus
  resolved: boolean
  sentiment: Sentiment
  date: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_CALLS: CallEntry[] = [
  { id: '1', contact: 'María García', phone: '+51 912 345 678', duration: '4:32', status: 'COMPLETED', resolved: true, sentiment: 'Positivo', date: '2026-06-02 11:42' },
  { id: '2', contact: 'Carlos Mendoza', phone: '+51 987 654 321', duration: '2:15', status: 'COMPLETED', resolved: true, sentiment: 'Neutral', date: '2026-06-02 11:18' },
  { id: '3', contact: 'Ana Rodríguez', phone: '+51 945 678 123', duration: '0:00', status: 'MISSED', resolved: false, sentiment: 'Negativo', date: '2026-06-02 10:55' },
  { id: '4', contact: 'Jorge Castillo', phone: '+51 923 456 789', duration: '6:48', status: 'COMPLETED', resolved: true, sentiment: 'Positivo', date: '2026-06-02 10:30' },
  { id: '5', contact: 'Lucía Fernández', phone: '+51 911 222 333', duration: '0:45', status: 'BUSY', resolved: false, sentiment: 'Neutral', date: '2026-06-02 09:58' },
  { id: '6', contact: 'Roberto Díaz', phone: '+51 933 444 555', duration: '0:00', status: 'FAILED', resolved: false, sentiment: 'Negativo', date: '2026-06-02 09:22' },
  { id: '7', contact: 'Patricia Vargas', phone: '+51 955 666 777', duration: '3:17', status: 'COMPLETED', resolved: false, sentiment: 'Negativo', date: '2026-06-01 18:45' },
  { id: '8', contact: 'Fernando López', phone: '+51 977 888 999', duration: '5:03', status: 'COMPLETED', resolved: true, sentiment: 'Positivo', date: '2026-06-01 17:12' },
  { id: '9', contact: 'Sofía Herrera', phone: '+51 900 111 222', duration: '1:28', status: 'COMPLETED', resolved: true, sentiment: 'Neutral', date: '2026-06-01 15:30' },
  { id: '10', contact: 'Diego Morales', phone: '+51 966 333 444', duration: '0:00', status: 'MISSED', resolved: false, sentiment: 'Negativo', date: '2026-06-01 14:05' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusConfig: Record<CallStatus, { label: string; bg: string; text: string; dot: string }> = {
  COMPLETED: { label: 'Completada', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  MISSED:    { label: 'Perdida',    bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  BUSY:      { label: 'Ocupado',    bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  FAILED:    { label: 'Fallida',    bg: 'bg-rose-500/10',    text: 'text-rose-400',     dot: 'bg-rose-400' },
}

const sentimentColor: Record<Sentiment, string> = {
  Positivo: 'text-emerald-400',
  Neutral:  'text-slate-400',
  Negativo: 'text-rose-400',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CRMCalls() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return MOCK_CALLS
    const q = search.toLowerCase()
    return MOCK_CALLS.filter(
      (c) =>
        c.contact.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.status.toLowerCase().includes(q)
    )
  }, [search])

  // ── KPI calculations ──
  const totalCalls = MOCK_CALLS.length
  const resolved = MOCK_CALLS.filter((c) => c.resolved).length
  const resolutionRate = Math.round((resolved / totalCalls) * 100)
  const avgDurationSec =
    MOCK_CALLS.reduce((acc, c) => {
      const parts = c.duration.split(':')
      return acc + parseInt(parts[0]) * 60 + parseInt(parts[1])
    }, 0) / totalCalls
  const avgMinutes = Math.floor(avgDurationSec / 60)
  const avgSeconds = Math.round(avgDurationSec % 60)
  const avgRating = 4.2

  const kpis = [
    {
      label: 'Total Llamadas',
      value: totalCalls.toString(),
      change: '+12%',
      up: true,
      icon: Phone,
      color: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-500/20',
    },
    {
      label: 'Tasa de Resolución',
      value: `${resolutionRate}%`,
      change: '+5%',
      up: true,
      icon: CheckCircle2,
      color: 'from-sky-500 to-blue-500',
      shadow: 'shadow-sky-500/20',
    },
    {
      label: 'Duración Promedio',
      value: `${avgMinutes}:${avgSeconds.toString().padStart(2, '0')}`,
      change: '-8s',
      up: false,
      icon: Clock,
      color: 'from-violet-500 to-purple-500',
      shadow: 'shadow-violet-500/20',
    },
    {
      label: 'Calificación Promedio',
      value: avgRating.toFixed(1),
      change: '+0.3',
      up: true,
      icon: Star,
      color: 'from-amber-500 to-orange-500',
      shadow: 'shadow-amber-500/20',
    },
  ]

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CRM Llamadas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Historial y métricas del sistema telefónico
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 rounded-xl text-sm text-slate-300 transition-all">
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`relative overflow-hidden rounded-2xl bg-slate-900/60 border border-white/5 p-5 transition-all hover:border-white/10 ${kpi.shadow}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {kpi.label}
                </p>
                <p className="text-3xl font-bold text-white mt-2">{kpi.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {kpi.up ? (
                    <ArrowUpRight size={14} className="text-emerald-400" />
                  ) : (
                    <ArrowDownRight size={14} className="text-rose-400" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      kpi.up ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {kpi.change}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">vs ayer</span>
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shadow-lg ${kpi.shadow}`}
              >
                <kpi.icon size={20} className="text-white" />
              </div>
            </div>
            {/* Subtle glow */}
            <div
              className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${kpi.color} opacity-[0.04] blur-2xl`}
            />
          </div>
        ))}
      </div>

      {/* ── Search Bar ── */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Buscar por contacto, teléfono o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all"
          />
        </div>
      </div>

      {/* ── Call Logs Table ── */}
      <div className="rounded-2xl bg-slate-900/60 border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Duración
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Resolución
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sentimiento
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map((call) => {
                const st = statusConfig[call.status]
                return (
                  <tr
                    key={call.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Contact */}
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-white">{call.contact}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{call.phone}</p>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Clock size={14} className="text-slate-500" />
                        {call.duration}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>

                    {/* Resolved */}
                    <td className="px-5 py-3.5 text-center">
                      {call.resolved ? (
                        <CheckCircle2
                          size={18}
                          className="text-emerald-400 mx-auto"
                        />
                      ) : (
                        <XCircle size={18} className="text-slate-600 mx-auto" />
                      )}
                    </td>

                    {/* Sentiment */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-medium ${sentimentColor[call.sentiment]}`}
                      >
                        {call.sentiment}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                      {call.date}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    <PhoneMissed
                      size={32}
                      className="mx-auto mb-3 text-slate-600"
                    />
                    No se encontraron llamadas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 text-xs text-slate-500">
          <span>
            Mostrando {filtered.length} de {MOCK_CALLS.length} llamadas
          </span>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-500" />
            <span className="text-emerald-400">
              {resolutionRate}% resolución hoy
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
