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
  RefreshCw, LogOut, CheckCircle2, Instagram
} from 'lucide-react'
import Link from 'next/link'
import { formatDateTime, cn } from '@/lib/utils'
import { format, isToday, isYesterday, isSameDay, isWithinInterval, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  id: string
  body: string
  direction: 'incoming' | 'outgoing'
  source?: 'whatsapp_web' | 'provider_api' | 'admin_api' | 'bot' | 'system'
  created_at: string
  status: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | 'document' | 'audio'
  platform?: string
}

interface Chat {
  customer_phone: string
  customer_name?: string
  customer_pushname?: string
  last_message: string
  last_message_at: string
  last_direction: 'incoming' | 'outgoing'
  last_media_type?: 'image' | 'video' | 'document' | 'audio'
  platform?: string
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
  const [activeTab, setActiveTab] = useState<'todos' | 'active' | 'paused'>('todos')
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'whatsapp' | 'instagram' | 'telegram' | 'messenger'>('all')
  const [quickNotes, setQuickNotes] = useState<string>('')

  useEffect(() => {
    if (selectedChat) {
      const saved = localStorage.getItem(`notes_${selectedChat}`) || ''
      setQuickNotes(saved)
    }
  }, [selectedChat])

  const handleSaveQuickNotes = (val: string) => {
    setQuickNotes(val)
    if (selectedChat) {
      localStorage.setItem(`notes_${selectedChat}`, val)
    }
  }
  
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
      const res = await livechatApi.getChats(selectedBusiness.id)
      const chatList = (res as any).data?.chats || res.data || [];
      if (Array.isArray(chatList)) {
        setChats(chatList)
        if (chatList.length > 0) {
          try {
            const phones = chatList.map((c: any) => c.customer_phone)
            const pauseRes = await livechatApi.getPauseStatuses(phones, selectedBusiness.id)
            const pauseData = pauseRes.data?.data || pauseRes.data?.statuses || pauseRes.data
            if (pauseData) setPauseMap(pauseData)
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
      const res = await livechatApi.getBotEnabled(selectedBusiness.id)
      const data = (res as any).data || res;
      setIsBotEnabled(!!data.enabled)
    } catch (e) {}
  }, [selectedBusiness])

