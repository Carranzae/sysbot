import { useState } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  Bot,
  Zap,
  Activity,
  UserX,
  Plus,
  Trash2,
  Lock,
  Globe,
  Smartphone,
  AlertTriangle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SwarmAgent {
  id: string
  name: string
  role: string
  latency: string
  cpu: string
  status: 'ACTIVE' | 'SHIELD_ACTIVE' | 'STANDBY'
  tasks: string[]
}

interface BlockedItem {
  id: string
  type: 'IP' | 'PHONE'
  value: string
  reason: string
  date: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_AGENTS: SwarmAgent[] = [
  {
    id: '1',
    name: 'Agente de Empatía',
    role: 'Análisis de tono, humor del cliente y respuestas humanizadas.',
    latency: '4ms',
    cpu: '1.2%',
    status: 'ACTIVE',
    tasks: ['Clasificación de sentimiento', 'Redacción empática', 'Detección de enfado']
  },
  {
    id: '2',
    name: 'Agente de Negociación',
    role: 'Optimización de ofertas, reglas de precios y cierres de reservas.',
    latency: '12ms',
    cpu: '4.8%',
    status: 'ACTIVE',
    tasks: ['Cálculo de tarifas', 'Búsqueda de alternativas', 'Validación de cupones']
  },
  {
    id: '3',
    name: 'Agente de Reconocimiento de Errores',
    role: 'Auditoría en tiempo real para evitar alucinaciones e incoherencias.',
    latency: '8ms',
    cpu: '3.1%',
    status: 'ACTIVE',
    tasks: ['Consistencia RAG', 'Verificación de hechos', 'Corrección ortográfica']
  },
  {
    id: '4',
    name: 'Agente de Buena Conducta',
    role: 'Escudo protector anti-inyecciones de prompt y lenguaje abusivo.',
    latency: '2ms',
    cpu: '0.4%',
    status: 'SHIELD_ACTIVE',
    tasks: ['Filtro de insultos', 'Bloqueo de payloads', 'Detección de jailbreaks']
  }
]

const MOCK_BLOCKLIST: BlockedItem[] = [
  { id: '1', type: 'IP', value: '186.42.102.4', reason: 'Ataque de fuerza bruta recurrente', date: '2026-06-02 08:14' },
  { id: '2', type: 'PHONE', value: '+51 999 000 111', reason: 'Spam masivo y lenguaje abusivo', date: '2026-06-01 19:40' },
  { id: '3', type: 'IP', value: '45.228.12.89', reason: 'Intento de inyección SQL en chat', date: '2026-05-31 12:05' }
]

export default function SwarmAgents() {
  const [agents, setAgents] = useState<SwarmAgent[]>(MOCK_AGENTS)
  const [blockList, setBlockList] = useState<BlockedItem[]>(MOCK_BLOCKLIST)
  
  // Form State
  const [blockType, setBlockType] = useState<'IP' | 'PHONE'>('IP')
  const [blockValue, setBlockValue] = useState('')
  const [blockReason, setBlockReason] = useState('')

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!blockValue.trim() || !blockReason.trim()) return

    const newItem: BlockedItem = {
      id: Date.now().toString(),
      type: blockType,
      value: blockValue,
      reason: blockReason,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    }

    setBlockList([newItem, ...blockList])
    setBlockValue('')
    setBlockReason('')
  }

  const handleDeleteBlock = (id: string) => {
    setBlockList(blockList.filter(item => item.id !== id))
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bot className="text-emerald-400" />
            Monitoreo de Swarm Agents
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestión y estado operativo del enjambre de agentes de Inteligencia Artificial cooperativos.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold uppercase tracking-wider">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Enjambre Sincronizado
        </div>
      </div>

      {/* Grid of 4 Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {agents.map((agent) => {
          const isActive = agent.status === 'ACTIVE'
          const isShield = agent.status === 'SHIELD_ACTIVE'
          
          return (
            <div
              key={agent.id}
              className={`relative overflow-hidden rounded-2xl bg-slate-900/60 border transition-all duration-300 hover:scale-[1.01] ${
                isShield 
                  ? 'border-rose-500/20 hover:border-rose-500/40 shadow-lg shadow-rose-950/20' 
                  : 'border-white/5 hover:border-emerald-500/20 shadow-lg shadow-black/40'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isShield ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
                      <Bot className={`w-6 h-6 ${isShield ? 'text-rose-400' : 'text-emerald-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{agent.name}</h3>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                        Sistembot AI Layer
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      isShield
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isShield ? 'bg-rose-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                    {agent.status === 'SHIELD_ACTIVE' ? 'ESCUDO ACTIVO' : 'ACTIVO'}
                  </span>
                </div>

                <p className="text-sm text-slate-400 mt-4 min-h-[40px] leading-relaxed">
                  {agent.role}
                </p>

                {/* Subtasks */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <span className="text-xs text-slate-500 font-semibold block mb-2 uppercase">Tareas actuales:</span>
                  <div className="flex flex-wrap gap-2">
                    {agent.tasks.map((task, i) => (
                      <span key={i} className="text-xs bg-slate-800/80 border border-white/5 text-slate-300 px-2.5 py-1 rounded-lg">
                        {task}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5 bg-slate-950/40 -mx-6 -mb-6 p-6">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Latencia</p>
                      <p className="text-sm font-bold text-white mt-0.5">{agent.latency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Uso de CPU</p>
                      <p className="text-sm font-bold text-white mt-0.5">{agent.cpu}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Security Blocklist & Form Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blocklist Table */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-white/5 p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-6">
            <Lock className="text-rose-400 w-5 h-5" />
            <div>
              <h2 className="text-lg font-bold text-white">Lista de Bloqueos de Seguridad</h2>
              <p className="text-xs text-slate-500">Direcciones IP y teléfonos restringidos por el Escudo de Buena Conducta.</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 flex-1">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">Tipo</th>
                  <th className="px-6 py-3 font-semibold">Identificador</th>
                  <th className="px-6 py-3 font-semibold">Razón del Bloqueo</th>
                  <th className="px-6 py-3 font-semibold">Fecha</th>
                  <th className="px-6 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {blockList.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        item.type === 'IP' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {item.type === 'IP' ? <Globe className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">
                      {item.value}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {item.reason}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteBlock(item.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Desbloquear"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {blockList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      No hay bloqueos activos en el escudo. Todo está seguro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Block Form */}
        <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <UserX className="text-emerald-400 w-5 h-5" />
            <div>
              <h2 className="text-lg font-bold text-white">Registrar Bloqueo</h2>
              <p className="text-xs text-slate-500">Agregar manualmente IP o teléfono a la lista de bloqueos.</p>
            </div>
          </div>

          <form onSubmit={handleAddBlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Tipo de Identificador
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBlockType('IP')}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    blockType === 'IP'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow'
                      : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-950/80'
                  }`}
                >
                  Dirección IP
                </button>
                <button
                  type="button"
                  onClick={() => setBlockType('PHONE')}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    blockType === 'PHONE'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow'
                      : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-950/80'
                  }`}
                >
                  Nro. Teléfono
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Valor del Identificador
              </label>
              <input
                type="text"
                placeholder={blockType === 'IP' ? 'Ej. 192.168.1.1' : 'Ej. +51 987 654 321'}
                value={blockValue}
                onChange={(e) => setBlockValue(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Razón del Bloqueo
              </label>
              <textarea
                placeholder="Razón técnica o comportamiento inapropiado..."
                rows={3}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Agregar Bloqueo
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
