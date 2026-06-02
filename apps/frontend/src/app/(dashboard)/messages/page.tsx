'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useBusinessStore } from '@/store/business'
import { livechatApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { io, Socket } from 'socket.io-client'
import { 
  MessageSquare, Search, Building2, Send, 
  Phone, Video, Smile, Mic, Paperclip, 
  MoreVertical, Check, CheckCheck, Clock, Shield,
  User, Users, MessageCircle, Bot, Pause, Play,
  Settings, X, Plus, Trash2, Calendar, Filter,
  ChevronRight, BrainCircuit, AlertCircle, Sparkles,
  RefreshCw, LogOut, CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { format, isToday, isYesterday, isSameDay, isWithinInterval, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'

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

export default function MessagesPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  
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
  
  // WhatsApp connection state & QR
  const [waStatus, setWaStatus] = useState<string>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connectingWa, setConnectingWa] = useState(false)
  const [usePairingCode, setUsePairingCode] = useState(false)
  const [pairingNumber, setPairingNumber] = useState('')
  const [pairingCode, setPairingCode] = useState<string | null>(null)

  // Layout & menus
  const [showProfile, setShowProfile] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null)
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null)
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [showLeftMenu, setShowLeftMenu] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [newChatPhone, setNewChatPhone] = useState('')
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [pauseMap, setPauseMap] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'todos' | 'unread' | 'paused'>('todos')
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedChatRef = useRef<string | null>(null)

  // Sincronizar referencia con estado para manejadores de socket
  useEffect(() => { selectedChatRef.current = selectedChat }, [selectedChat])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cargar datos iniciales
  const loadChats = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingChats(true)
    try {
      const res = await livechatApi.getChats()
      const chatList = (res as any).data?.chats || res.data || [];
      if (Array.isArray(chatList)) {
        setChats(chatList)
        if (chatList.length > 0) {
          try {
            const phones = chatList.map((c: any) => c.customer_phone)
            const pauseRes = await livechatApi.getPauseStatuses(phones)
            if (pauseRes.data) setPauseMap(pauseRes.data)
          } catch { /* silencioso */ }
        }
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No pudimos cargar tus chats.',
        variant: 'destructive',
      })
    } finally {
      setLoadingChats(false)
    }
  }, [selectedBusiness, toast])

  const loadBotStatus = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const res = await livechatApi.getBotEnabled()
      const data = (res as any).data || res;
      setIsBotEnabled(!!data.enabled)
    } catch (e) {}
  }, [selectedBusiness])

  const loadWhatsAppStatus = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const res = await livechatApi.getStatus()
      const data = (res as any).data || res;
      setWaStatus(data.status || 'disconnected')
    } catch (e) {}
  }, [selectedBusiness])

  // Cargar avatares
  const loadAvatar = async (phone: string) => {
    if (avatars[phone]) return
    try {
      const res = await livechatApi.getAvatar(phone)
      const data = (res as any).data || res;
      if (data.success && data.avatarUrl) {
        setAvatars(prev => ({ ...prev, [phone]: data.avatarUrl }))
      } else {
        setAvatars(prev => ({ ...prev, [phone]: 'default' }))
      }
    } catch (e) {
      setAvatars(prev => ({ ...prev, [phone]: 'default' }))
    }
  }

  useEffect(() => {
    if (chats.length > 0) {
      chats.slice(0, 15).forEach(c => loadAvatar(c.customer_phone))
    }
  }, [chats])

  // Cargar mensajes
  const loadMessages = async (phone: string) => {
    setLoadingMessages(true)
    try {
      const res = await livechatApi.getChatMessages(phone)
      const data = (res as any).data || res;
      const list = data.messages || data || []
      setMessages(list)
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No pudimos cargar el historial.',
        variant: 'destructive',
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  // Cargar perfil
  const loadProfile = async (phone: string) => {
    setLoadingProfile(true)
    try {
      const res = await livechatApi.getCustomerProfile(phone)
      const data = (res as any).data || res;
      const profileData = data.profile || data || null
      setProfile(profileData)
    } catch (e) {} finally {
      setLoadingProfile(false)
    }
  }

  // Manejar selección de chat
  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat.customer_phone)
    setIsSelectionMode(false)
    setSelectedMessages([])
    setUnreadMap(prev => {
      const next = { ...prev }
      delete next[chat.customer_phone]
      const suffix = chat.customer_phone.replace(/\D/g, '').slice(-9)
      Object.keys(next).forEach(k => {
        if (k.replace(/\D/g, '').slice(-9) === suffix) delete next[k]
      })
      return next
    })
    loadMessages(chat.customer_phone)
    loadProfile(chat.customer_phone)
    loadAvatar(chat.customer_phone)
  }

  // Enviar mensaje de texto
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!messageInput.trim() || !selectedChat || sending) return

    const userMsg = messageInput.trim()
    setMessageInput('')
    setSending(true)

    // Crear un mensaje temporal optimista
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      body: userMsg,
      direction: 'outgoing',
      source: 'admin_api',
      created_at: new Date().toISOString(),
      status: 'pending'
    }
    setMessages(prev => [...prev, tempMsg])
    setTimeout(scrollToBottom, 50)

    try {
      const res = await livechatApi.sendMessage(selectedChat, userMsg)
      if (res.success || res.data?.success) {
        // Reemplazar o actualizar mensaje con datos reales
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent', id: res.messageId || res.data?.messageId || m.id } : m))
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  // Subir archivos y convertirlos a Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChat) return

    if (file.size > 16 * 1024 * 1024) {
      toast({
        title: 'Límite excedido',
        description: 'El archivo excede el límite de 16MB.',
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      if (!base64) return
       
      setSending(true)
      try {
        toast({
          title: 'Subiendo...',
          description: 'Enviando archivo multimedia.',
        })
        const res = await livechatApi.sendMessage(selectedChat, messageInput, base64)
        if (res.success || res.data?.success) {
          setMessageInput('')
          toast({
            title: 'Enviado',
            description: 'Archivo enviado con éxito.',
          })
          loadMessages(selectedChat)
        }
      } catch (err) {
        toast({
          title: 'Fallo',
          description: 'Error al enviar el archivo.',
          variant: 'destructive',
        })
      } finally {
        setSending(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  // Activar/Pausar el bot general
  const toggleBot = async () => {
    const newStatus = !isBotEnabled
    try {
      await livechatApi.toggleBot(newStatus)
      setIsBotEnabled(newStatus)
      toast({
        title: newStatus ? 'Bot activado 🤖' : 'Bot pausado ⏸️',
        description: newStatus ? 'La inteligencia artificial responderá automáticamente.' : 'La IA ha sido silenciada para responder manualmente.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No pudimos cambiar el estado del bot.',
        variant: 'destructive',
      })
    }
  }

  // Silenciar bot para un cliente específico
  const handleToggleBotPause = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const currentlyPaused = pauseMap[phone] || false
    const newPaused = !currentlyPaused
    setPauseMap(prev => ({ ...prev, [phone]: newPaused }))
    try {
      await livechatApi.pauseBotForChat(phone, newPaused)
      toast({
        title: newPaused ? 'IA silenciada ⏸️' : 'IA reactivada ▶️',
        description: newPaused ? 'El cliente será atendido de forma 100% manual.' : 'El bot de IA vuelve a gestionar esta conversación.',
      })
    } catch (e) {
      setPauseMap(prev => ({ ...prev, [phone]: currentlyPaused }))
      toast({
        title: 'Fallo',
        description: 'No se pudo cambiar el estado del bot para el chat.',
        variant: 'destructive',
      })
    }
  }

  // Desvincular WhatsApp Web
  const handleDisconnect = async () => {
    if (!window.confirm('¿Desvincular WhatsApp Web? Tendrás que volver a escanear el QR.')) return
    try {
      await livechatApi.disconnectWhatsApp()
      toast({
        title: 'Sesión cerrada',
        description: 'WhatsApp Web desvinculado con éxito.',
      })
      window.location.reload()
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo cerrar la sesión.',
        variant: 'destructive',
      })
    }
  }

  // Iniciar vinculación de WhatsApp (QR o pairing code)
  const handleStartWhatsApp = async () => {
    setConnectingWa(true)
    setQrCode(null)
    setPairingCode(null)
    try {
      const res = await livechatApi.startWhatsApp(usePairingCode, pairingNumber)
      if (res.qr) {
        setQrCode(res.qr)
      } else if (res.code) {
        setPairingCode(res.code)
      }
      setShowQrModal(true)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo iniciar la conexión de WhatsApp.',
        variant: 'destructive',
      })
    } finally {
      setConnectingWa(false)
    }
  }

  // Iniciar nuevo chat
  const handleStartNewChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatPhone.trim()) return
    const formatted = newChatPhone.replace(/\D/g, '')
    if (formatted.length < 7) {
       toast({
         title: 'Número inválido',
         description: 'Ingresa un número completo.',
         variant: 'destructive',
       })
       return
    }
    
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

  // Eliminar un mensaje
  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm('¿Eliminar este mensaje?')) return
    try {
      await livechatApi.deleteMessage(id)
      setMessages(prev => prev.filter(m => m.id !== id))
      toast({ title: 'Mensaje eliminado' })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el mensaje.',
        variant: 'destructive',
      })
    }
  }

  // Vaciar conversación
  const handleClearChat = async () => {
    if (!selectedChat) return
    if (!window.confirm('¿VACIAR TODA LA CONVERSACIÓN?')) return
    try {
      await livechatApi.clearChat(selectedChat)
      setChats(prev => prev.filter(c => c.customer_phone !== selectedChat))
      setMessages([])
      setIsSelectionMode(false)
      setSelectedMessages([])
      setSelectedChat(null)
      setShowProfile(false)
      toast({ title: 'Conversación eliminada con éxito.' })
    } catch (e) {
      toast({
        title: 'Fallo',
        description: 'No se pudo vaciar la conversación.',
        variant: 'destructive',
      })
    }
  }

  // Eliminar chat de la lista lateral
  const handleDeleteChatList = async (phone: string) => {
    if (!window.confirm('¿Eliminar chat por completo?')) return
    try {
      await livechatApi.clearChat(phone)
      setChats(prev => prev.filter(c => c.customer_phone !== phone))
      if (selectedChat === phone) {
         setSelectedChat(null)
         setMessages([])
         setShowProfile(false)
      }
      toast({ title: 'Chat eliminado con éxito.' })
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el chat.',
        variant: 'destructive',
      })
    }
  }

  // Eliminar mensajes seleccionados en bloque
  const handleBulkDelete = async () => {
    if (selectedMessages.length === 0) return
    if (!window.confirm(`¿Eliminar ${selectedMessages.length} mensajes?`)) return
    
    try {
      setSending(true)
      for (const id of selectedMessages) {
        await livechatApi.deleteMessage(id)
      }
      setMessages(prev => prev.filter(m => !selectedMessages.includes(m.id)))
      setSelectedMessages([])
      setIsSelectionMode(false)
      toast({ title: 'Mensajes eliminados en bloque.' })
    } catch (e) {
      toast({
        title: 'Fallo parcial',
        description: 'Hubo un error al eliminar algunos mensajes.',
        variant: 'destructive',
      })
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

  // Inicializar WebSockets y datos
  useEffect(() => {
    if (!selectedBusiness) return

    loadChats()
    loadBotStatus()
    loadWhatsAppStatus()

    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001'
    const socket = io(socketUrl)
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('joinUser', selectedBusiness.userId || 'user-default')
    })

    // Recibir mensajes en tiempo real
    socket.on('livechatMessage', (msg: any) => {
      const isSelected = selectedChatRef.current && 
        (selectedChatRef.current === msg.from || selectedChatRef.current === msg.to)

      setMessages(prev => {
        if (isSelected) {
          if (prev.some(m => m.id === msg.id)) return prev
          const mappedMsg: Message = {
            id: msg.id,
            body: msg.content,
            direction: msg.direction === 'INBOUND' ? 'incoming' : 'outgoing',
            source: msg.metadata?.source || 'whatsapp_web',
            created_at: msg.createdAt || new Date().toISOString(),
            status: msg.status || 'delivered',
            mediaUrl: msg.mediaUrl,
            mediaType: msg.metadata?.mediaType
          }
          setTimeout(scrollToBottom, 50)
          return [...prev, mappedMsg]
        }
        return prev
      })

      // Actualizar chat en lista lateral
      setChats(prev => {
        const phone = msg.direction === 'INBOUND' ? msg.from : msg.to
        const index = prev.findIndex(c => c.customer_phone === phone)
        const updated = [...prev]

        if (index !== -1) {
          updated[index] = {
            ...updated[index],
            last_message: msg.content,
            last_message_at: msg.createdAt || new Date().toISOString(),
            last_direction: msg.direction === 'INBOUND' ? 'incoming' : 'outgoing',
            last_media_type: msg.metadata?.mediaType
          }
          const item = updated.splice(index, 1)[0]
          return [item, ...updated]
        } else {
          return [{
            customer_phone: phone,
            last_message: msg.content,
            last_message_at: msg.createdAt || new Date().toISOString(),
            last_direction: msg.direction === 'INBOUND' ? 'incoming' : 'outgoing',
            last_media_type: msg.metadata?.mediaType
          }, ...prev]
        }
      })

      // Incrementar contador si no está en el chat activo
      if (msg.direction === 'INBOUND' && (!selectedChatRef.current || selectedChatRef.current !== msg.from)) {
        setUnreadMap(prev => ({
          ...prev,
          [msg.from]: (prev[msg.from] || 0) + 1
        }))
      }
    })

    // Escuchar cambios de QR
    socket.on('livechatQr', (data: any) => {
      if (data.qr) {
        setQrCode(data.qr)
        setWaStatus('connecting')
        setShowQrModal(true)
      }
    })

    // Escuchar listo
    socket.on('livechatReady', () => {
      setWaStatus('connected')
      setQrCode(null)
      setShowQrModal(false)
      toast({
        title: 'WhatsApp Conectado 📱',
        description: 'Tu número de WhatsApp se ha sincronizado correctamente.',
      })
      loadChats()
    })

    // Escuchar estado
    socket.on('livechatStatus', (data: any) => {
      setWaStatus(data.status || 'disconnected')
      if (data.qr) setQrCode(data.qr)
    })

    // Escuchar ACK de lectura
    socket.on('livechatAck', (data: any) => {
      const isSelected = selectedChatRef.current && selectedChatRef.current === data.customerPhone
      if (isSelected) {
        setMessages(prev => prev.map(m => 
          m.direction === 'outgoing' && m.status !== 'read' 
            ? { ...m, status: data.status }
            : m
        ))
      }
    })

    return () => {
      socket.emit('leaveUser', selectedBusiness.userId || 'user-default')
      socket.disconnect()
    }
  }, [selectedBusiness, loadChats, loadBotStatus, loadWhatsAppStatus, toast])

  // Formatear números de teléfono
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

  // Filtrado de mensajes locales
  const filteredMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages
    const q = chatSearchQuery.toLowerCase().trim()
    return messages.filter(m => (m.body || '').toLowerCase().includes(q))
  }, [messages, chatSearchQuery])

  // Agrupamiento por fecha
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

  // Filtrado de chats
  const filteredChats = useMemo(() => {
    let result = chats
    
    // Filtrar por tab activo
    if (activeTab === 'unread') {
      result = chats.filter(c => {
        const phoneSuffix = c.customer_phone.replace(/\D/g, '').slice(-9)
        const count = Object.entries(unreadMap).reduce((acc, [k, v]) => {
          return k.replace(/\D/g, '').slice(-9) === phoneSuffix ? acc + v : acc
        }, 0)
        return count > 0
      })
    } else if (activeTab === 'paused') {
      result = chats.filter(c => pauseMap[c.customer_phone] === true)
    }

    if (!searchQuery.trim()) return result

    const q = searchQuery.toLowerCase().trim()
    const qDigits = searchQuery.replace(/\D/g, '')

    return result.filter(c => {
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
  }, [chats, searchQuery, activeTab, unreadMap, pauseMap])

  const currentChat = chats.find(c => c.customer_phone === selectedChat)

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center bg-gradient-to-br from-[#0f111a] via-[#151926] to-[#0f111a] rounded-3xl m-4 text-white shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <Building2 className="w-24 h-24 text-indigo-400 mb-6 animate-pulse relative z-10" />
        <h2 className="text-3xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-indigo-200 to-purple-300 bg-clip-text text-transparent relative z-10">Bandeja Omnicanal Exclusiva</h2>
        <p className="text-slate-500 mb-8 max-w-md relative z-10">Gestiona conversaciones reales en tiempo real con IA hiper-personalizada. Selecciona un negocio para iniciar.</p>
        <Link href="/businesses">
          <button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all text-white rounded-full px-8 py-3.5 font-bold shadow-lg shadow-indigo-500/20 relative z-10 active:scale-95 transform">
            Seleccionar Negocio
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-[#0d0e12] rounded-2xl overflow-hidden border border-white/10 shadow-2xl font-sans relative">
      
      {/* ── COL 1: CHAT LIST ── */}
      <div className="w-80 md:w-[400px] flex flex-col border-r border-white/10 bg-[#12141c] shrink-0">
        
        {/* Header List */}
        <div className="h-[68px] px-4 py-2 flex items-center justify-between bg-[#181a24] border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center relative">
              <User className="w-5 h-5 text-indigo-300" />
              {waStatus === 'connected' ? (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#181a24] rounded-full" title="Conectado a WhatsApp" />
              ) : waStatus === 'connecting' ? (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-yellow-500 border-2 border-[#181a24] rounded-full animate-pulse" title="Conectando..." />
              ) : (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 border-2 border-[#181a24] rounded-full" title="Desconectado" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Bandeja de Entrada</p>
              <p className="text-[10px] text-indigo-400 font-bold tracking-wider flex items-center gap-1">
                {waStatus === 'connected' ? 'WHATSAPP ACTIVO' : 'WHATSAPP INACTIVO'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all" 
              onClick={() => setShowNewChatModal(true)} 
              title="Nuevo Chat Manual"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all ${isBotEnabled ? 'text-green-400' : 'text-slate-500'}`} 
              onClick={toggleBot} 
              title={isBotEnabled ? 'Pausar IA Global' : 'Activar IA Global'}
            >
              <Bot className="w-4 h-4" />
            </button>
            <div className="relative">
              <button 
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all" 
                onClick={(e) => { e.stopPropagation(); setShowLeftMenu(!showLeftMenu); }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showLeftMenu && (
                <div className="absolute right-0 top-[45px] w-[220px] bg-[#1a1d29] border border-white/10 rounded-xl shadow-2xl py-2.5 z-50 text-[13.5px] text-slate-300" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { handleStartWhatsApp(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Vincular WhatsApp (QR)
                  </button>
                  <button onClick={() => { loadChats(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-400" /> Refrescar conversaciones
                  </button>
                  <div className="h-px bg-white/10 my-1.5" />
                  <button onClick={() => { handleDisconnect(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-white/5 text-red-400 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Desvincular teléfono
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-[#12141c]">
          <div className="relative bg-[#181a24] border border-white/5 rounded-xl flex items-center px-3 py-2 shadow-inner">
            <Search className="w-4 h-4 text-slate-500 mr-3" />
            <input 
              type="text" 
              placeholder="Buscar chat, teléfono, mensaje..."
              className="bg-transparent border-none focus:ring-0 text-sm w-full py-0 text-slate-200 placeholder:text-slate-300 focus:outline-none"
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#12141c]">
          <button 
            onClick={() => setActiveTab('todos')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'todos' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setActiveTab('unread')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'unread' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
          >
            No leídos
          </button>
          <button 
            onClick={() => setActiveTab('paused')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'paused' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
          >
            IA Pausada
          </button>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingChats ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Sin chats cargados</div>
          ) : (
            filteredChats.map((chat) => {
              const chatPhone = chat.customer_phone
              const phoneSuffix = chatPhone.replace(/\D/g, '').slice(-9)
              const unreadCount = Object.entries(unreadMap).reduce((acc, [k, v]) => {
                return k.replace(/\D/g, '').slice(-9) === phoneSuffix ? acc + v : acc
              }, 0)
              const isBotPaused = pauseMap[chat.customer_phone] || false
              const isSelected = selectedChat === chat.customer_phone
              
              return (
                <div
                  key={chat.customer_phone}
                  onMouseEnter={() => setHoveredChatId(chat.customer_phone)}
                  onMouseLeave={() => setHoveredChatId(null)}
                  className={`relative w-full h-[72px] flex items-center px-4 gap-3 border-b border-white/5 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                  onClick={() => handleSelectChat(chat)}
                >
                  <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0 relative bg-[#181a24] border ${isBotPaused ? 'border-orange-500/50' : 'border-white/10'}`}>
                    {avatars[chat.customer_phone] && avatars[chat.customer_phone] !== 'default' ? (
                      <img src={avatars[chat.customer_phone]} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      <User className={`w-5 h-5 ${isBotPaused ? 'text-orange-400' : 'text-slate-500'}`} />
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[14.5px] text-slate-200 truncate font-semibold">
                        {getDisplayName(chat)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isBotPaused && (
                          <span className="text-[8.5px] bg-orange-500/20 text-orange-400 font-bold px-1.5 py-0.5 rounded-full border border-orange-500/30 uppercase">IA Off</span>
                        )}
                        <span className={`text-[10px] ${isSelected ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
                          {chat.last_message_at ? formatDateLabel(new Date(chat.last_message_at)) : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-[12.5px] text-slate-500 truncate flex items-center gap-1.5 flex-1 min-w-0">
                        {chat.last_direction === 'outgoing' && <CheckCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />}
                        {chat.last_media_type === 'image' && <Paperclip className="w-3 h-3 text-slate-500" />}
                        {chat.last_media_type === 'document' && <Paperclip className="w-3 h-3 text-slate-500" />}
                        {chat.last_media_type === 'video' && <Paperclip className="w-3 h-3 text-slate-500" />}
                        <span className={unreadCount > 0 ? 'font-bold text-slate-100 truncate' : 'truncate text-slate-500'}>{chat.last_message || 'Inicia una conversación.'}</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="ml-2 shrink-0 min-w-[18px] h-[18px] bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 animate-pulse">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Buttons */}
                  {hoveredChatId === chat.customer_phone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-30">
                      <button
                        onClick={(e) => handleToggleBotPause(chat.customer_phone, e)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isBotPaused
                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20'
                            : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20'
                        }`}
                        title={isBotPaused ? 'Reactivar IA' : 'Pausar IA'}
                      >
                        {isBotPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteChatList(chat.customer_phone) }}
                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                        title="Eliminar chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── COL 2: CHAT MAIN ── */}
      <div className="flex-1 flex flex-col bg-[#090a0f] relative">
        {selectedChat ? (
          <>
            {/* Header Chat */}
            <div className="h-[68px] px-5 py-2 flex items-center justify-between bg-[#12141c]/90 backdrop-blur-md z-25 border-b border-white/5">
              {isSelectionMode ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-6">
                    <button onClick={() => { setIsSelectionMode(false); setSelectedMessages([]) }} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-all"><X className="w-5 h-5" /></button>
                    <span className="text-sm text-slate-200 font-medium">{selectedMessages.length} seleccionados</span>
                  </div>
                  <button onClick={handleBulkDelete} className="p-2 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 rounded-lg transition-all"><Trash2 className="w-5 h-5" /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(!showProfile)}>
                      <div className="w-10 h-10 bg-[#181a24] rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                        {avatars[selectedChat] && avatars[selectedChat] !== 'default' ? (
                          <img src={avatars[selectedChat]} className="w-full h-full object-cover" alt="Avatar" />
                        ) : (
                          <User className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm text-slate-200 font-bold leading-none mb-1">{getDisplayName(currentChat || { customer_phone: selectedChat } as Chat)}</h3>
                        <p className="text-[10px] text-emerald-400 leading-none font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> activo
                        </p>
                      </div>
                    </div>

                    {/* Interactive Bot Status Indicator */}
                    {(() => {
                      const isSelectedBotPaused = pauseMap[selectedChat] || false;
                      return (
                        <button
                          onClick={(e) => handleToggleBotPause(selectedChat, e)}
                          className={`ml-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black transition-all border ${
                            isSelectedBotPaused
                              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                              : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                          }`}
                          title={isSelectedBotPaused ? 'Reactivar IA' : 'Silenciar IA'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
                          <span>{isSelectedBotPaused ? 'IA PAUSADA' : 'IA ACTIVA'}</span>
                        </button>
                      );
                    })()}
                  </div>
                  
                  <div className="flex items-center gap-4 text-slate-500">
                    <button className="p-2 hover:bg-white/5 rounded-lg hover:text-white transition-all" onClick={() => setShowChatSearch(!showChatSearch)}>
                       <Search className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button className="p-2 hover:bg-white/5 rounded-lg hover:text-white transition-all" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical className="w-4 h-4" /></button>
                      {showMenu && (
                        <div className="absolute right-0 top-[45px] w-[200px] bg-[#1a1d29] border border-white/10 rounded-xl shadow-2xl py-2 z-50 text-[13.5px] text-slate-300" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setShowProfile(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-white/5">Info. del contacto</button>
                          <button onClick={() => { setIsSelectionMode(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-white/5">Seleccionar mensajes</button>
                          <button onClick={() => { handleClearChat(); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-white/5 text-red-400">Vaciar chat</button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Local Chat Search Bar */}
            {showChatSearch && (
              <div className="px-4 py-2 bg-[#12141c] border-b border-white/5 flex items-center gap-3 z-20 shadow-lg">
                <button onClick={() => { setShowChatSearch(false); setChatSearchQuery('') }} className="hover:bg-white/5 p-1.5 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Buscar mensaje en este chat..." 
                  className="flex-1 text-sm bg-transparent border-none focus:ring-0 text-slate-200 py-1 outline-none"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
                {chatSearchQuery.trim() && (
                  <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 shrink-0 font-bold">
                    {filteredMessages.length === 0 ? 'Sin resultados' : `${filteredMessages.length} coincidencia(s)`}
                  </span>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col p-4 md:px-12 lg:px-20 z-10">
              {/* Starry Dark Overlay background */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>
              
              <div className="relative z-10 flex flex-col space-y-3">
                <div className="self-center bg-yellow-500/10 border border-yellow-500/20 px-4 py-1.5 rounded-full text-[10.5px] text-yellow-500 font-semibold tracking-wider flex items-center gap-2 uppercase">
                   <Shield className="w-3.5 h-3.5" /> Encriptación inteligente y WebSocket activo
                </div>

                {messageGroups.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col space-y-3">
                    <div className="self-center bg-white/5 border border-white/10 px-4 py-1 rounded-full text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-1">
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
                          {isSelectionMode && (
                            <div className="mr-2 flex items-center shrink-0">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-500' : 'border-slate-600 bg-[#12141c]'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                            </div>
                          )}

                          <div className={`max-w-[80%] md:max-w-[70%] px-3 pt-2.5 pb-1 rounded-2xl relative transition-all shadow-md border ${
                            isIncoming 
                              ? (isSelected ? 'bg-slate-800' : 'bg-[#181a24]') + ' text-slate-200 rounded-tl-none border-white/5' 
                              : (isSelected ? 'bg-indigo-900/60' : 'bg-indigo-600/15') + ' text-slate-200 rounded-tr-none border-indigo-500/20'
                          }`}>
                            
                            {/* MULTIMEDIA RENDERER */}
                            {msg.mediaUrl && (
                              <div className="mb-2 overflow-hidden rounded-xl cursor-pointer hover:opacity-95 transition-opacity">
                                {(msg.mediaType === 'image') && (
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt="Imagen adjunta" 
                                    className="max-h-[250px] w-full object-cover rounded-xl border border-white/10"
                                  />
                                )}
                                {(msg.mediaType === 'video') && (
                                  <video 
                                    src={msg.mediaUrl} 
                                    controls 
                                    className="max-h-[250px] w-full rounded-xl border border-white/10"
                                  />
                                )}
                                {(msg.mediaType === 'document') && (
                                  <div 
                                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer backdrop-blur-md shadow-inner"
                                    onClick={() => window.open(msg.mediaUrl, '_blank')}
                                  >
                                    <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-extrabold shadow-md shrink-0">
                                      DOC
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-200 truncate">Documento adjunto</p>
                                      <p className="text-[10px] text-indigo-400 font-semibold">Clic para ver documento</p>
                                    </div>
                                  </div>
                                )}
                                {(msg.mediaType === 'audio') && (
                                  <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg min-w-[200px]">
                                    <audio src={msg.mediaUrl} controls className="w-full h-8 opacity-90" />
                                  </div>
                                )}
                              </div>
                            )}

                            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap pr-10 min-h-[16px] px-1 select-text">
                              {msg.body}
                            </p>
                            
                            <div className="flex items-center gap-1.5 justify-end mt-1.5 px-1">
                              <span className="text-[9.5px] text-slate-500">
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
                                <div className="flex items-center gap-1 shrink-0 select-none scale-90">
                                  {msg.source === 'bot' && (
                                    <span className="text-[8.5px] text-green-400 bg-green-500/10 font-black px-1.5 py-0.5 rounded border border-green-500/20 uppercase tracking-widest">
                                      🤖 AI
                                    </span>
                                  )}
                                  {msg.status === 'read' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                                  ) : msg.status === 'delivered' || msg.status === 'sent' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Dropdown Menu */}
                            {!isSelectionMode && (
                              <div className="absolute right-1 top-1.5 opacity-0 group-hover/msg:opacity-100 transition-all duration-150">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(openMsgMenuId === msg.id ? null : msg.id) }} 
                                  className="p-1 rounded-full bg-[#1e2230] border border-white/5 text-slate-500 hover:text-slate-200 shadow-lg"
                                >
                                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                                </button>
                                {openMsgMenuId === msg.id && (
                                  <div className="absolute right-0 top-7 w-[150px] bg-[#1a1d29] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 text-[13px] font-normal text-left">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id) }} className="w-full text-left px-4 py-2 hover:bg-white/5 text-red-400">Eliminar</button>
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(null); toggleMessageSelection(msg.id) }} className="w-full text-left px-4 py-2 hover:bg-white/5 text-slate-300">Seleccionar</button>
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

            {/* Input Send Message Area */}
            <div className="px-5 py-3.5 bg-[#12141c] flex items-center gap-3 border-t border-white/5 relative z-20">
              
              {/* EMOJI PICKER */}
              {showEmojiPicker && (
                <div className="absolute bottom-[70px] left-4 bg-[#1a1d29] border border-white/10 shadow-2xl rounded-xl p-3 w-[290px] z-50 grid grid-cols-5 gap-2" onClick={(e) => e.stopPropagation()}>
                  {['😀','😂','😍','😎','🙏','👍','🔥','✨','🚀','❤️','💡','💰','🤖','✅','❌','📦','🚚','🛍️','📈','🚨'].map(emoji => (
                    <button key={emoji} type="button" className="text-xl hover:bg-white/5 rounded p-1.5 transition-colors" onClick={() => { setMessageInput(prev => prev + emoji) }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-500">
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="p-2 hover:bg-white/5 rounded-lg hover:text-white transition-all">
                  <Smile className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={handleFileUpload}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/5 rounded-lg hover:text-white transition-all">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center bg-[#090a0f] border border-white/5 focus-within:border-indigo-500/40 rounded-xl px-3.5 py-2.5 shadow-inner">
                <input 
                  type="text" 
                  placeholder="Escribe un mensaje aquí..."
                  className="bg-transparent border-none focus:ring-0 text-[14px] w-full py-0 text-slate-200 placeholder:text-slate-200 focus:outline-none"
                  value={messageInput} 
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={sending}
                />
              </form>
              
              <div className="text-slate-500">
                {messageInput.trim() ? (
                  <button onClick={() => handleSendMessage()} className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all scale-105"><Send className="w-4 h-4" /></button>
                ) : (
                  <button type="button" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 transition-all"><Mic className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#090a0f] z-10 relative">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>
            <div className="w-[260px] opacity-20 mb-8 filter invert drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5z23.png" alt="WhatsApp Web" />
            </div>
            <h3 className="text-2xl font-light text-slate-200 mb-3 tracking-wide">Sysbot Live Chat Omnicanal</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
              Consola unificada premium conectada con WhatsApp, IA y base de datos multi-tenant aislada.
            </p>
            <div className="mt-12 flex items-center gap-2 text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs font-bold shadow-md">
               <Shield className="w-3.5 h-3.5" /> Servidor Socket.IO sincronizado
            </div>
          </div>
        )}
      </div>

      {/* ── COL 3: PROFILE SIDEBAR ── */}
      {selectedChat && showProfile && (
        <div className="w-[360px] border-l border-white/10 bg-[#12141c] flex flex-col z-30 shrink-0">
          <div className="h-[68px] px-5 flex items-center gap-4 bg-[#181a24] text-slate-200 border-b border-white/5">
            <button onClick={() => setShowProfile(false)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <span className="text-sm font-bold">Perfil del Cliente</span>
          </div>
          
          <div className="overflow-y-auto flex-1 bg-[#090a0f] custom-scrollbar">
             {/* Photo & Name */}
             <div className="bg-[#12141c] px-6 py-8 flex flex-col items-center border-b border-white/5 mb-3">
                <div className="w-32 h-32 bg-[#181a24] rounded-full flex items-center justify-center overflow-hidden mb-4 border-2 border-indigo-500/20 shadow-2xl">
                  {avatars[selectedChat] && avatars[selectedChat] !== 'default' ? (
                    <img src={avatars[selectedChat]} className="w-full h-full object-cover" alt="Avatar" />
                  ) : (
                    <User className="w-16 h-16 text-slate-500" />
                  )}
                </div>
                <h4 className="text-base text-slate-200 font-bold mb-1 text-center">{getDisplayName(currentChat || {} as Chat)}</h4>
                <p className="text-xs text-indigo-400 font-semibold">{formatPhone(selectedChat)}</p>
             </div>

             {/* CRM Integration */}
             <div className="p-4">
               {loadingProfile ? (
                 <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
               ) : profile ? (
                 <div className="space-y-3">
                   <div className="bg-[#12141c] p-4 rounded-xl border border-white/5 shadow-md">
                      <p className="text-[10px] text-indigo-400 font-black mb-3 uppercase tracking-wider">RESUMEN DE NEGOCIO</p>
                      <div className="space-y-2.5 text-xs text-slate-300">
                        <div className="flex justify-between items-center">
                          <span>Total Pedidos:</span>
                          <span className="font-bold text-slate-200 bg-white/5 px-2 py-0.5 rounded">{profile.stats.total_orders}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Inversión Total:</span>
                          <span className="font-bold text-emerald-400">S/ {Number(profile.stats.total_spent).toFixed(2)}</span>
                        </div>
                        {Number(profile.stats.total_pending) > 0 && (
                          <div className="flex justify-between items-center text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 mt-2 font-bold">
                            <span>Saldo Pendiente:</span>
                            <span>S/ {Number(profile.stats.total_pending).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                   </div>

                   {profile.lastOrders && profile.lastOrders.length > 0 && (
                     <div className="bg-[#12141c] p-4 rounded-xl border border-white/5 shadow-md">
                        <p className="text-[10px] text-slate-500 font-black mb-3 uppercase tracking-wider">ÚLTIMOS PEDIDOS</p>
                        <div className="space-y-3">
                          {profile.lastOrders.map((order: any) => (
                            <div key={order.id} className="border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="font-semibold text-slate-300">#{order.id.slice(0, 8).toUpperCase()}</span>
                                <span className="text-slate-500">{format(new Date(order.created_at), 'dd/MM/yy')}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-500 capitalize">{order.status}</span>
                                <span className="font-bold text-slate-200">S/ {Number(order.total).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="bg-[#12141c] p-4 rounded-xl border border-white/5 text-center text-xs text-slate-500 shadow-md">
                   Sin historial de compras en CRM
                 </div>
               )}
             </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CHAT */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center backdrop-blur-md">
          <div className="bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-[60px] px-6 flex items-center justify-between bg-indigo-600 text-white">
              <span className="text-sm font-bold uppercase tracking-wider">Nuevo Chat Directo</span>
              <button onClick={() => setShowNewChatModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 bg-[#090a0f]">
              <p className="text-xs text-slate-500 mb-4">Ingresa el número con prefijo de país. Ej. 51924678473 (Perú)</p>
              <form onSubmit={handleStartNewChat}>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Ej: 51924678473"
                  className="w-full bg-[#12141c] border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-5"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewChatModal(false)} className="px-4 py-2 text-xs text-slate-500 hover:bg-white/5 rounded-xl font-bold">Cancelar</button>
                  <button type="submit" className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/25">Iniciar Conversación</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VINCULACIÓN QR / PAIRING */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md">
          <div className="bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-[60px] px-6 flex items-center justify-between bg-indigo-600 text-white">
              <span className="text-sm font-bold uppercase tracking-wider">Vincular Dispositivo</span>
              <button onClick={() => { setShowQrModal(false); setQrCode(null); setPairingCode(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 bg-[#090a0f] flex flex-col items-center text-center">
              
              {!qrCode && !pairingCode ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500">Generando puente seguro...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-300 mb-6">
                    Abre WhatsApp en tu teléfono, ingresa a Dispositivos vinculados y escanea el código QR a continuación:
                  </p>
                  
                  {qrCode && (
                    <div className="bg-white p-4 rounded-2xl shadow-2xl border border-white/10 mb-6">
                      <img src={qrCode} alt="WhatsApp Web QR Code" className="w-[200px] h-[200px]" />
                    </div>
                  )}

                  {pairingCode && (
                    <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl mb-6">
                      <p className="text-[10px] text-indigo-400 font-bold mb-1 uppercase tracking-wider">CÓDIGO DE VINCULACIÓN</p>
                      <p className="text-3xl font-black text-slate-100 tracking-widest">{pairingCode}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1 text-[11px] font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" /> Sincronización en curso
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
