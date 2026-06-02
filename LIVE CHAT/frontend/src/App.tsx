import { useState } from 'react'
import LiveChat from './pages/LiveChat'
import WhatsAppWeb from './pages/WhatsAppWeb'
import CRMCalls from './pages/CRMCalls'
import SwarmAgents from './pages/SwarmAgents'
import CommandCenter from './pages/CommandCenter'
import { useStore } from './store/useStore'
import { MessageSquare, Link2, Phone, Bot, Command, LogOut, User as UserIcon } from 'lucide-react'

export default function App() {
  const { currentUser, setCurrentUser, clearUser } = useStore()
  const [activeTab, setActiveTab] = useState<'chat' | 'connect' | 'calls' | 'agents' | 'command'>('chat')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // Mock/Simple login for live chat client using API or setting state directly
      // Since it's standalone, if we connect to the backend, it expects /api/auth/login
      const { apiClient } = await import('./services/api')
      const res = await apiClient.login(email, password)
      const { saveAuthSession } = await import('./lib/authStorage')
      saveAuthSession(res.token, res.user)
      setCurrentUser(res.user)
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    const { clearAuthSession } = require('./lib/authStorage')
    clearAuthSession()
    clearUser()
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md w-full space-y-8 p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700/50">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-white tracking-tight">
              LAY CHAT
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Inicia sesión para gestionar tus chats
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-750 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="ejemplo@correo.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-750 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Iniciando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar de Navegación */}
      <aside className="w-16 flex flex-col items-center py-4 bg-slate-900 border-r border-slate-800">
        <div className="flex-1 flex flex-col gap-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
            LC
          </div>

          <button
            onClick={() => setActiveTab('chat')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              activeTab === 'chat'
                ? 'bg-slate-800 text-emerald-400 shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Chat en Vivo"
          >
            <MessageSquare size={20} />
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              activeTab === 'connect'
                ? 'bg-slate-800 text-emerald-400 shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Vincular WhatsApp"
          >
            <Link2 size={20} />
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              activeTab === 'calls'
                ? 'bg-slate-800 text-emerald-400 shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Llamadas CRM"
          >
            <Phone size={20} />
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              activeTab === 'agents'
                ? 'bg-slate-800 text-emerald-400 shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Agentes IA"
          >
            <Bot size={20} />
          </button>

          <button
            onClick={() => setActiveTab('command')}
            className={`p-3 rounded-xl transition-all duration-200 ${
              activeTab === 'command'
                ? 'bg-slate-800 text-emerald-400 shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Centro de Mando"
          >
            <Command size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <div className="text-slate-400 hover:text-slate-200 cursor-pointer flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <UserIcon size={16} />
            </div>
            <span className="text-[10px] mt-1 truncate max-w-[60px] text-slate-400">
              {currentUser.name || 'User'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' ? <LiveChat /> : 
         activeTab === 'connect' ? <WhatsAppWeb /> :
         activeTab === 'calls' ? <CRMCalls /> :
         activeTab === 'agents' ? <SwarmAgents /> :
         <CommandCenter setActiveTab={setActiveTab} />}
      </main>
    </div>
  )
}