  const loadWhatsAppStatus = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const res = await livechatApi.getStatus(selectedBusiness.id)
      const data = (res as any).data || res;
      setWaStatus(data.status || 'disconnected')
    } catch (e) {}
  }, [selectedBusiness])

  // Cargar avatares
  const loadAvatar = async (phone: string) => {
    if (avatars[phone]) return
    try {
      const res = await livechatApi.getAvatar(phone, selectedBusiness?.id)
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
      const res = await livechatApi.getChatMessages(phone, selectedBusiness?.id)
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
      const res = await livechatApi.getCustomerProfile(phone, selectedBusiness?.id)
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

  const [billingLoading, setBillingLoading] = useState(false)

  const handleGenerateInvoice = async () => {
    if (!selectedChat) return
    try {
      setBillingLoading(true)
      const displayName = getDisplayName(currentChat || { customer_phone: selectedChat } as Chat)
      const cleanPhone = selectedChat.split('@')[0]
      const pendingAmount = profile?.stats?.total_pending || 120.00
      
      const res = await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone: cleanPhone,
          customerName: displayName,
          amount: pendingAmount,
          items: [
            {
              description: 'Atención Médica / Consulta Virtual Integrada',
              quantity: 1,
              unitPrice: pendingAmount,
            }
          ]
        })
      })
      const data = await res.json()
      if (data.success) {
        toast({
          title: `Boleta Emitida: ${data.invoiceNumber}`,
          description: `Monto total: S/ ${data.total}. XML/JSON estructurado para SUNAT.`,
        })
        
        // Simular el envío del comprobante al chat optimísticamente
        const invoiceMsg: Message = {
          id: `inv-${Date.now()}`,
          body: `📄 Se emitió la boleta electrónica ${data.invoiceNumber} por un total de S/ ${data.total}.`,
          direction: 'outgoing',
          source: 'admin_api',
          created_at: new Date().toISOString(),
          status: 'sent'
        }
        setMessages(prev => [...prev, invoiceMsg])
      } else {
        throw new Error(data.message)
      }
    } catch (e: any) {
      toast({
        title: 'Error de Facturación',
        description: e.message || 'No se pudo emitir la boleta electrónica.',
        variant: 'destructive',
      })
    } finally {
      setBillingLoading(false)
    }
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
      const res: any = await livechatApi.sendMessage(selectedChat, userMsg, undefined, selectedBusiness?.id)
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
        const res: any = await livechatApi.sendMessage(selectedChat, messageInput, base64, selectedBusiness?.id)
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
      await livechatApi.toggleBot(newStatus, selectedBusiness?.id)
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
      await livechatApi.pauseBotForChat(phone, newPaused, selectedBusiness?.id)
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
      await livechatApi.disconnectWhatsApp(selectedBusiness?.id)
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
      const res: any = await livechatApi.startWhatsApp(usePairingCode, pairingNumber, selectedBusiness?.id)
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
      await livechatApi.deleteMessage(id, selectedBusiness?.id)
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
      await livechatApi.clearChat(selectedChat, selectedBusiness?.id)
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
      await livechatApi.clearChat(phone, selectedBusiness?.id)
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
        await livechatApi.deleteMessage(id, selectedBusiness?.id)
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
      socket.emit('joinUser', (selectedBusiness as any).userId || 'user-default')
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
      socket.emit('leaveUser', (selectedBusiness as any).userId || 'user-default')
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
    if (activeTab === 'active') {
      result = chats.filter(c => pauseMap[c.customer_phone] !== true)
    } else if (activeTab === 'paused') {
      result = chats.filter(c => pauseMap[c.customer_phone] === true)
    }

    // Filtrar por canal
    if (selectedChannel !== 'all') {
      result = result.filter(c => (c.platform || 'whatsapp') === selectedChannel)
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
  }, [chats, searchQuery, activeTab, selectedChannel, unreadMap, pauseMap])

  const currentChat = chats.find(c => c.customer_phone === selectedChat)

  const renderMessageBody = (body: string, source?: string) => {
    const isAi = source === 'bot'
    if (!isAi) {
      return <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap select-text px-1 text-slate-755">{body}</p>
    }

    // Check for suggestions like [Jueves, 14 Nov - 11:00 AM (Sugerir)]
    const regex = /\[([^\]]+)\]/g
    const parts = []
    let lastIndex = 0
    let match
    
    while ((match = regex.exec(body)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={lastIndex} className="text-slate-755">{body.substring(lastIndex, match.index)}</span>)
      }
      
      const suggestionText = match[1]
      const cleanText = suggestionText.replace('(Sugerir)', '').trim()
      parts.push(
        <span key={match.index} className="block mt-2 p-3 bg-white border border-violet-100 rounded-xl shadow-xs font-sans text-xs">
          <span className="font-bold text-violet-700 block mb-1">📅 Sugerencia de Horario</span>
          <span className="text-slate-600 block mb-2">{cleanText}</span>
          <button 
            type="button"
            onClick={() => {
              toast({
                title: 'Sugerencia Enviada',
                description: `Se agendó la sugerencia: ${cleanText}`,
              })
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors inline-flex items-center gap-1"
          >
            Agendar (Sugerir)
          </button>
        </span>
      )
      lastIndex = regex.lastIndex
    }
    
    if (lastIndex < body.length) {
      parts.push(<span key={lastIndex} className="text-slate-755">{body.substring(lastIndex)}</span>)
    }
    
    return (
      <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap select-text px-1">
        {parts.length > 0 ? parts : body}
      </div>
    )
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-3xl m-4 text-white shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <Building2 className="w-24 h-24 text-blue-400 mb-6 animate-pulse relative z-10" />
        <h2 className="text-3xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent relative z-10">Bandeja Omnicanal Exclusiva</h2>
        <p className="text-slate-400 mb-8 max-w-md relative z-10">Gestiona conversaciones reales en tiempo real con IA hiper-personalizada. Selecciona un negocio para iniciar.</p>
        <Link href="/businesses">
          <button className="bg-blue-600 hover:bg-blue-700 transition-all text-white rounded-xl px-8 py-3.5 font-bold shadow-lg shadow-blue-500/20 relative z-10 active:scale-95 transform">
            Seleccionar Negocio
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/60 shadow-lg font-sans relative">
      
      {/* ── COL 1: CHAT LIST ── */}
      <div className="w-80 md:w-[400px] flex flex-col border-r border-slate-200 bg-slate-50 shrink-0">
        
        {/* Header List */}
        <div className="h-[68px] px-4 py-2 flex items-center justify-between bg-white border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center relative">
              <User className="w-5 h-5 text-blue-600" />
              {waStatus === 'connected' ? (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" title="Conectado a WhatsApp" />
              ) : waStatus === 'connecting' ? (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-yellow-500 border-2 border-white rounded-full animate-pulse" title="Conectando..." />
              ) : (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full" title="Desconectado" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-700 font-bold font-syst">Bandeja de Entrada</p>
              <p className="text-[9px] text-blue-600 font-black tracking-widest flex items-center gap-1">
                {waStatus === 'connected' ? 'WHATSAPP ACTIVO' : 'WHATSAPP INACTIVO'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all" 
              onClick={() => setShowNewChatModal(true)} 
              title="Nuevo Chat Manual"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              className={`p-2 rounded-lg transition-all ${isBotEnabled ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} 
              onClick={toggleBot} 
              title={isBotEnabled ? 'Pausar IA Global' : 'Activar IA Global'}
            >
              <Bot className="w-4 h-4" />
            </button>
            <div className="relative">
              <button 
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all" 
                onClick={(e) => { e.stopPropagation(); setShowLeftMenu(!showLeftMenu); }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showLeftMenu && (
                <div className="absolute right-0 top-[45px] w-[220px] bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-[13px] text-slate-700" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { handleStartWhatsApp(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Vincular WhatsApp (QR)
                  </button>
                  <button onClick={() => { loadChats(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium">
                    <RefreshCw className="w-4 h-4 text-emerald-600" /> Refrescar conversaciones
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                  <button onClick={() => { handleDisconnect(); setShowLeftMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-red-600 flex items-center gap-2 font-medium">
                    <LogOut className="w-4 h-4" /> Desvincular teléfono
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/50">
          <div className="relative bg-white border border-slate-200 rounded-xl flex items-center px-3 py-2 shadow-xs">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar chat, teléfono..."
              className="bg-transparent border-none focus:ring-0 text-xs w-full py-0 text-slate-700 placeholder:text-slate-400 focus:outline-none"
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs & Channel Circles */}
        <div className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('todos')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'todos' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'active' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              IA Activa
            </button>
            <button 
              onClick={() => setActiveTab('paused')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'paused' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Humano
            </button>
          </div>
          
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Canales</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedChannel('all')}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${selectedChannel === 'all' ? 'bg-slate-800 border-slate-800 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                title="Todos"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setSelectedChannel('whatsapp')}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${selectedChannel === 'whatsapp' ? 'bg-green-600 border-green-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-green-600'}`}
                title="WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setSelectedChannel('instagram')}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${selectedChannel === 'instagram' ? 'bg-pink-600 border-pink-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-pink-600'}`}
                title="Instagram"
              >
                <Instagram className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setSelectedChannel('telegram')}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${selectedChannel === 'telegram' ? 'bg-sky-500 border-sky-500 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-sky-500'}`}
                title="Telegram"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setSelectedChannel('messenger')}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${selectedChannel === 'messenger' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-blue-600'}`}
                title="Facebook Messenger"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {loadingChats ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium uppercase tracking-wider">Sin chats cargados</div>
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
                  className={`relative w-full h-[72px] flex items-center px-4 gap-3 border-b border-slate-200/50 cursor-pointer transition-all duration-200 ${isSelected ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] border-l-4 border-l-blue-600' : 'hover:bg-white/50 border-l-4 border-l-transparent'}`}
                  onClick={() => handleSelectChat(chat)}
                >
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-white border ${isBotPaused ? 'border-orange-300' : 'border-slate-200'}`}>
                      {avatars[chat.customer_phone] && avatars[chat.customer_phone] !== 'default' ? (
                        <img src={avatars[chat.customer_phone]} className="w-full h-full object-cover" alt="Avatar" />
                      ) : (
                        <User className={`w-5 h-5 ${isBotPaused ? 'text-orange-500' : 'text-slate-400'}`} />
                      )}
                    </div>
                    {/* Platform Badge Overlay */}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 rounded-full p-0.5 border text-white shadow-sm flex items-center justify-center w-5 h-5",
                      chat.platform === 'telegram' && "bg-sky-500 border-sky-400",
                      chat.platform === 'messenger' && "bg-blue-600 border-blue-500",
                      chat.platform === 'instagram' && "bg-pink-600 border-pink-500",
                      (chat.platform === 'whatsapp' || !chat.platform) && "bg-green-600 border-green-500"
                    )}>
                      {chat.platform === 'telegram' && <Send className="w-2.5 h-2.5" />}
                      {chat.platform === 'messenger' && <MessageCircle className="w-2.5 h-2.5" />}
                      {chat.platform === 'instagram' && <Instagram className="w-2.5 h-2.5" />}
                      {(chat.platform === 'whatsapp' || !chat.platform) && <MessageSquare className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[14px] text-slate-800 truncate font-bold font-syst">
                        {getDisplayName(chat)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isBotPaused && (
                          <span className="text-[8px] bg-orange-50 text-orange-600 font-black px-1.5 py-0.5 rounded-full border border-orange-100 uppercase">HUMANO</span>
                        )}
                        <span className={`text-[10px] ${isSelected ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'}`}>
                          {chat.last_message_at ? formatDateLabel(new Date(chat.last_message_at)) : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-[12.5px] text-slate-500 truncate flex items-center gap-1.5 flex-1 min-w-0 font-medium">
                        {chat.last_direction === 'outgoing' && <CheckCheck className="w-3.5 h-3.5 shrink-0 text-blue-500" />}
                        {chat.last_media_type === 'image' && <Paperclip className="w-3 h-3 text-slate-400" />}
                        {chat.last_media_type === 'document' && <Paperclip className="w-3 h-3 text-slate-400" />}
                        {chat.last_media_type === 'video' && <Paperclip className="w-3 h-3 text-slate-400" />}
                        <span className={unreadCount > 0 ? 'font-black text-slate-800 truncate' : 'truncate text-slate-500'}>{chat.last_message || 'Inicia una conversación.'}</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="ml-2 shrink-0 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
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
                            ? 'bg-green-55 text-green-600 hover:bg-green-100 border-green-200'
                            : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200'
                        }`}
                        title={isBotPaused ? 'Reactivar IA' : 'Pausar IA'}
                      >
                        {isBotPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteChatList(chat.customer_phone) }}
                        className="p-1.5 rounded-lg bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 transition-all"
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
      <div className="flex-1 flex flex-col bg-white relative">
        {selectedChat ? (
          <>
            {/* Header Chat */}
            <div className="h-[68px] px-5 py-2 flex items-center justify-between bg-white border-b border-slate-200/60 z-20">
              {isSelectionMode ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-6">
                    <button onClick={() => { setIsSelectionMode(false); setSelectedMessages([]) }} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-all"><X className="w-5 h-5" /></button>
                    <span className="text-sm text-slate-700 font-bold">{selectedMessages.length} seleccionados</span>
                  </div>
                  <button onClick={handleBulkDelete} className="p-2 bg-red-50 text-red-600 hover:bg-red-150 border border-red-150 rounded-lg transition-all"><Trash2 className="w-5 h-5" /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(!showProfile)}>
                      <div className="relative">
                        <div className="w-10 h-10 bg-slate-55 rounded-full flex items-center justify-center overflow-hidden border border-slate-200">
                          {avatars[selectedChat] && avatars[selectedChat] !== 'default' ? (
                            <img src={avatars[selectedChat]} className="w-full h-full object-cover" alt="Avatar" />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 rounded-full p-0.5 border text-white shadow-sm flex items-center justify-center w-[18px] h-[18px]",
                          currentChat?.platform === 'telegram' && "bg-sky-500 border-sky-400",
                          currentChat?.platform === 'messenger' && "bg-blue-600 border-blue-500",
                          currentChat?.platform === 'instagram' && "bg-pink-600 border-pink-500",
                          (currentChat?.platform === 'whatsapp' || !currentChat?.platform) && "bg-green-600 border-green-500"
                        )}>
                          {currentChat?.platform === 'telegram' && <Send className="w-2.5 h-2.5" />}
                          {currentChat?.platform === 'messenger' && <MessageCircle className="w-2.5 h-2.5" />}
                          {currentChat?.platform === 'instagram' && <Instagram className="w-2.5 h-2.5" />}
                          {(currentChat?.platform === 'whatsapp' || !currentChat?.platform) && <MessageSquare className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm text-slate-800 font-bold leading-none mb-1 font-syst">{getDisplayName(currentChat || { customer_phone: selectedChat } as Chat)}</h3>
                        <p className="text-[10px] text-emerald-600 leading-none font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> activo
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
                              ? 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100'
                              : 'bg-green-50 border-green-100 text-green-600 hover:bg-green-100'
                          }`}
                          title={isSelectedBotPaused ? 'Reactivar IA' : 'Silenciar IA'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          <span>{isSelectedBotPaused ? 'IA PAUSADA' : 'IA ACTIVA'}</span>
                        </button>
                      );
                    })()}
                  </div>
                  
                  <div className="flex items-center gap-4 text-slate-450">
                    <button className="p-2 hover:bg-slate-100 rounded-lg hover:text-slate-705 transition-all" onClick={() => setShowChatSearch(!showChatSearch)}>
                       <Search className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button className="p-2 hover:bg-slate-100 rounded-lg hover:text-slate-705 transition-all" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}><MoreVertical className="w-4 h-4" /></button>
                      {showMenu && (
                        <div className="absolute right-0 top-[45px] w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-[13px] text-slate-700" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setShowProfile(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium">Info. del contacto</button>
                          <button onClick={() => { setIsSelectionMode(true); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium">Seleccionar mensajes</button>
                          <button onClick={() => { handleClearChat(); setShowMenu(false) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-red-650 font-medium">Vaciar chat</button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Local Chat Search Bar */}
            {showChatSearch && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-3 z-20 shadow-sm">
                <button onClick={() => { setShowChatSearch(false); setChatSearchQuery('') }} className="hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Buscar mensaje en este chat..." 
                  className="flex-1 text-xs bg-transparent border-none focus:ring-0 text-slate-700 py-1 outline-none font-medium"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
                {chatSearchQuery.trim() && (
                  <span className="text-[10px] text-blue-650 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 shrink-0 font-bold">
                    {filteredMessages.length === 0 ? 'Sin resultados' : `${filteredMessages.length} coincidencia(s)`}
                  </span>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto relative flex flex-col p-4 md:px-12 lg:px-20 z-10 bg-slate-50/20">
              <div className="relative z-10 flex flex-col space-y-3">
                <div className="self-center bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full text-[10.5px] text-blue-700 font-bold tracking-wider flex items-center gap-2 uppercase">
                   <Shield className="w-3.5 h-3.5" /> Encriptación inteligente y WebSocket activo
                </div>

                {messageGroups.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col space-y-3">
                    <div className="self-center bg-slate-100 border border-slate-200 px-3.5 py-1 rounded-full text-[10px] text-slate-500 uppercase tracking-wider font-black mb-1">
                      {formatDateLabel(group.date)}
                    </div>
                    {group.messages.map((msg, idx) => {
                      const isIncoming = msg.direction === 'incoming'
                      const isSelected = selectedMessages.includes(msg.id)
                      const isAi = msg.source === 'bot'
                      const isSystem = msg.body.includes('actualizó la cita en el CRM') || msg.body.includes('Se emitió la boleta electrónica') || msg.source === 'system'

                      if (isSystem) {
                        return (
                          <div key={msg.id || idx} className="self-center bg-blue-50 border border-blue-100 px-4 py-3 rounded-2xl text-xs text-blue-800 font-semibold max-w-[85%] shadow-xs flex items-start gap-3 my-2">
                            <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-[11px] uppercase tracking-wider text-blue-900 font-syst">CRM Sync</p>
                              <p className="text-slate-600 text-[12px] mt-0.5 font-medium">{msg.body}</p>
                            </div>
                          </div>
                        )
                      }
                      
                      return (
                        <div 
                          key={msg.id || idx} 
                          className={`flex group/msg relative ${isIncoming ? 'justify-start' : 'justify-end'}`}
                          onClick={() => isSelectionMode && toggleMessageSelection(msg.id)}
                        >
                          {isSelectionMode && (
                            <div className="mr-2 flex items-center shrink-0">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                            </div>
                          )}

                          <div className={`max-w-[80%] md:max-w-[70%] px-3.5 pt-2.5 pb-1 rounded-2xl relative transition-all shadow-xs border ${
                            isIncoming 
                              ? 'bg-white text-slate-700 rounded-tl-none border-slate-200/60' 
                              : isAi
                                ? 'bg-violet-50 text-violet-900 rounded-tr-none border-violet-100 shadow-[0_2px_8px_rgba(139,92,246,0.04)]'
                                : 'bg-blue-600 text-white rounded-tr-none border-blue-600'
                          }`}>
                            {/* Platform badge for incoming message */}
                            {isIncoming && (
                              <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
                                {msg.platform === 'telegram' && <Send className="w-3 h-3 text-sky-500" />}
                                {msg.platform === 'messenger' && <MessageCircle className="w-3 h-3 text-blue-500" />}
                                {msg.platform === 'instagram' && <Instagram className="w-3 h-3 text-pink-500" />}
                                {(msg.platform === 'whatsapp' || !msg.platform) && <MessageSquare className="w-3 h-3 text-green-500" />}
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
                                  {msg.platform || 'whatsapp'}
                                </span>
                              </div>
                            )}
                            
                            {/* MULTIMEDIA RENDERER */}
                            {msg.mediaUrl && (
                              <div className="mb-2 overflow-hidden rounded-xl cursor-pointer hover:opacity-95 transition-opacity">
                                {(msg.mediaType === 'image') && (
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt="Imagen adjunta" 
                                    className="max-h-[250px] w-full object-cover rounded-xl border border-slate-200"
                                  />
                                )}
                                {(msg.mediaType === 'video') && (
                                  <video 
                                    src={msg.mediaUrl} 
                                    controls 
                                    className="max-h-[250px] w-full rounded-xl border border-slate-200"
                                  />
                                )}
                                {(msg.mediaType === 'document') && (
                                  <div 
                                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
                                    onClick={() => window.open(msg.mediaUrl, '_blank')}
                                  >
                                    <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white font-extrabold shadow-sm shrink-0 text-xs">
                                      PDF
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-700 truncate font-syst">Documento adjunto</p>
                                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Ver Documento</p>
                                    </div>
                                  </div>
                                )}
                                {(msg.mediaType === 'audio') && (
                                  <div className="flex items-center gap-2 p-2 bg-slate-55 rounded-lg min-w-[200px] border border-slate-200">
                                    <audio src={msg.mediaUrl} controls className="w-full h-8 opacity-90" />
                                  </div>
                                )}
                              </div>
                            )}

                            {renderMessageBody(msg.body, msg.source)}
                            
                            <div className="flex items-center gap-1.5 justify-end mt-1.5 px-1">
                              <span className={`text-[9px] ${!isIncoming && !isAi ? 'text-blue-250' : 'text-slate-400'}`}>
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
                                  {isAi && (
                                    <span className="text-[8px] text-violet-600 bg-violet-100 font-black px-1.5 py-0.5 rounded border border-violet-200 uppercase tracking-widest">
                                      🤖 AI
                                    </span>
                                  )}
                                  {msg.status === 'read' ? (
                                    <CheckCheck className={`w-3.5 h-3.5 ${isAi ? 'text-violet-500' : 'text-white'}`} />
                                  ) : msg.status === 'delivered' || msg.status === 'sent' ? (
                                    <CheckCheck className={`w-3.5 h-3.5 ${isAi ? 'text-slate-400' : 'text-slate-200'}`} />
                                  ) : (
                                    <Clock className={`w-3.5 h-3.5 ${isAi ? 'text-slate-450' : 'text-slate-300'}`} />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Dropdown Menu */}
                            {!isSelectionMode && (
                              <div className="absolute right-1 top-1.5 opacity-0 group-hover/msg:opacity-100 transition-all duration-150">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(openMsgMenuId === msg.id ? null : msg.id) }} 
                                  className="p-1 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 shadow-md"
                                >
                                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                                </button>
                                {openMsgMenuId === msg.id && (
                                  <div className="absolute right-0 top-7 w-[150px] bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-[13px] font-normal text-left text-slate-700">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id) }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-red-650">Eliminar</button>
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(null); toggleMessageSelection(msg.id) }} className="w-full text-left px-4 py-2 hover:bg-slate-50">Seleccionar</button>
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
            <div className="px-5 py-3.5 bg-slate-50 flex items-center gap-3 border-t border-slate-200/60 relative z-20">
              
              {/* EMOJI PICKER */}
              {showEmojiPicker && (
                <div className="absolute bottom-[70px] left-4 bg-white border border-slate-200 shadow-xl rounded-xl p-3 w-[290px] z-50 grid grid-cols-5 gap-2" onClick={(e) => e.stopPropagation()}>
                  {['😀','😂','😍','😎','🙏','👍','🔥','✨','🚀','❤️','💡','💰','🤖','✅','❌','📦','🚚','🛍️','📈','🚨'].map(emoji => (
                    <button key={emoji} type="button" className="text-xl hover:bg-slate-55 rounded p-1.5 transition-colors" onClick={() => { setMessageInput(prev => prev + emoji) }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-400">
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="p-2 hover:bg-slate-100 rounded-lg hover:text-slate-600 transition-all">
                  <Smile className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={handleFileUpload}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-100 rounded-lg hover:text-slate-600 transition-all">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center bg-white border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 rounded-xl px-3.5 py-2.5 shadow-xs">
                <input 
                  type="text" 
                  placeholder="Escribe un mensaje aquí..."
                  className="bg-transparent border-none focus:ring-0 text-[14px] w-full py-0 text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  value={messageInput} 
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={sending}
                />
              </form>
              
              <div className="text-slate-400">
                {messageInput.trim() ? (
                  <button onClick={() => handleSendMessage()} className="p-2.5 bg-blue-600 hover:bg-blue-750 text-white rounded-xl shadow-md transition-all scale-105"><Send className="w-4 h-4" /></button>
                ) : (
                  <button type="button" className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all"><Mic className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/30 z-10 relative">
            <div className="w-[180px] opacity-15 mb-8">
              <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5z23.png" alt="WhatsApp Web" />
            </div>
            <h3 className="text-2xl font-light text-slate-700 mb-3 tracking-wide font-syst">Sysbot Live Chat Omnicanal</h3>
            <p className="text-slate-450 text-xs max-w-sm mx-auto leading-relaxed font-medium">
              Consola unificada premium conectada con WhatsApp, IA y base de datos multi-tenant aislada.
            </p>
            <div className="mt-12 flex items-center gap-2 text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-xs font-black shadow-xs">
               <Shield className="w-3.5 h-3.5" /> Servidor Socket.IO sincronizado
            </div>
          </div>
        )}
      </div>

      {/* ── COL 3: PROFILE SIDEBAR ── */}
      {selectedChat && showProfile && (
        <div className="w-[360px] border-l border-slate-200 bg-slate-50 flex flex-col z-30 shrink-0">
          <div className="h-[68px] px-5 flex items-center gap-4 bg-white text-slate-800 border-b border-slate-200/60">
            <button onClick={() => setShowProfile(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <span className="text-sm font-bold font-syst">Perfil del Cliente</span>
          </div>
          
          <div className="overflow-y-auto flex-1 bg-slate-50/50 custom-scrollbar p-4 space-y-4">
             {/* Photo & Name */}
             <div className="bg-white border border-slate-200/60 px-6 py-6 flex flex-col items-center rounded-2xl shadow-xs">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center overflow-hidden mb-3.5 border border-slate-200 shadow-sm">
                  {avatars[selectedChat] && avatars[selectedChat] !== 'default' ? (
                    <img src={avatars[selectedChat]} className="w-full h-full object-cover" alt="Avatar" />
                  ) : (
                    <User className="w-10 h-10 text-slate-400" />
                  )}
                </div>
                <h4 className="text-sm text-slate-800 font-bold mb-1 text-center font-syst">{getDisplayName(currentChat || {} as Chat)}</h4>
                <p className="text-xs text-blue-600 font-bold font-mono">{formatPhone(selectedChat)}</p>
             </div>

             {/* CRM Integration */}
             {loadingProfile ? (
               <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
             ) : (
                <>
                  {/* Warning manual intervention panel */}
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl shadow-xs space-y-3">
                     <div className="flex items-start gap-2.5">
                       <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                       <div>
                         <p className="text-xs font-black text-rose-900 uppercase tracking-wide">Intervención Requerida</p>
                         <p className="text-[11px] text-rose-650 mt-1 leading-relaxed font-medium">
                           El cliente ha pausado o requiere soporte directo. Detén el bot de IA para responder de forma manual.
                         </p>
                       </div>
                     </div>
                     <div className="flex flex-col gap-2">
                       {(() => {
                         const isBotPaused = pauseMap[selectedChat] || false
                         return (
                           <button
                             onClick={(e) => handleToggleBotPause(selectedChat, e)}
                             className={cn(
                               'w-full py-2.5 px-4 rounded-xl font-bold text-xs border transition-all duration-300 flex items-center justify-center gap-2 uppercase',
                               isBotPaused
                                 ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                 : 'bg-red-600 hover:bg-red-700 text-white border-transparent'
                             )}
                           >
                             {isBotPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                             {isBotPaused ? 'ACTIVAR AGENTE DE IA' : 'PAUSAR IA'}
                           </button>
                         )
                       })()}

                       <button
                         onClick={handleGenerateInvoice}
                         disabled={billingLoading}
                         className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-750 text-white shadow-sm border border-transparent transition-all duration-300 flex items-center justify-center gap-2"
                       >
                         {billingLoading ? (
                           <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                         ) : (
                           <Calendar className="w-4 h-4" />
                         )}
                         EMITIR COMPROBANTE (FACTURAR)
                       </button>
                     </div>
                  </div>

                  {/* Profile Details Card */}
                  <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-xs space-y-4">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">RESUMEN DE NEGOCIO</p>
                     
                     <div className="flex flex-wrap gap-1.5 pb-1">
                       <span className="bg-slate-100 text-slate-650 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-slate-200/50">Sector Tech</span>
                       <span className="bg-slate-100 text-slate-650 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-slate-200/50">Renovación</span>
                       <span className="bg-blue-55 text-blue-600 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-100">Lead Score: 92</span>
                     </div>
                     
                     {profile ? (
                       <div className="space-y-2.5 text-xs text-slate-600 font-medium">
                         <div className="flex justify-between items-center">
                           <span>Total Pedidos:</span>
                           <span className="font-bold text-slate-800 bg-slate-150 px-2 py-0.5 rounded">{profile.stats.total_orders}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span>Inversión Total:</span>
                           <span className="font-extrabold text-emerald-600">S/ {Number(profile.stats.total_spent).toFixed(2)}</span>
                         </div>
                         {Number(profile.stats.total_pending) > 0 && (
                           <div className="flex justify-between items-center text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 mt-2 font-bold">
                             <span>Saldo Pendiente:</span>
                             <span>S/ {Number(profile.stats.total_pending).toFixed(2)}</span>
                           </div>
                         )}
                       </div>
                     ) : (
                       <p className="text-slate-400 text-[11px] font-medium">Sin historial comercial registrado.</p>
                     )}
                  </div>

                  {/* Historial Reciente Timeline */}
                  <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-xs">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-4">HISTORIAL RECIENTE</p>
                    <div className="relative border-l border-slate-150 pl-4 ml-2 space-y-5">
                      <div className="relative">
                        <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
                        <p className="text-xs font-bold text-slate-700 font-syst">Cita Confirmada CRM</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Cita de soporte configurada por agente de IA.</p>
                      </div>
                      <div className="relative">
                        <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-300 border-4 border-white shadow-sm" />
                        <p className="text-xs font-bold text-slate-700 font-syst">Conversación Iniciada</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Cliente se vinculó a través de WhatsApp Business API.</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Notes Area */}
                  <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-xs">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2.5">NOTAS RÁPIDAS</p>
                    <textarea
                      value={quickNotes}
                      onChange={(e) => handleSaveQuickNotes(e.target.value)}
                      placeholder="Agrega comentarios persistentes sobre este prospecto..."
                      className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50 text-slate-750 font-medium"
                      rows={3}
                    />
                  </div>
                </>
             )}
          </div>
        </div>
      )}

      {/* MODAL NUEVO CHAT */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-[60px] px-6 flex items-center justify-between bg-blue-650 text-white">
              <span className="text-sm font-bold uppercase tracking-wider font-syst">Nuevo Chat Directo</span>
              <button onClick={() => setShowNewChatModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 bg-slate-50">
              <p className="text-xs text-slate-550 mb-4">Ingresa el número con prefijo de país. Ej. 51924678473 (Perú)</p>
              <form onSubmit={handleStartNewChat}>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Ej: 51924678473"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-5 text-sm"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                />
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => setShowNewChatModal(false)} className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-200 rounded-xl font-bold">Cancelar</button>
                  <button type="submit" className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold shadow-sm">Iniciar Conversación</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VINCULACIÓN QR / PAIRING */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-900/70 z-[100] flex items-center justify-center backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 animate-out duration-150">
            <div className="h-[60px] px-6 flex items-center justify-between bg-blue-650 text-white">
              <span className="text-sm font-bold uppercase tracking-wider font-syst">Vincular Dispositivo</span>
              <button onClick={() => { setShowQrModal(false); setQrCode(null); setPairingCode(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 bg-slate-50 flex flex-col items-center text-center">
              
              {!qrCode && !pairingCode ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-650 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Generando puente seguro...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-600 mb-6 font-medium leading-relaxed">
                    Abre WhatsApp en tu teléfono, ingresa a Dispositivos vinculados y escanea el código QR a continuación:
                  </p>
                  
                  {qrCode && (
                    <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 mb-6">
                      <img src={qrCode} alt="WhatsApp Web QR Code" className="w-[200px] h-[200px]" />
                    </div>
                  )}

                  {pairingCode && (
                    <div className="bg-white border border-slate-200 px-6 py-3 rounded-xl mb-6 shadow-xs">
                      <p className="text-[9px] text-blue-600 font-black mb-1 uppercase tracking-wider font-mono">CÓDIGO DE VINCULACIÓN</p>
                      <p className="text-3xl font-black text-slate-800 tracking-widest">{pairingCode}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-blue-650 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-wider font-mono">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" /> Sincronización en curso
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
