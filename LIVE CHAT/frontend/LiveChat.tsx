import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, MessageCircle, Bot, Smartphone, User, Send, Clock, 
  CheckCheck, AlertCircle, BrainCircuit, Settings, X, Plus, 
  Loader2, Zap, MoreVertical, Pause, Play, Calendar, Filter,
  TrendingUp, CreditCard, ShoppingBag, ChevronRight, Hash, Phone,
  Globe, SlidersHorizontal, Trash2, Smile, Mic, Paperclip, MoreHorizontal
} from 'lucide-react'
import { apiClient } from '../../services/api'
import { useStore } from '../../store/useStore'
import { format, isToday, isYesterday, isSameDay, isWithinInterval, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { io, Socket } from 'socket.io-client'

interface Message {
  id: string
  body: string
  direction: 'incoming' | 'outgoing'
  source?: 'whatsapp_web' | 'provider_api' | 'admin_api' | 'bot'
  created_at: string
  status: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | 'document' | 'audio'
}

interface Chat {
  customer_phone: string
  customer_name?: string
  customer_pushname?: string
  last_message: string
  last_message_at: string
  last_direction: 'incoming' | 'outgoing'
  last_media_type?: 'image' | 'video' | 'document' | 'audio'
}

interface CustomerProfile {
  stats: {
    total_orders: number
    total_spent: number
    total_pending: number
  }
  lastOrders: any[]
}

export default function LiveChat() {
  const { currentUser: user } = useStore()
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isBotEnabled, setIsBotEnabled] = useState(true)
  const [sending, setSending] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null)
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null)
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null)
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [showLeftMenu, setShowLeftMenu] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [newChatPhone, setNewChatPhone] = useState('')
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [pauseMap, setPauseMap] = useState<Record<string, boolean>>({})
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedChatRef = useRef<string | null>(null)

  // Keep ref in sync with state so socket handlers always have the latest value
  useEffect(() => { selectedChatRef.current = selectedChat }, [selectedChat])

  // ── CLICK OUTSIDE LISTENER ──
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMenu(false)
      setShowLeftMenu(false)
      setOpenChatMenuId(null)
      setOpenMsgMenuId(null)
      setShowEmojiPicker(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!user?.id) return

    const socket = io(import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`, {
      query: { userId: user?.id },
      transports: ['websocket', 'polling'], // Permitir polling como fallback para mayor compatibilidad
      reconnection: true,
      reconnectionAttempts: 10
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('✅ Conectado a WebSockets');
      socket.emit('join_user_room', user.id);
    });

    socket.on('whatsapp_message', (payload: any) => {
      console.log('📩 Nuevo mensaje recibido via Socket:', payload);
      
      const rawPayload = payload.customerPhone.replace(/\D/g, '')
      const suffix9 = rawPayload.slice(-9)
      const rawCurrent = (selectedChatRef.current || '').replace(/\D/g, '')
      const currentSuffix9 = rawCurrent.slice(-9)

      const isSelectedChat = !!selectedChatRef.current && (
        rawPayload === rawCurrent ||
        (suffix9 === currentSuffix9 && suffix9.length === 9) ||
        (rawPayload.length > 11 && rawCurrent.length <= 11 && rawPayload.endsWith(rawCurrent.slice(-9))) ||
        (rawCurrent.length > 11 && rawPayload.length <= 11 && rawCurrent.endsWith(rawPayload.slice(-9)))
      )

      // Usar un setter funcional para evitar dependencias de estado en el socket listener
      setMessages(prev => {
        if (isSelectedChat) {
          return [...prev, {
            id: Math.random().toString(),
            body: payload.body,
            direction: payload.type,
            source: payload.source,
            created_at: new Date().toISOString(),
            status: 'received',
            mediaUrl: payload.mediaUrl,
            mediaType: payload.mediaType
          }]
        }
        return prev
      })
      
      setChats(prev => {
        // Multi-tier match: exact → suffix-9 → containment (for LIDs)
        const index = prev.findIndex(c => {
          const stored = (c.customer_phone || '').replace(/\D/g, '')
          if (stored === rawPayload) return true                          // exact
          if (stored.slice(-9) === suffix9 && suffix9.length === 9) return true // suffix-9
          if (rawPayload.length > 11 && stored.length <= 11 && rawPayload.endsWith(stored.slice(-9))) return true // LID→real
          if (stored.length > 11 && rawPayload.length <= 11 && stored.endsWith(rawPayload.slice(-9))) return true // real→LID
          return false
        })
        
        if (index !== -1) {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            last_message: payload.body,
            last_message_at: new Date().toISOString(),
            last_direction: payload.type,
            customer_pushname: payload.pushname || updated[index].customer_pushname,
            last_media_type: payload.mediaType
          }
          const item = updated.splice(index, 1)[0]
          return [item, ...updated]
        } else {
          // Solo crear nuevo chat si NO es un mensaje saliente del bot (evita chats fantasma)
          if (payload.type === 'outgoing') return prev
          return [{
            customer_phone: payload.customerPhone,
            last_message: payload.body,
            last_message_at: new Date().toISOString(),
            last_direction: payload.type,
            customer_pushname: payload.pushname,
            last_media_type: payload.mediaType
          }, ...prev]
        }
      })

      // Increment unread badge if not currently viewing that chat
      setUnreadMap(prev => {
        if (payload.type === 'incoming' && !isSelectedChat) {
          return { ...prev, [payload.customerPhone]: (prev[payload.customerPhone] || 0) + 1 }
        }
        return prev
      })
    })

    // Listen for read receipts (Double Blue Check)
    socket.on('whatsapp_message_ack', (payload: { customerPhone: string; status: string }) => {
      const rawPayload = payload.customerPhone.replace(/\D/g, '')
      const suffix9 = rawPayload.slice(-9)
      const rawCurrent = (selectedChatRef.current || '').replace(/\D/g, '')
      const currentSuffix9 = rawCurrent.slice(-9)

      const isSelectedChat = !!selectedChatRef.current && (
        rawPayload === rawCurrent ||
        (suffix9 === currentSuffix9 && suffix9.length === 9) ||
        (rawPayload.length > 11 && rawCurrent.length <= 11 && rawPayload.endsWith(rawCurrent.slice(-9))) ||
        (rawCurrent.length > 11 && rawPayload.length <= 11 && rawCurrent.endsWith(rawPayload.slice(-9)))
      )

      setMessages(prev => {
        if (isSelectedChat) {
          // Update all 'sent' or 'delivered' outgoing messages to 'read'
          return prev.map(msg => 
            msg.direction === 'outgoing' && msg.status !== 'read' 
              ? { ...msg, status: payload.status }
              : msg
          )
        }
        return prev
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [user?.id])


  // 3. Cargar datos iniciales
  useEffect(() => {
    loadChats()
    loadBotStatus()
  }, [])

  const loadChats = async () => {
    try {
      const res = await apiClient.getWhatsAppChats()
      if (res.success) {
        setChats(res.chats)
        // Cargar estados de pausa para todos los chats cargados
        if (res.chats.length > 0) {
          try {
            const phones = res.chats.map(c => c.customer_phone)
            const pauseRes = await apiClient.getWhatsAppChatPauseStatuses(phones)
            if (pauseRes.success) setPauseMap(pauseRes.statuses)
          } catch { /* silencioso */ }
        }
      }
    } catch (e) {
      toast.error('Error al cargar conversaciones')
    } finally {
      setLoadingChats(false)
    }
  }

  const loadBotStatus = async () => {
    try {
      const res = await apiClient.getWhatsAppBotEnabled()
      setIsBotEnabled(res.enabled)
    } catch (e) {}
  }

  const loadAvatar = async (phone: string) => {
    if (avatars[phone]) return
    try {
      const res = await apiClient.getWhatsAppAvatar(phone)
      if (res.success && res.avatarUrl) {
        setAvatars(prev => ({ ...prev, [phone]: res.avatarUrl! }))
      } else {
        setAvatars(prev => ({ ...prev, [phone]: 'default' }))
      }
    } catch (e) {
      setAvatars(prev => ({ ...prev, [phone]: 'default' }))
    }
  }

  // Cargar avatares de los primeros chats
  useEffect(() => {
    if (chats.length > 0) {
      chats.slice(0, 15).forEach(c => loadAvatar(c.customer_phone))
    }
  }, [chats])

  const loadMessages = async (phone: string) => {
    setLoadingMessages(true)
    try {
      const res = await apiClient.getWhatsAppMessages(phone)
      if (res.success) setMessages(res.messages)
    } catch (e) {
      toast.error('Error al cargar historial')
    } finally {
      setLoadingMessages(false)
    }
  }

  const loadProfile = async (phone: string) => {
    setLoadingProfile(true)
    try {
      const res = await apiClient.getWhatsAppCustomerProfile(phone)
      if (res.success) setProfile(res.profile)
    } catch (e) {} finally {
      setLoadingProfile(false)
    }
  }

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat.customer_phone)
    setIsSelectionMode(false)
    setSelectedMessages([])
    // Clear unread badge
    setUnreadMap(prev => {
      const next = { ...prev }
      delete next[chat.customer_phone]
      // Also try suffix match
      const suffix = chat.customer_phone.replace(/\D/g, '').slice(-9)
      Object.keys(next).forEach(k => { if (k.replace(/\D/g, '').slice(-9) === suffix) delete next[k] })
      return next
    })
    loadMessages(chat.customer_phone)
    loadProfile(chat.customer_phone)
    loadAvatar(chat.customer_phone)
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!messageInput.trim() || !selectedChat || sending) return

    setSending(true)
    try {
      const res = await apiClient.sendWhatsAppMessage(selectedChat, messageInput)
      if (res.success) {
        setMessageInput('')
      }
    } catch (e) {
      toast.error('No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChat) return

    // Prevenir archivos de más de 16MB
    if (file.size > 16 * 1024 * 1024) {
      toast.error('El archivo excede el límite de 16MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (ev) => {
       const base64 = ev.target?.result as string
       if (!base64) return
       
       setSending(true)
       try {
         const loadingToast = toast.loading('Enviando archivo...')
         // Si hay un mensaje escrito, lo usa como pie de foto (caption)
         const res = await apiClient.sendWhatsAppMessage(selectedChat, messageInput, base64)
         if (res.success) {
           setMessageInput('')
           toast.success('Archivo enviado', { id: loadingToast })
         } else {
           toast.dismiss(loadingToast)
         }
       } catch (err) {
         toast.error('Error al enviar el archivo')
       } finally {
         setSending(false)
         if (fileInputRef.current) fileInputRef.current.value = ''
       }
    }
    reader.readAsDataURL(file)
  }

  const toggleBot = async () => {
    const newStatus = !isBotEnabled
    try {
      await apiClient.setWhatsAppBotEnabled(newStatus)
      setIsBotEnabled(newStatus)
      toast.success(newStatus ? 'Bot activado 🤖' : 'Bot pausado ⏸️')
    } catch (e) {
      toast.error('Error al cambiar estado del bot')
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desvincular WhatsApp Web? Tendrás que volver a escanear el QR.')) return
    try {
      const res = await apiClient.disconnectWhatsAppWeb()
      if (res.success) {
        toast.success('Sesión cerrada')
        window.location.reload()
      }
    } catch (e) {
      toast.error('Error al cerrar sesión')
    }
  }

  const handleStartNewChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatPhone.trim()) return
    const formatted = newChatPhone.replace(/\D/g, '')
    if (formatted.length < 7) {
       toast.error('Número inválido')
       return
    }
    
    // Add to chats if not exists
    const exists = chats.find(c => c.customer_phone.includes(formatted))
    if (!exists) {
      const newChat: Chat = {
        customer_phone: `${formatted}@c.us`,
        last_message: '',
        last_message_at: new Date().toISOString(),
        last_direction: 'outgoing'
      }
      setChats(prev => [newChat, ...prev])
      setSelectedChat(newChat.customer_phone)
    } else {
      setSelectedChat(exists.customer_phone)
    }
    setShowNewChatModal(false)
    setNewChatPhone('')
  }

  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm('¿Eliminar este mensaje?')) return
    try {
      const res = await apiClient.deleteWhatsAppMessage(id)
      if (res.success) {
        setMessages(prev => prev.filter(m => m.id !== id))
      }
    } catch (e) {
      toast.error('No se pudo eliminar')
    }
  }

  const handleClearChat = async () => {
    if (!selectedChat) return
    if (!window.confirm('¿VACÍAR TODA LA CONVERSACIÓN?')) return
    try {
      const res = await apiClient.clearWhatsAppChat(selectedChat)
      if (res.success) {
        setChats(prev => prev.filter(c => c.customer_phone !== selectedChat))
        setMessages([])
        setIsSelectionMode(false)
        setSelectedMessages([])
        setSelectedChat(null)
        setShowProfile(false)
        toast.success('Conversación eliminada')
      }
    } catch (e) {
      toast.error('No se pudo vaciar')
    }
  }

  const handleDeleteChatList = async (phone: string) => {
    if (!window.confirm('¿Eliminar chat por completo?')) return
    try {
      const res = await apiClient.clearWhatsAppChat(phone)
      if (res.success) {
        setChats(prev => prev.filter(c => c.customer_phone !== phone))
        if (selectedChat === phone) {
           setSelectedChat(null)
           setMessages([])
           setShowProfile(false)
        }
        toast.success('Chat eliminado')
      }
    } catch (e) {
      toast.error('No se pudo eliminar el chat')
    }
  }

  const handleToggleBotPause = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const currentlyPaused = pauseMap[phone] || false
    const newPaused = !currentlyPaused
    // Actualización optimista inmediata
    setPauseMap(prev => ({ ...prev, [phone]: newPaused }))
    try {
      await apiClient.toggleWhatsAppBotPause(phone, newPaused)
      toast.success(newPaused ? '⏸️ IA silenciada para este cliente' : '▶️ IA reactivada para este cliente', { duration: 3000 })
    } catch (e) {
      // Revertir si falla
      setPauseMap(prev => ({ ...prev, [phone]: currentlyPaused }))
      toast.error('No se pudo cambiar el estado del bot')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedMessages.length === 0) return
    if (!window.confirm(`¿Eliminar ${selectedMessages.length} mensajes?`)) return
    
    try {
      setSending(true)
      for (const id of selectedMessages) {
        await apiClient.deleteWhatsAppMessage(id)
      }
      setMessages(prev => prev.filter(m => !selectedMessages.includes(m.id)))
      setSelectedMessages([])
      setIsSelectionMode(false)
      toast.success('Mensajes eliminados')
    } catch (e) {
      toast.error('Error al eliminar algunos mensajes')
    } finally {
      setSending(false)
    }
  }

  const toggleMessageSelection = (id: string) => {
    if (!isSelectionMode) setIsSelectionMode(true)
    setSelectedMessages(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('51')) {
      return `+51 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`
    }
    return `+${cleaned}`
  }

  const getDisplayName = (chat: Chat) => {
    return chat.customer_name || chat.customer_pushname || formatPhone(chat.customer_phone)
  }

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'hoy'
    if (isYesterday(date)) return 'ayer'
    const now = new Date()
    const lastWeek = subDays(now, 7)
    if (isWithinInterval(date, { start: lastWeek, end: now })) {
      return format(date, 'eeee', { locale: es }).toLowerCase()
    }
    return format(date, 'dd/MM/yyyy')
  }

  const filteredMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages
    const q = chatSearchQuery.toLowerCase().trim()
    return messages.filter(m => {
      const body = (m.body || (m as any).message_body || '').toLowerCase()
      return body.includes(q)
    })
  }, [messages, chatSearchQuery])

  const messageGroups = useMemo(() => {
    if (!filteredMessages || filteredMessages.length === 0) return []
    const groups: { date: Date; messages: Message[] }[] = []
    filteredMessages.forEach(msg => {
      const date = new Date(msg.created_at)
      if (isNaN(date.getTime())) return
      const existingGroup = groups.find(g => 
        g.date.getDate() === date.getDate() &&
        g.date.getMonth() === date.getMonth() &&
        g.date.getFullYear() === date.getFullYear()
      )
      if (existingGroup) existingGroup.messages.push(msg)
      else groups.push({ date, messages: [msg] })
    })
    return groups
  }, [filteredMessages])

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase().trim()
    // Quitar no-dígitos para comparar teléfonos sin prefijos de país
    const qDigits = searchQuery.replace(/\D/g, '')
    
    return chats.filter(c => {
      const phone = c.customer_phone.replace(/\D/g, '')
      const name = (c.customer_name || '').toLowerCase()
      const pushname = (c.customer_pushname || '').toLowerCase()
      const lastMsg = (c.last_message || '').toLowerCase()

      const phoneMatch = qDigits.length >= 3 && phone.includes(qDigits)
      const nameMatch = name.includes(q)
      const pushnameMatch = pushname.includes(q)
      const msgMatch = lastMsg.includes(q)
      
      return phoneMatch || nameMatch || pushnameMatch || msgMatch
    })
  }, [chats, searchQuery])

  const currentChat = chats.find(c => c.customer_phone === selectedChat)

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl overflow-hidden border border-[#d1d7db] shadow-xl font-sans">
      
      {/* ── COL 1: CHAT LIST ── */}
      <div className="w-80 md:w-[400px] flex flex-col border-r border-[#d1d7db] bg-white">
        {/* Header List */}
        <div className="h-[60px] px-4 py-2 flex items-center justify-between bg-[#f0f2f5]">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-gray-500" />
          </div>
          <div className="flex items-center gap-6">
            <button className="text-[#54656f] hover:text-[#3b4a54] transition-colors" onClick={() => setShowNewChatModal(true)} title="Nuevo Chat">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="text-[#54656f] transition-colors" onClick={toggleBot} title="Bot IA">
              {isBotEnabled ? <Bot className="w-5 h-5 text-green-500" /> : <Pause className="w-5 h-5" />}
            </button>
            <div className="relative">
              <button className="text-[#54656f] hover:text-[#3b4a54] transition-colors" onClick={(e) => { e.stopPropagation(); setShowLeftMenu(!showLeftMenu); }}>
                <MoreVertical className="w-5 h-5" />
              </button>
              {showLeftMenu && (
                <div className="absolute right-0 top-[40px] w-[200px] bg-white rounded-lg shadow-xl py-2 z-50 text-[14px] text-[#3b4a54]" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { loadChats(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6]">Actualizar chats</button>
                  <button onClick={() => { handleDisconnect(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] text-red-500">Cerrar sesión Web</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-[#f0f2f5]">
          <div className="relative bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5">
            <Search className="w-4 h-4 text-[#54656f] mr-4" />
            <input 
              type="text" placeholder="Buscar un chat o iniciar uno nuevo"
              className="bg-transparent border-none focus:ring-0 text-sm w-full py-0.5 text-[#3b4a54] placeholder:text-[#8696a0]"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="bg-[#e7fce3] text-[#008069] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer">Todos</span>
          <span className="bg-[#f0f2f5] text-[#54656f] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:bg-[#dfe5e7]">No leídos</span>
          <span className="bg-[#f0f2f5] text-[#54656f] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:bg-[#dfe5e7]">Grupos</span>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredChats.map((chat) => {
            const chatPhone = chat.customer_phone
            const phoneSuffix = chatPhone.replace(/\D/g, '').slice(-9)
            const unreadCount = Object.entries(unreadMap).reduce((acc, [k, v]) => {
              return k.replace(/\D/g, '').slice(-9) === phoneSuffix ? acc + v : acc
            }, 0)
            const isBotPaused = pauseMap[chat.customer_phone] || false
            return (<div
              key={chat.customer_phone}
              onMouseEnter={() => setHoveredChatId(chat.customer_phone)}
              onMouseLeave={() => setHoveredChatId(null)}
              className={`relative w-full h-[72px] flex items-center px-3 gap-3 border-b border-[#f0f2f5] cursor-pointer hover:bg-[#f5f6f6] transition-all ${selectedChat === chat.customer_phone ? 'bg-[#f0f2f5]' : ''}`}
              onClick={() => handleSelectChat(chat)}
            >
              <div className={`w-[49px] h-[49px] rounded-full overflow-hidden flex items-center justify-center shrink-0 ${isBotPaused ? 'ring-2 ring-orange-400 ring-offset-1 bg-orange-100' : 'bg-gray-200'}`}>
                {avatars[chat.customer_phone] && avatars[chat.customer_phone] !== 'default' ? (
                  <img src={avatars[chat.customer_phone]} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <User className={`w-8 h-8 ${isBotPaused ? 'text-orange-400' : 'text-white'}`} />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[17px] text-[#111b21] truncate font-medium">
                    {getDisplayName(chat)}
                  </span>
                  <div className="flex items-center gap-1">
                    {isBotPaused && (
                      <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full border border-orange-300">IA pausada</span>
                    )}
                    <span className={`text-[12px] ${selectedChat === chat.customer_phone ? 'text-[#00a884]' : 'text-[#667781]'}`}>
                      {formatDateLabel(new Date(chat.last_message_at))}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[14px] text-[#667781] truncate flex items-center gap-1 flex-1 min-w-0">
                    {chat.last_direction === 'outgoing' && <CheckCheck className="w-4 h-4 shrink-0 text-[#53bdeb]" />}
                    {chat.last_media_type === 'image' && <Smartphone className="w-3.5 h-3.5 shrink-0 text-[#8696a0]" />}
                    {chat.last_media_type === 'document' && <Paperclip className="w-3.5 h-3.5 shrink-0 text-[#8696a0]" />}
                    {chat.last_media_type === 'video' && <Play className="w-3.5 h-3.5 shrink-0 text-[#8696a0]" />}
                    <span className={unreadCount > 0 ? 'font-semibold text-[#111b21] truncate' : 'truncate'}>{chat.last_message}</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="ml-2 shrink-0 min-w-[20px] h-5 bg-[#25d366] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Botones de hover: Pausar IA + Eliminar */}
              {hoveredChatId === chat.customer_phone && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleBotPause(chat.customer_phone, e)}
                    className={`p-2 rounded-full shadow-sm transition-all backdrop-blur-sm ${
                      isBotPaused
                        ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-300'
                        : 'bg-orange-50 text-orange-500 hover:bg-orange-100 border border-orange-200'
                    }`}
                    title={isBotPaused ? 'Reactivar IA para este cliente' : 'Silenciar IA para este cliente'}
                  >
                    {isBotPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChatList(chat.customer_phone) }}
                    className="p-2 rounded-full bg-white/90 shadow-sm text-red-400 hover:text-red-600 hover:bg-red-50 transition-all backdrop-blur-sm"
                    title="Eliminar chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            )
          })}
        </div>
      </div>

      {/* ── COL 2: CHAT MAIN ── */}
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {selectedChat ? (
          <>
            {/* Header Chat */}
            <div className="h-[60px] px-4 py-2 flex items-center justify-between bg-[#f0f2f5] z-10 border-l border-[#d1d7db]">
              {isSelectionMode ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-6">
                    <button onClick={() => { setIsSelectionMode(false); setSelectedMessages([]) }}><X className="w-6 h-6 text-[#54656f]" /></button>
                    <span className="text-[16px] text-[#111b21]">{selectedMessages.length} seleccionados</span>
                  </div>
                  <button onClick={handleBulkDelete}><Trash2 className="w-5 h-5 text-[#54656f]" /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(!showProfile)}>
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                        {avatars[selectedChat] && avatars[selectedChat] !== 'default' ? (
                          <img src={avatars[selectedChat]} className="w-full h-full object-cover" alt="Avatar" />
                        ) : (
                          <User className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-[16px] text-[#111b21] font-medium leading-none mb-1">{getDisplayName(currentChat || { customer_phone: selectedChat } as Chat)}</h3>
                        <p className="text-[13px] text-[#667781] leading-none">en línea</p>
                      </div>
                    </div>

                    {/* Interactive Bot Status Indicator */}
                    {(() => {
                      const isSelectedBotPaused = pauseMap[selectedChat] || false;
                      return (
                        <button
                          onClick={(e) => handleToggleBotPause(selectedChat, e)}
                          className={`ml-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm border ${
                            isSelectedBotPaused
                              ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                              : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                          }`}
                          title={isSelectedBotPaused ? 'Reactivar IA para este cliente' : 'Silenciar IA para este cliente'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
                          <span>{isSelectedBotPaused ? 'IA Pausada' : 'IA Activa'}</span>
                        </button>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-6 text-[#54656f]">
                    <button onClick={() => setShowChatSearch(!showChatSearch)}>
                       <Search className="w-5 h-5" />
                    </button>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical className="w-5 h-5" /></button>
                      {showMenu && (
                        <div className="absolute right-0 top-[40px] w-[200px] bg-white rounded-lg shadow-xl py-2 z-50 text-[14px] text-[#3b4a54]" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setShowProfile(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6]">Info. del contacto</button>
                          <button onClick={() => { setIsSelectionMode(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6]">Seleccionar mensajes</button>
                          <button onClick={() => { handleClearChat(); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] text-red-500">Eliminar chat</button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Local Chat Search Bar */}
            {showChatSearch && (
              <div className="px-4 py-2 bg-[#f0f2f5] border-b border-[#d1d7db] flex items-center gap-3 z-10 shadow-sm">
                <button onClick={() => { setShowChatSearch(false); setChatSearchQuery('') }} className="hover:bg-[#dfe5e7] p-1.5 rounded-full transition-colors">
                  <X className="w-4 h-4 text-[#54656f]" />
                </button>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Buscar mensaje en el chat..." 
                  className="flex-1 text-sm border-none focus:ring-0 text-[#3b4a54] py-1 bg-transparent outline-none"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
                {chatSearchQuery.trim() && (
                  <span className="text-xs text-[#667781] shrink-0 bg-white px-2 py-1 rounded-full shadow-sm">
                    {filteredMessages.length === 0 ? 'Sin resultados' : `${filteredMessages.length} resultado${filteredMessages.length !== 1 ? 's' : ''}`}
                  </span>
                )}
                {chatSearchQuery && (
                  <button onClick={() => setChatSearchQuery('')} className="hover:bg-[#dfe5e7] p-1.5 rounded-full transition-colors">
                    <X className="w-3 h-3 text-[#8696a0]" />
                  </button>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto relative scrollbar-thin flex flex-col p-4 md:px-16 lg:px-24">
              <div className="absolute inset-0 opacity-[0.4] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>
              
              <div className="relative z-10 flex flex-col space-y-2">
                {/* Info Box */}
                <div className="self-center bg-white px-4 py-2 rounded-lg text-[12.5px] text-[#54656f] text-center shadow-sm border border-[#e9edef] max-w-md mb-4">
                   Haz clic aquí para obtener mensajes anteriores de tu teléfono.
                </div>

                {messageGroups.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col space-y-2">
                    <div className="self-center bg-[#ffffff] px-4 py-1.5 rounded-lg text-[12.5px] text-[#54656f] uppercase shadow-sm mb-2 mt-4">
                      {formatDateLabel(group.date)}
                    </div>
                    {group.messages.map((msg, idx) => {
                      const isIncoming = msg.direction === 'incoming'
                      const isSelected = selectedMessages.includes(msg.id)
                      
                      return (
                        <div 
                          key={msg.id || idx} 
                          className={`flex group/msg relative ${isIncoming ? 'justify-start' : 'justify-end'}`}
                          onClick={() => isSelectionMode && toggleMessageSelection(msg.id)}
                        >
                          {/* Selection Checkbox */}
                          {isSelectionMode && (
                            <div className={`mr-2 flex items-center`}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#00a884] border-[#00a884]' : 'border-gray-400 bg-white'}`}>
                                  {isSelected && <CheckCheck className="w-3 h-3 text-white" />}
                                </div>
                            </div>
                          )}

                            <div className={`max-w-[85%] md:max-w-[75%] px-1.5 pt-1.5 pb-1 rounded-lg shadow-[0_1px_1px_rgba(0,0,0,0.1)] relative transition-all ${
                              isIncoming 
                                ? (isSelected ? 'bg-[#f0f2f5]' : 'bg-[#ffffff]') + ' text-[#111b21] rounded-tl-none border-l-[3px] border-l-[#fff]' 
                                : (isSelected ? 'bg-[#d1eafe]' : 'bg-[#dcf8c6]') + ' text-[#111b21] rounded-tr-none border-r-[3px] border-r-[#dcf8c6]'
                            }`}>
                            
                            {/* MULTIMEDIA RENDERER */}
                            {(msg.mediaUrl || (msg as any).media_url) && (
                              <div className="mb-2 overflow-hidden rounded-md cursor-pointer hover:opacity-95 transition-opacity">
                                {((msg as any).mediaType === 'image' || (msg as any).media_type === 'image') && (
                                  <img 
                                    src={msg.mediaUrl || (msg as any).media_url} 
                                    alt="Media adjunta" 
                                    className="max-h-[300px] w-full rounded-md"
                                  />
                                )}
                                {((msg as any).mediaType === 'video' || (msg as any).media_type === 'video') && (
                                  <video 
                                    src={msg.mediaUrl || (msg as any).media_url} 
                                    controls 
                                    className="max-h-[300px] w-full rounded-md"
                                  />
                                )}
                                  {/* PDF / Documento */}
                                  {((msg as any).mediaType === 'document' || (msg as any).media_type === 'document') && (
                                    <div 
                                      className="flex items-center gap-3 p-4 bg-white/40 rounded-xl border border-black/5 hover:bg-white/60 transition-all cursor-pointer mb-2 backdrop-blur-sm shadow-sm"
                                      onClick={() => { const url = msg.mediaUrl || (msg as any).media_url; if(url) window.open(url, '_blank'); }}
                                    >
                                      <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shrink-0 border-b-4 border-red-800">
                                        PDF
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <p className="text-[13.5px] font-bold text-[#111b21] truncate">
                                            Catálogo Oficial
                                          </p>
                                          <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase tracking-wider font-black">
                                            Bot
                                          </span>
                                        </div>
                                        <p className="text-[12px] text-[#667781] flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                          Documento generado y enviado
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Audio */}
                                  {((msg as any).mediaType === 'audio' || (msg as any).media_type === 'audio') && (
                                    <div className="flex items-center gap-3 p-2 bg-[#f0f2f5] rounded-lg min-w-[200px]">
                                      <div className="w-10 h-10 bg-[#53bdeb] rounded-full flex items-center justify-center text-white shadow-sm shrink-0">
                                        <Play className="w-5 h-5 fill-current" />
                                      </div>
                                      <audio src={msg.mediaUrl || (msg as any).media_url} controls className="w-full h-8 opacity-70" />
                                    </div>
                                  )}
                              </div>
                            )}

                            <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap pr-16 min-h-[20px] px-2">
                              {msg.body || (msg as any).message_body}
                            </p>
                            
                            <div className="flex items-center gap-1 justify-end mt-[-4px] px-2">
                              <span className="text-[11px] text-[#667781] mr-1">
                                {(() => {
                                  try {
                                    const d = new Date(msg.created_at || Date.now())
                                    return isNaN(d.getTime()) ? '' : format(d, 'p', { locale: es }).toLowerCase()
                                  } catch (e) {
                                    return ''
                                  }
                                })()}
                              </span>
                              {!isIncoming && (
                                <div className="flex items-center gap-1 shrink-0 select-none">
                                  {msg.source === 'bot' && (
                                    <span className="text-[10px] text-green-600 bg-green-50 font-bold px-1 rounded flex items-center gap-0.5 border border-green-200 uppercase tracking-wider scale-90">
                                      🤖 bot
                                    </span>
                                  )}
                                  <CheckCheck className={`w-4 h-4 ${msg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#667781]'}`} />
                                </div>
                              )}
                            </div>

                            {/* Dropdown Menu (WhatsApp Web Style) */}
                            {!isSelectionMode && (
                              <div className="absolute right-1 top-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(openMsgMenuId === msg.id ? null : msg.id) }} 
                                  className={`p-0.5 rounded-full ${isIncoming ? 'bg-white hover:bg-gray-100' : 'bg-[#dcf8c6] hover:bg-[#cbf0b1]'} text-[#8696a0] hover:text-[#54656f] shadow-sm`}
                                >
                                  <ChevronRight className="w-5 h-5 rotate-90" />
                                </button>
                                {openMsgMenuId === msg.id && (
                                  <div className="absolute right-0 top-6 w-[160px] bg-white rounded-lg shadow-xl py-2 z-50 text-[14.5px] font-normal text-left border border-black/5">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] text-red-500">Eliminar mensaje</button>
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(null); toggleMessageSelection(msg.id) }} className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] text-[#3b4a54]">Seleccionar</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div ref={messagesEndRef} className="h-4" />
            </div>

            <div className="px-4 py-2.5 bg-[#f0f2f5] flex items-center gap-4 border-l border-[#d1d7db] relative">
              
              {/* EMOJI PICKER MODAL */}
              {showEmojiPicker && (
                <div className="absolute bottom-[60px] left-4 bg-white border border-[#d1d7db] shadow-xl rounded-lg p-3 w-[280px] z-50 grid grid-cols-6 gap-2" onClick={(e) => e.stopPropagation()}>
                  {['😀','😂','😍','😎','🙏','👍','🔥','✨','🚀','❤️','💡','💰','🤖','✅','❌','📦','🚚','🛍️','📈','🚨'].map(emoji => (
                    <button key={emoji} type="button" className="text-xl hover:bg-gray-100 rounded p-1 transition-colors" onClick={() => { setMessageInput(prev => prev + emoji) }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-[#54656f]">
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="hover:text-[#3b4a54] transition-colors">
                  <Smile className="w-6 h-6" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={handleFileUpload}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="hover:text-[#3b4a54] transition-colors">
                  <Plus className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center bg-white rounded-lg px-3 py-2 shadow-sm">
                <input 
                  type="text" placeholder="Escribe un mensaje"
                  className="bg-transparent border-none focus:ring-0 text-[15px] w-full py-0 text-[#3b4a54] placeholder:text-[#8696a0]"
                  value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
                  disabled={sending}
                />
              </form>
              <div className="text-[#54656f]">
                {messageInput.trim() ? (
                  <button onClick={() => handleSendMessage()} className="bg-transparent border-none hover:text-[#00a884]"><Send className="w-6 h-6" /></button>
                ) : (
                  <button className="bg-transparent border-none hover:text-[#00a884]"><Mic className="w-6 h-6" /></button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#f0f2f5] border-l border-[#d1d7db]">
            <div className="w-[300px] opacity-10 mb-8">
              <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5z23.png" alt="WhatsApp Web" />
            </div>
            <h3 className="text-[32px] font-light text-[#41525d] mb-4">WhatsApp Web</h3>
            <p className="text-[#667781] text-[14px] max-w-sm mx-auto">
              Envía y recibe mensajes sin necesidad de tener tu teléfono conectado.<br/>
              Usa WhatsApp en hasta 4 dispositivos vinculados y 1 teléfono a la vez.
            </p>
            <div className="mt-16 flex items-center gap-2 text-[#8696a0] text-[14px]">
               <Settings className="w-4 h-4" /> Cifrado de extremo a extremo
            </div>
          </div>
        )}
      </div>

      {/* ── COL 3: PROFILE SIDEBAR ── */}
      {selectedChat && showProfile && (
        <div className="w-[400px] border-l border-[#d1d7db] bg-white flex flex-col">
          <div className="h-[60px] px-6 flex items-center gap-6 bg-[#f0f2f5] text-[#111b21]">
            <button onClick={() => setShowProfile(false)}><X className="w-6 h-6" /></button>
            <span className="text-[16px] font-medium">Info. del contacto</span>
          </div>
          
          <div className="overflow-y-auto flex-1 bg-[#f0f2f5]">
             {/* Photo & Name */}
             <div className="bg-white px-8 py-10 flex flex-col items-center shadow-sm mb-3">
                <div className="w-48 h-48 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mb-4">
                  {avatars[selectedChat] && avatars[selectedChat] !== 'default' ? (
                    <img src={avatars[selectedChat]} className="w-full h-full object-cover" alt="Avatar" />
                  ) : (
                    <User className="w-32 h-32 text-white" />
                  )}
                </div>
                <h4 className="text-[19px] text-[#111b21] mb-1 font-normal text-center">{getDisplayName(currentChat || {} as Chat)}</h4>
                <p className="text-[16px] text-[#667781]">{formatPhone(selectedChat)}</p>
             </div>

             {/* Financial Status */}
             {profile && (
               <>
                 <div className="bg-white px-8 py-4 shadow-sm mb-3">
                    <p className="text-[14px] text-[#008069] font-medium mb-4 uppercase">Resumen Atines</p>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[14px] text-[#111b21]">Total pedidos</span>
                        <span className="text-[14px] font-medium">{profile.stats.total_orders}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[14px] text-[#111b21]">Inversión total</span>
                        <span className="text-[14px] font-medium">S/ {Number(profile.stats.total_spent).toFixed(2)}</span>
                      </div>
                      {Number(profile.stats.total_pending) > 0 && (
                        <div className="flex justify-between items-center text-red-600 font-bold">
                          <span className="text-[14px]">Saldo pendiente</span>
                          <span className="text-[14px]">S/ {Number(profile.stats.total_pending).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                 </div>

                 <div className="bg-white px-8 py-4 shadow-sm">
                    <p className="text-[14px] text-[#667781] mb-4">Últimos movimientos</p>
                    <div className="space-y-4">
                      {profile.lastOrders.map((order: any) => (
                        <div key={order.id} className="border-b border-[#f0f2f5] pb-3">
                          <div className="flex justify-between text-[13px] mb-1">
                            <span className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-[#667781]">{format(new Date(order.created_at), 'dd/MM/yy')}</span>
                          </div>
                          <div className="flex justify-between text-[14px]">
                            <span className="text-[#667781] capitalize">{order.status}</span>
                            <span className="font-semibold">S/ {Number(order.total).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               </>
             )}
          </div>
        </div>
      )}

      {/* MODAL NUEVO CHAT */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-[60px] px-6 flex items-center justify-between bg-[#00a884] text-white">
              <span className="text-[16px] font-medium">Nuevo chat</span>
              <button onClick={() => setShowNewChatModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6">
              <p className="text-[14px] text-[#54656f] mb-4">Ingresa el número de teléfono con código de país (ej. 51999999999)</p>
              <form onSubmit={handleStartNewChat}>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Ej: 51924678473"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none mb-6"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewChatModal(false)} className="px-5 py-2 text-[#54656f] hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                  <button type="submit" className="px-5 py-2 bg-[#00a884] text-white rounded-lg font-medium hover:bg-[#008f6f]">Iniciar chat</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
