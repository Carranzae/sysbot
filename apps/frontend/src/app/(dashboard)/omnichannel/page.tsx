'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Headphones,
  Inbox,
  Instagram,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { useBusinessStore } from '@/store/business'
import {
  businessApi,
  channelApi,
  contactsApi,
  crmApi,
  filesApi,
  leadsApi,
  metaApi,
  omnichannelApi,
  whatsappApi,
} from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'

type ChannelKey = 'all' | 'whatsapp' | 'messenger' | 'instagram' | 'email' | 'voice'
type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST'

type Chat = {
  id?: string
  identity?: string
  customer_phone: string
  customer_name?: string
  customer_pushname?: string
  last_message?: string
  last_message_at?: string
  last_direction?: 'incoming' | 'outgoing'
  platform?: string
  channel?: string
  contact?: any
  lead?: any
  unread?: number
  messageCount?: number
  callCount?: number
  hasOpenCrmAction?: boolean
}

type Message = {
  id: string
  type?: 'message' | 'call'
  body?: string
  message?: string
  direction?: 'incoming' | 'outgoing'
  created_at?: string
  createdAt?: string
  platform?: string
  status?: string
}

type AutomationDraft = {
  name: string
  triggerType: 'KEYWORDS' | 'EXACT' | 'REGEX'
  keywords: string
  channels: string[]
  action: string
  responseText: string
  assignTo: string
  waitMinutes: string
  useAi: boolean
}

const channelOptions: Array<{ key: ChannelKey; label: string; icon: any; color: string }> = [
  { key: 'all', label: 'Todos', icon: Inbox, color: 'text-slate-700 bg-slate-100 border-slate-200' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'messenger', label: 'Messenger', icon: MessageSquare, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-700 bg-pink-50 border-pink-200' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'voice', label: 'Llamadas', icon: Phone, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
]

const stageLabels: Record<LeadStage, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
}

const defaultAutomation: AutomationDraft = {
  name: 'Calificar lead entrante',
  triggerType: 'KEYWORDS',
  keywords: 'precio,costo,plan,demo',
  channels: ['whatsapp', 'instagram', 'messenger'],
  action: 'qualify_lead',
  responseText: 'Gracias por escribir. Te hago 3 preguntas rapidas para recomendarte el plan correcto.',
  assignTo: 'ventas',
  waitMinutes: '5',
  useAi: true,
}

function normalizeChannel(value?: string): ChannelKey {
  const raw = (value || '').toLowerCase()
  if (raw.includes('instagram')) return 'instagram'
  if (raw.includes('messenger') || raw.includes('facebook')) return 'messenger'
  if (raw.includes('email') || raw.includes('gmail')) return 'email'
  if (raw.includes('call') || raw.includes('voice') || raw.includes('phone')) return 'voice'
  return 'whatsapp'
}

function toChat(conversation: any): Chat {
  const contact = conversation.contact || {}
  const lead = conversation.lead || {}
  const identity = conversation.identity || contact.phone || contact.email || lead.phone || lead.email || conversation.id
  return {
    id: conversation.id,
    identity,
    customer_phone: identity,
    customer_name: contact.name || lead.name,
    customer_pushname: contact.name,
    last_message: conversation.lastMessage || conversation.last_message || '',
    last_message_at: conversation.lastMessageAt || conversation.last_message_at,
    last_direction: conversation.lastDirection === 'OUTBOUND' ? 'outgoing' : 'incoming',
    platform: conversation.channel || conversation.platform,
    channel: conversation.channel || conversation.platform,
    contact,
    lead,
    unread: conversation.unread || 0,
    messageCount: conversation.messageCount || 0,
    callCount: conversation.callCount || 0,
    hasOpenCrmAction: Boolean(conversation.hasOpenCrmAction),
  }
}

function phoneTail(phone?: string) {
  return (phone || '').replace(/\D/g, '').slice(-9)
}

function displayName(chat?: Chat | null) {
  if (!chat) return 'Sin conversacion'
  return chat.customer_name || chat.customer_pushname || chat.identity || chat.customer_phone
}

function scoreLead(chat?: Chat | null, messages: Message[] = []) {
  if (!chat) return 0
  const text = `${chat.last_message || ''} ${messages.map((m) => m.body || m.message || '').join(' ')}`.toLowerCase()
  let score = 35
  if (/precio|costo|pago|plan|cotiz|demo/.test(text)) score += 25
  if (/urgente|hoy|ahora|llamar|reunion/.test(text)) score += 20
  if (messages.length > 4) score += 10
  if ((chat.last_direction || '') === 'incoming') score += 10
  return Math.min(score, 100)
}

function parseMetadata(value: any) {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value
}

export default function OmnichannelPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)

  const [activeTab, setActiveTab] = useState('inbox')
  const [channel, setChannel] = useState<ChannelKey>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)

  const [leads, setLeads] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [crmConnection, setCrmConnection] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [botConfig, setBotConfig] = useState<any>(null)
  const [botRules, setBotRules] = useState<any[]>([])
  const [channelHealth, setChannelHealth] = useState<Record<string, any>>({})

  const [crmStage, setCrmStage] = useState<LeadStage>('NEW')
  const [nextAction, setNextAction] = useState('Enviar seguimiento comercial')
  const [dealAmount, setDealAmount] = useState('0')
  const [crmNotes, setCrmNotes] = useState('')
  const [savingCrm, setSavingCrm] = useState(false)

  const [automation, setAutomation] = useState<AutomationDraft>(defaultAutomation)
  const [savingAutomation, setSavingAutomation] = useState(false)

  const [agentObjective, setAgentObjective] = useState('Calificar leads, responder dudas y escalar a ventas cuando detecte alta intencion.')
  const [agentTone, setAgentTone] = useState('Profesional, claro, cercano y orientado a conversion.')
  const [agentEscalation, setAgentEscalation] = useState(true)
  const [agentMaxTurns, setAgentMaxTurns] = useState('6')
  const [savingAgent, setSavingAgent] = useState(false)

  const currentChat = useMemo(
    () => chats.find((chat) => chat.customer_phone === selectedPhone) || null,
    [chats, selectedPhone],
  )

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chats.filter((chat) => {
      const chatChannel = normalizeChannel(chat.platform)
      const matchesChannel = channel === 'all' || chatChannel === channel
      const text = `${displayName(chat)} ${chat.customer_phone} ${chat.last_message || ''}`.toLowerCase()
      return matchesChannel && (!q || text.includes(q))
    })
  }, [chats, channel, query])

  const matchedContact = useMemo(() => {
    const tail = phoneTail(selectedPhone || '')
    return contacts.find((contact) => phoneTail(contact.phone) === tail)
  }, [contacts, selectedPhone])

  const matchedLead = useMemo(() => {
    const tail = phoneTail(selectedPhone || '')
    return leads.find((lead) => phoneTail(lead.phone) === tail)
  }, [leads, selectedPhone])

  const leadScore = useMemo(() => {
    const metaScore = parseMetadata(matchedLead?.metadata)?.leadScore
    return Number(metaScore || scoreLead(currentChat, messages))
  }, [currentChat, matchedLead, messages])

  const readiness = useMemo(() => {
    const checks = [
      Boolean(selectedBusiness),
      Boolean((channelHealth.whatsapp || {}).connected || (channelHealth.whatsapp || {}).status === 'READY'),
      Boolean((channelHealth.messenger || {}).connected || (channelHealth.instagram || {}).connected),
      Boolean(files.length),
      Boolean(botConfig?.autoReply ?? botConfig?.isActive),
      Boolean(crmConnection && crmConnection.provider && crmConnection.provider !== 'NONE'),
      Boolean(botRules.length),
      Boolean(process.env.NEXT_PUBLIC_API_URL),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [botConfig, botRules.length, channelHealth, crmConnection, files.length, selectedBusiness])

  const loadWorkspace = useCallback(async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      const [
        chatsRes,
        leadsRes,
        contactsRes,
        crmRes,
        filesRes,
        botConfigRes,
        rulesRes,
        channelsRes,
        metaRes,
        waRes,
      ] = await Promise.allSettled([
        omnichannelApi.getConversations(selectedBusiness.id, {
          channel: channel === 'all' ? undefined : channel,
          search: query || undefined,
          limit: 120,
        }),
        leadsApi.getAll(selectedBusiness.id),
        contactsApi.getAll(selectedBusiness.id),
        crmApi.getConnection(selectedBusiness.id),
        filesApi.getAll(selectedBusiness.id),
        businessApi.getBotConfig(selectedBusiness.id),
        businessApi.getBotRules(selectedBusiness.id),
        channelApi.getStatus(selectedBusiness.id),
        metaApi.getConnection(selectedBusiness.id),
        whatsappApi.getStatus(selectedBusiness.id),
      ])

      if (chatsRes.status === 'fulfilled') {
        const data = chatsRes.value.data
        const rows = Array.isArray(data?.conversations) ? data.conversations : Array.isArray(data) ? data : []
        setChats(rows.map(toChat))
      }
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data || [])
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value.data || [])
      if (crmRes.status === 'fulfilled') setCrmConnection(crmRes.value.data)
      if (filesRes.status === 'fulfilled') setFiles(filesRes.value.data || [])
      if (botConfigRes.status === 'fulfilled') {
        const config = botConfigRes.value.data || {}
        setBotConfig(config)
        const prompt = config.customPrompt || config.systemPrompt || ''
        setAgentObjective(config.agentObjective || prompt || agentObjective)
        setAgentTone(config.agentTone || config.businessTone || agentTone)
        setAgentEscalation(config.humanEscalationEnabled ?? true)
        setAgentMaxTurns(String(config.maxTokens ? Math.max(1, Math.round(config.maxTokens / 120)) : 6))
      }
      if (rulesRes.status === 'fulfilled') setBotRules(rulesRes.value.data || [])

      const nextHealth: Record<string, any> = {}
      if (channelsRes.status === 'fulfilled') {
        const status = channelsRes.value.data || {}
        nextHealth.whatsapp = {
          ...(status.whatsapp?.api || {}),
          ...(status.whatsapp?.web || {}),
          connected: Boolean(status.whatsapp?.api?.connected || status.whatsapp?.web?.connected),
          token: status.whatsapp?.api?.tokenConfigured ? 'present' : 'missing',
          webhook: status.whatsapp?.api?.webhookConfigured ? 'configured' : 'pending',
          lastMessageAt: status.whatsapp?.api?.lastMessageAt || status.whatsapp?.web?.lastMessageAt,
          status: status.whatsapp?.web?.status,
        }
        nextHealth.messenger = status.meta?.messenger || {}
        nextHealth.instagram = status.meta?.instagram || {}
        nextHealth.email = status.email?.gmail || {}
        nextHealth.voice = status.voice || {}
        nextHealth.telegram = status.telegram || {}
      }
      if (metaRes.status === 'fulfilled') {
        const meta = metaRes.value.data || {}
        nextHealth.messenger = {
          connected: Boolean(meta.messengerConnected),
          token: meta.messengerAccessToken ? 'present' : 'missing',
          webhook: meta.webhookVerified ? 'verified' : 'pending',
          lastMessageAt: meta.updatedAt,
        }
        nextHealth.instagram = {
          connected: Boolean(meta.instagramConnected),
          token: meta.instagramAccessToken ? 'present' : 'missing',
          webhook: meta.webhookVerified ? 'verified' : 'pending',
          lastMessageAt: meta.updatedAt,
        }
      }
      if (waRes.status === 'fulfilled') {
        const wa = waRes.value.data || {}
        const status = typeof wa.status === 'object' ? wa.status : wa
        nextHealth.whatsapp = {
          connected: Boolean(wa.connected || status.connected || status.status === 'READY' || status.statusString === 'READY'),
          token: wa.phoneNumber || status.phoneNumber ? 'present' : 'session',
          webhook: 'local-session',
          lastMessageAt: wa.lastConnected || status.lastConnected,
          status: status.statusString || status.status || wa.status,
        }
      }
      if (!nextHealth.email) {
        nextHealth.email = {
          connected: Boolean((botConfigRes.status === 'fulfilled' ? botConfigRes.value.data : {})?.gmailRefreshToken),
          token: (botConfigRes.status === 'fulfilled' ? botConfigRes.value.data : {})?.gmailRefreshToken ? 'present' : 'missing',
          webhook: 'oauth',
        }
      }
      if (!nextHealth.voice) {
        nextHealth.voice = {
          connected: Boolean(process.env.NEXT_PUBLIC_TWILIO_ENABLED === 'true'),
          token: 'server-env',
          webhook: 'twilio-callback',
        }
      }
      setChannelHealth(nextHealth)
    } catch (error) {
      toast({
        title: 'No se pudo cargar el centro omnicanal',
        description: 'Revisa backend, token y negocio seleccionado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [agentObjective, agentTone, channel, query, selectedBusiness, toast])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    if (!matchedLead) return
    setCrmStage(matchedLead.status || 'NEW')
    const metadata = parseMetadata(matchedLead.metadata)
    setNextAction(metadata.nextAction || 'Enviar seguimiento comercial')
    setDealAmount(String(metadata.dealAmount || 0))
    setCrmNotes(matchedLead.notes || '')
  }, [matchedLead])

  const loadMessages = async (phone: string) => {
    if (!selectedBusiness) return
    setSelectedPhone(phone)
    try {
      const chat = chats.find((item) => item.customer_phone === phone || item.id === phone)
      const conversationId = chat?.id || phone
      const res = await omnichannelApi.getConversation(selectedBusiness.id, conversationId)
      const data = res.data || {}
      const rows = Array.isArray(data.timeline) ? data.timeline : Array.isArray(data.messages) ? data.messages : Array.isArray(data) ? data : []
      setMessages(rows.map((item: any) => ({
        ...item,
        body: item.body || item.message,
        created_at: item.createdAt || item.created_at,
        platform: item.channel || item.platform,
      })))
    } catch {
      setMessages([])
      toast({
        title: 'Historial no disponible',
        description: 'La conversacion existe, pero no se pudo cargar el detalle.',
        variant: 'destructive',
      })
    }
  }

  const sendMessage = async () => {
    if (!selectedBusiness || !selectedPhone || !messageInput.trim()) return
    setSending(true)
    try {
      const chat = chats.find((item) => item.customer_phone === selectedPhone || item.id === selectedPhone)
      await omnichannelApi.sendMessage(selectedBusiness.id, chat?.id || selectedPhone, messageInput.trim())
      setMessageInput('')
      await loadMessages(selectedPhone)
      await loadWorkspace()
    } catch {
      toast({
        title: 'No se pudo enviar',
        description: 'Valida la conexion del canal o intenta desde WhatsApp API.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const saveCrmContext = async () => {
    if (!selectedBusiness || !currentChat) return
    setSavingCrm(true)
    const payload = {
      name: displayName(currentChat),
      phone: currentChat.customer_phone,
      email: matchedLead?.email || matchedContact?.email || undefined,
      source: normalizeChannel(currentChat.platform).toUpperCase(),
      status: crmStage,
      notes: crmNotes,
      metadata: {
        ...(parseMetadata(matchedLead?.metadata) || {}),
        leadScore,
        dealAmount: Number(dealAmount || 0),
        nextAction,
        channel: normalizeChannel(currentChat.platform),
      },
      lastContactAt: new Date().toISOString(),
    }

    try {
      await omnichannelApi.saveCrmContext(selectedBusiness.id, currentChat.id || currentChat.customer_phone, {
        ...payload,
        leadScore,
        dealAmount: Number(dealAmount || 0),
        nextAction,
        contact: {
          name: displayName(currentChat),
          phone: currentChat.customer_phone,
          email: payload.email,
        },
      })

      toast({ title: 'CRM actualizado', description: 'Contacto, lead y proxima accion quedaron sincronizados.' })
      await loadWorkspace()
    } catch (error: any) {
      toast({
        title: 'Error CRM',
        description: error.response?.data?.message || 'No se pudo guardar el contexto comercial.',
        variant: 'destructive',
      })
    } finally {
      setSavingCrm(false)
    }
  }

  const saveAutomation = async () => {
    if (!selectedBusiness) return
    setSavingAutomation(true)
    try {
      await businessApi.createBotRule(selectedBusiness.id, {
        name: automation.name,
        description: `Accion: ${automation.action}. Asignar a: ${automation.assignTo}. Espera: ${automation.waitMinutes} min.`,
        triggerType: automation.triggerType,
        keywords: automation.keywords.split(',').map((item) => item.trim()).filter(Boolean),
        triggerValue: automation.triggerType === 'KEYWORDS' ? undefined : automation.keywords,
        responseText: automation.responseText,
        channels: automation.channels,
        engine: automation.useAi ? 'RAG' : 'MANUAL',
        scope: 'CHANNEL',
        active: true,
        priority: 50,
        metadata: {
          action: automation.action,
          assignTo: automation.assignTo,
          waitMinutes: Number(automation.waitMinutes || 0),
          useAi: automation.useAi,
        },
      })
      toast({ title: 'Automatizacion creada', description: 'La regla ya esta disponible para el bot del negocio.' })
      await loadWorkspace()
    } catch (error: any) {
      toast({
        title: 'No se pudo crear la automatizacion',
        description: error.response?.data?.message || 'Revisa los campos del flujo.',
        variant: 'destructive',
      })
    } finally {
      setSavingAutomation(false)
    }
  }

  const saveAgent = async () => {
    if (!selectedBusiness) return
    setSavingAgent(true)
    try {
      await businessApi.updateBotConfig(selectedBusiness.id, {
        autoReply: true,
        maxTokens: Math.max(300, Number(agentMaxTurns || 6) * 120),
        customPrompt: [
          `Objetivo del agente: ${agentObjective}`,
          `Tono: ${agentTone}`,
          `Escalamiento humano: ${agentEscalation ? 'si, cuando detecte intencion alta, queja, pago, llamada o bloqueo' : 'no automatico'}.`,
        ].join('\n\n'),
      })
      toast({ title: 'AI Agent actualizado', description: 'Objetivo, tono y escalamiento quedaron guardados.' })
      await loadWorkspace()
    } catch (error: any) {
      toast({
        title: 'Error al guardar AI Agent',
        description: error.response?.data?.message || 'No se pudo actualizar la configuracion.',
        variant: 'destructive',
      })
    } finally {
      setSavingAgent(false)
    }
  }

  const toggleAutomationChannel = (value: string) => {
    setAutomation((prev) => ({
      ...prev,
      channels: prev.channels.includes(value)
        ? prev.channels.filter((item) => item !== value)
        : [...prev.channels, value],
    }))
  }

  if (!selectedBusiness) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <BuildingPrompt />
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md bg-blue-50 text-blue-700 hover:bg-blue-50">Fase 5</Badge>
              <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">
                Omnicanal + CRM + IA
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-950">Centro omnicanal</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Bandeja, ventas, automatizacion, agentes IA, salud de canales y lanzamiento del negocio en una sola operacion.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Conversaciones" value={String(chats.length)} icon={Inbox} />
            <Metric label="Leads" value={String(leads.length)} icon={Users} />
            <Metric label="Listo" value={`${readiness}%`} icon={Rocket} />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <WorkspaceTab value="inbox" icon={Inbox} label="Inbox" />
            <WorkspaceTab value="crm" icon={GitBranch} label="CRM flujo" />
            <WorkspaceTab value="automations" icon={Workflow} label="Automatizaciones" />
            <WorkspaceTab value="agents" icon={BrainCircuit} label="AI Agents" />
            <WorkspaceTab value="health" icon={Activity} label="Canales" />
            <WorkspaceTab value="launch" icon={Rocket} label="Lanzamiento" />
          </TabsList>

          <TabsContent value="inbox" className="mt-0">
            <div className="grid min-h-[680px] grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
              <section className="rounded-lg border border-slate-200 bg-white">
                <InboxToolbar
                  channel={channel}
                  setChannel={setChannel}
                  query={query}
                  setQuery={setQuery}
                  loading={loading}
                  refresh={loadWorkspace}
                />
                <div className="h-[560px] overflow-y-auto border-t border-slate-100">
                  {filteredChats.length === 0 ? (
                    <EmptyState icon={Inbox} title="Sin conversaciones" text="Conecta WhatsApp, Messenger o Instagram para empezar." />
                  ) : (
                    filteredChats.map((chat) => {
                      const chatChannel = normalizeChannel(chat.platform)
                      const Icon = channelOptions.find((item) => item.key === chatChannel)?.icon || MessageCircle
                      const active = selectedPhone === chat.customer_phone
                      return (
                        <button
                          key={chat.customer_phone}
                          onClick={() => loadMessages(chat.customer_phone)}
                          className={cn(
                            'grid w-full grid-cols-[40px_1fr_auto] gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                            active && 'bg-blue-50/70',
                          )}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-900">{displayName(chat)}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{chat.last_message || 'Sin ultimo mensaje'}</span>
                          </span>
                          <span className="text-right">
                            <Badge variant="outline" className="rounded-md text-[10px] capitalize">{chatChannel}</Badge>
                            <span className="mt-1 block text-[10px] text-slate-400">{chat.last_direction === 'incoming' ? 'Cliente' : 'Equipo'}</span>
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="flex min-h-[680px] flex-col rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{displayName(currentChat)}</p>
                    <p className="text-xs text-slate-500">{selectedPhone || 'Selecciona una conversacion'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('rounded-md border capitalize', channelOptions.find((item) => item.key === normalizeChannel(currentChat?.platform))?.color)}>
                      {normalizeChannel(currentChat?.platform)}
                    </Badge>
                    <Button variant="outline" size="sm" className="rounded-md" asChild>
                      <Link href="/channels">Configurar</Link>
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
                  {!selectedPhone ? (
                    <EmptyState icon={MessageSquare} title="Elige una conversacion" text="El contexto CRM y la IA apareceran a la derecha." />
                  ) : messages.length === 0 ? (
                    <EmptyState icon={Clock3} title="Sin historial cargado" text="Puedes enviar un mensaje o revisar la conexion del canal." />
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message, index) => {
                        const outgoing = message.direction === 'outgoing'
                        return (
                          <div key={message.id || `${message.created_at}-${index}`} className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                              'max-w-[78%] rounded-lg border px-3 py-2 text-sm shadow-sm',
                              outgoing ? 'border-blue-200 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-800',
                            )}>
                              <p>{message.body || message.message || 'Mensaje sin texto'}</p>
                              <p className={cn('mt-1 text-[10px]', outgoing ? 'text-blue-100' : 'text-slate-400')}>
                                {message.created_at || message.createdAt || message.status || 'sin fecha'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-white p-4">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      placeholder="Responder desde Sysbot..."
                      className="h-11 rounded-md"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') sendMessage()
                      }}
                    />
                    <Button onClick={sendMessage} disabled={!selectedPhone || sending || !messageInput.trim()} className="h-11 rounded-md">
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </section>

              <CrmContextPanel
                chat={currentChat}
                leadScore={leadScore}
                matchedLead={matchedLead}
                matchedContact={matchedContact}
                crmStage={crmStage}
                setCrmStage={setCrmStage}
                nextAction={nextAction}
                setNextAction={setNextAction}
                dealAmount={dealAmount}
                setDealAmount={setDealAmount}
                crmNotes={crmNotes}
                setCrmNotes={setCrmNotes}
                saving={savingCrm}
                save={saveCrmContext}
              />
            </div>
          </TabsContent>

          <TabsContent value="crm" className="mt-0">
            <CrmFlow leads={leads} crmConnection={crmConnection} reload={loadWorkspace} />
          </TabsContent>

          <TabsContent value="automations" className="mt-0">
            <AutomationBuilder
              automation={automation}
              setAutomation={setAutomation}
              toggleChannel={toggleAutomationChannel}
              save={saveAutomation}
              saving={savingAutomation}
              rules={botRules}
            />
          </TabsContent>

          <TabsContent value="agents" className="mt-0">
            <AgentPanel
              objective={agentObjective}
              setObjective={setAgentObjective}
              tone={agentTone}
              setTone={setAgentTone}
              escalation={agentEscalation}
              setEscalation={setAgentEscalation}
              maxTurns={agentMaxTurns}
              setMaxTurns={setAgentMaxTurns}
              files={files}
              rules={botRules}
              save={saveAgent}
              saving={savingAgent}
            />
          </TabsContent>

          <TabsContent value="health" className="mt-0">
            <ChannelHealthGrid health={channelHealth} refresh={loadWorkspace} />
          </TabsContent>

          <TabsContent value="launch" className="mt-0">
            <LaunchReadiness
              readiness={readiness}
              files={files}
              botRules={botRules}
              crmConnection={crmConnection}
              channelHealth={channelHealth}
            />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  )
}

function BuildingPrompt() {
  return (
    <div className="text-center">
      <Rocket className="mx-auto h-10 w-10 text-blue-600" />
      <h2 className="mt-4 text-xl font-black text-slate-950">Selecciona o crea un negocio</h2>
      <p className="mt-2 text-sm text-slate-600">El centro omnicanal necesita un negocio para cargar canales, CRM, IA y reglas.</p>
      <Button asChild className="mt-5 rounded-md">
        <Link href="/businesses">Ir a negocios</Link>
      </Button>
    </div>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="min-w-[110px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <Icon className="mx-auto h-4 w-4 text-slate-500" />
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function WorkspaceTab({ value, icon: Icon, label }: { value: string; icon: any; label: string }) {
  return (
    <TabsTrigger value={value} className="rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </TabsTrigger>
  )
}

function InboxToolbar(props: {
  channel: ChannelKey
  setChannel: (value: ChannelKey) => void
  query: string
  setQuery: (value: string) => void
  loading: boolean
  refresh: () => void
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">Bandeja</h2>
        <Button variant="outline" size="sm" onClick={props.refresh} disabled={props.loading} className="h-8 rounded-md">
          <RefreshCw className={cn('mr-2 h-3.5 w-3.5', props.loading && 'animate-spin')} />
          Sync
        </Button>
      </div>
      <Input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Buscar cliente, telefono o mensaje" className="h-10 rounded-md" />
      <div className="grid grid-cols-3 gap-2">
        {channelOptions.map((item) => {
          const Icon = item.icon
          const active = props.channel === item.key
          return (
            <button
              key={item.key}
              onClick={() => props.setChannel(item.key)}
              className={cn(
                'flex h-10 items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors',
                active ? item.color : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <Icon className="h-9 w-9 text-slate-300" />
      <p className="mt-3 text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{text}</p>
    </div>
  )
}

function CrmContextPanel(props: {
  chat: Chat | null
  leadScore: number
  matchedLead: any
  matchedContact: any
  crmStage: LeadStage
  setCrmStage: (value: LeadStage) => void
  nextAction: string
  setNextAction: (value: string) => void
  dealAmount: string
  setDealAmount: (value: string) => void
  crmNotes: string
  setCrmNotes: (value: string) => void
  saving: boolean
  save: () => void
}) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cliente 360</p>
            <h2 className="mt-1 text-base font-black text-slate-950">{displayName(props.chat)}</h2>
          </div>
          <span className={cn(
            'flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-black',
            props.leadScore >= 75 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : props.leadScore >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700',
          )}>
            {props.leadScore}
          </span>
        </div>
        <Progress value={props.leadScore} className="mt-4 h-2" />
      </div>
      <div className="space-y-4 p-5">
        <InfoLine icon={UserRound} label="Contacto" value={props.matchedContact ? 'Existe en CRM interno' : 'Nuevo contacto'} />
        <InfoLine icon={GitBranch} label="Lead" value={props.matchedLead ? 'Sincronizado' : 'Pendiente de crear'} />

        <div className="space-y-2">
          <Label>Etapa comercial</Label>
          <Select value={props.crmStage} onValueChange={(value) => props.setCrmStage(value as LeadStage)}>
            <SelectTrigger className="rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(stageLabels) as LeadStage[]).map((stage) => (
                <SelectItem key={stage} value={stage}>{stageLabels[stage]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Valor potencial</Label>
          <Input value={props.dealAmount} onChange={(event) => props.setDealAmount(event.target.value)} type="number" className="rounded-md" />
        </div>

        <div className="space-y-2">
          <Label>Proxima accion</Label>
          <Input value={props.nextAction} onChange={(event) => props.setNextAction(event.target.value)} className="rounded-md" />
        </div>

        <div className="space-y-2">
          <Label>Notas comerciales</Label>
          <Textarea value={props.crmNotes} onChange={(event) => props.setCrmNotes(event.target.value)} className="min-h-[110px] rounded-md" />
        </div>

        <Button onClick={props.save} disabled={!props.chat || props.saving} className="w-full rounded-md">
          <ShieldCheck className="mr-2 h-4 w-4" />
          {props.saving ? 'Guardando...' : 'Guardar en CRM'}
        </Button>
      </div>
    </aside>
  )
}

function InfoLine({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 text-slate-500" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-xs font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function CrmFlow({ leads, crmConnection, reload }: { leads: any[]; crmConnection: any; reload: () => void }) {
  const byStage = (Object.keys(stageLabels) as LeadStage[]).map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.status === stage),
  }))
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">CRM dentro del flujo</h2>
          <p className="text-sm text-slate-600">Los leads nacen desde conversaciones y se sincronizan con el CRM externo cuando esta activo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-md">
            CRM: {crmConnection?.provider || 'NONE'}
          </Badge>
          <Button variant="outline" className="rounded-md" onClick={reload}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button asChild className="rounded-md">
            <Link href="/crm">Abrir CRM completo</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {byStage.map((column) => (
          <section key={column.stage} className="min-h-[420px] rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-black text-slate-900">{stageLabels[column.stage]}</p>
              <p className="text-xs text-slate-500">{column.leads.length} oportunidades</p>
            </div>
            <div className="space-y-2 p-3">
              {column.leads.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-400">Sin leads en esta etapa.</p>
              ) : (
                column.leads.slice(0, 8).map((lead) => {
                  const metadata = parseMetadata(lead.metadata)
                  return (
                    <article key={lead.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="truncate text-sm font-bold text-slate-900">{lead.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{lead.phone}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="outline" className="rounded-md text-[10px]">{lead.source || 'WHATSAPP'}</Badge>
                        <span className="text-xs font-black text-blue-700">{metadata.leadScore || 40}</span>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function AutomationBuilder(props: {
  automation: AutomationDraft
  setAutomation: (value: AutomationDraft | ((prev: AutomationDraft) => AutomationDraft)) => void
  toggleChannel: (value: string) => void
  save: () => void
  saving: boolean
  rules: any[]
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Workflow className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-black text-slate-950">Constructor de automatizaciones</h2>
            <p className="text-sm text-slate-600">Disparador, condicion, accion, IA, espera y asignacion en una regla usable.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field label="Nombre">
            <Input value={props.automation.name} onChange={(event) => props.setAutomation((prev) => ({ ...prev, name: event.target.value }))} className="rounded-md" />
          </Field>
          <Field label="Disparador">
            <Select value={props.automation.triggerType} onValueChange={(value) => props.setAutomation((prev) => ({ ...prev, triggerType: value as AutomationDraft['triggerType'] }))}>
              <SelectTrigger className="rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="KEYWORDS">Palabras clave</SelectItem>
                <SelectItem value="EXACT">Texto exacto</SelectItem>
                <SelectItem value="REGEX">Regex</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Condicion">
            <Input value={props.automation.keywords} onChange={(event) => props.setAutomation((prev) => ({ ...prev, keywords: event.target.value }))} className="rounded-md" />
          </Field>
          <Field label="Accion">
            <Select value={props.automation.action} onValueChange={(value) => props.setAutomation((prev) => ({ ...prev, action: value }))}>
              <SelectTrigger className="rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualify_lead">Calificar lead</SelectItem>
                <SelectItem value="assign_agent">Asignar agente</SelectItem>
                <SelectItem value="create_deal">Crear deal</SelectItem>
                <SelectItem value="schedule_followup">Programar seguimiento</SelectItem>
                <SelectItem value="escalate_human">Escalar a humano</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Asignar a">
            <Input value={props.automation.assignTo} onChange={(event) => props.setAutomation((prev) => ({ ...prev, assignTo: event.target.value }))} className="rounded-md" />
          </Field>
          <Field label="Espera en minutos">
            <Input type="number" value={props.automation.waitMinutes} onChange={(event) => props.setAutomation((prev) => ({ ...prev, waitMinutes: event.target.value }))} className="rounded-md" />
          </Field>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Canales</Label>
          <div className="flex flex-wrap gap-2">
            {channelOptions.filter((item) => item.key !== 'all').map((item) => {
              const active = props.automation.channels.includes(item.key)
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={() => props.toggleChannel(item.key)}
                  className={cn('inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold', active ? item.color : 'border-slate-200 bg-white text-slate-500')}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Respuesta o instruccion IA</Label>
          <Textarea value={props.automation.responseText} onChange={(event) => props.setAutomation((prev) => ({ ...prev, responseText: event.target.value }))} className="min-h-[120px] rounded-md" />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Usar RAG/IA</p>
            <p className="text-xs text-slate-500">La regla podra consultar archivos y contexto del negocio.</p>
          </div>
          <Switch checked={props.automation.useAi} onCheckedChange={(checked) => props.setAutomation((prev) => ({ ...prev, useAi: checked }))} />
        </div>

        <Button onClick={props.save} disabled={props.saving} className="mt-5 rounded-md">
          <Plus className="mr-2 h-4 w-4" />
          {props.saving ? 'Creando...' : 'Crear automatizacion'}
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Reglas activas</h3>
        <div className="mt-4 space-y-2">
          {props.rules.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aun no hay reglas creadas.</p>
          ) : (
            props.rules.slice(0, 8).map((rule) => (
              <article key={rule.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">{rule.name}</p>
                  <Badge variant={rule.active ? 'default' : 'outline'} className="rounded-md">{rule.active ? 'Activa' : 'Pausada'}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{rule.responseText || rule.description || 'Sin respuesta definida'}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function AgentPanel(props: {
  objective: string
  setObjective: (value: string) => void
  tone: string
  setTone: (value: string) => void
  escalation: boolean
  setEscalation: (value: boolean) => void
  maxTurns: string
  setMaxTurns: (value: string) => void
  files: any[]
  rules: any[]
  save: () => void
  saving: boolean
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-5 w-5 text-violet-600" />
          <div>
            <h2 className="text-lg font-black text-slate-950">AI Agent por negocio</h2>
            <p className="text-sm text-slate-600">Objetivo, tono, fuentes RAG, reglas y escalamiento humano.</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Objetivo del agente">
            <Textarea value={props.objective} onChange={(event) => props.setObjective(event.target.value)} className="min-h-[120px] rounded-md" />
          </Field>
          <Field label="Tono comercial">
            <Textarea value={props.tone} onChange={(event) => props.setTone(event.target.value)} className="min-h-[90px] rounded-md" />
          </Field>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Escalar a humano</p>
                  <p className="text-xs text-slate-500">Cuando detecte frustracion, pago o cierre.</p>
                </div>
                <Switch checked={props.escalation} onCheckedChange={props.setEscalation} />
              </div>
            </div>
            <Field label="Turnos maximos IA">
              <Input type="number" value={props.maxTurns} onChange={(event) => props.setMaxTurns(event.target.value)} className="rounded-md" />
            </Field>
          </div>
          <Button onClick={props.save} disabled={props.saving} className="rounded-md">
            <Bot className="mr-2 h-4 w-4" />
            {props.saving ? 'Guardando...' : 'Guardar AI Agent'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Fuentes RAG</h3>
          <p className="mt-1 text-xs text-slate-500">{props.files.length} archivos disponibles para responder con conocimiento del negocio.</p>
          <div className="mt-4 space-y-2">
            {props.files.slice(0, 6).map((file) => (
              <div key={file.id || file.name} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="truncate text-xs font-bold text-slate-700">{file.originalName || file.filename || file.name}</span>
                <Badge variant="outline" className="rounded-md text-[10px]">{file.status || file.processingStatus || 'RAG'}</Badge>
              </div>
            ))}
            {props.files.length === 0 && <p className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500">Sube documentos en Archivos para entrenar respuestas.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Reglas conectadas</h3>
          <p className="mt-1 text-xs text-slate-500">{props.rules.length} reglas pueden complementar al agente.</p>
        </section>
      </div>
    </section>
  )
}

function ChannelHealthGrid({ health, refresh }: { health: Record<string, any>; refresh: () => void }) {
  const rows = channelOptions.filter((item) => item.key !== 'all')
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Health checks por canal</h2>
          <p className="text-sm text-slate-600">Conexion, token, webhook y ultimo evento conocido.</p>
        </div>
        <Button variant="outline" onClick={refresh} className="rounded-md">
          <RefreshCw className="mr-2 h-4 w-4" />
          Revalidar
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {rows.map((item) => {
          const data = health[item.key] || {}
          const connected = Boolean(data.connected)
          const Icon = item.icon
          return (
            <article key={item.key} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg border', item.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <Badge className={cn('rounded-md', connected ? 'bg-emerald-600' : 'bg-amber-600')}>
                  {connected ? 'Conectado' : 'Pendiente'}
                </Badge>
              </div>
              <h3 className="mt-4 text-base font-black text-slate-950">{item.label}</h3>
              <div className="mt-4 space-y-2 text-xs">
                <HealthLine label="Token" value={data.token || 'sin dato'} ok={data.token === 'present' || data.token === 'session' || data.token === 'server-env'} />
                <HealthLine label="Webhook" value={data.webhook || 'sin dato'} ok={Boolean(data.webhook)} />
                <HealthLine label="Ultimo evento" value={data.lastMessageAt || data.status || 'sin dato'} ok={Boolean(data.lastMessageAt || data.status)} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function HealthLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <span className="font-bold text-slate-600">{label}</span>
      <span className={cn('truncate text-right font-semibold', ok ? 'text-emerald-700' : 'text-amber-700')}>{String(value)}</span>
    </div>
  )
}

function LaunchReadiness(props: {
  readiness: number
  files: any[]
  botRules: any[]
  crmConnection: any
  channelHealth: Record<string, any>
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'No configurado'
  const items = [
    { label: 'Negocio creado', ok: true, href: '/businesses', icon: Users },
    { label: 'Canal principal conectado', ok: Boolean(props.channelHealth.whatsapp?.connected || props.channelHealth.messenger?.connected || props.channelHealth.instagram?.connected), href: '/channels', icon: Radio },
    { label: 'Conocimiento cargado', ok: props.files.length > 0, href: '/files', icon: Database },
    { label: 'AI Agent configurado', ok: props.botRules.length > 0, href: '/omnichannel', icon: BrainCircuit },
    { label: 'CRM conectado', ok: Boolean(props.crmConnection?.provider && props.crmConnection.provider !== 'NONE'), href: '/crm', icon: GitBranch },
    { label: 'Variables Vercel/Railway', ok: apiUrl !== 'No configurado', href: '/settings', icon: ShieldCheck },
  ]
  return (
    <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <Rocket className="h-9 w-9 text-blue-600" />
        <h2 className="mt-4 text-xl font-black text-slate-950">Preparacion para mercado</h2>
        <p className="mt-2 text-sm text-slate-600">Checklist operativo para Railway backend, Vercel frontend y clientes reales.</p>
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>Readiness</span>
            <span>{props.readiness}%</span>
          </div>
          <Progress value={props.readiness} className="mt-2 h-2" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white">
                <span className="flex items-center gap-3">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', item.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                    <span className="text-xs text-slate-500">{item.ok ? 'Listo' : 'Pendiente'}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            )
          })}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <ProductionBox icon={Database} title="Railway backend" text="DATABASE_URL con pooler, REDIS_URL gestionado, QDRANT_URL, BACKEND_PUBLIC_URL y migraciones deploy antes del start." />
          <ProductionBox icon={Rocket} title="Vercel frontend" text="NEXT_PUBLIC_API_URL apuntando al backend Railway y NEXT_PUBLIC_WS_URL al mismo dominio sin /api/v1." />
          <ProductionBox icon={ShieldCheck} title="Multiempresa" text="Planes, limites MAC, permisos, auditoria, rate limits y presupuestos de IA por negocio." />
          <ProductionBox icon={Headphones} title="Operacion" text="Soporte, logs, health checks, alertas por canal y pruebas de webhook antes de vender." />
        </div>
      </div>
    </section>
  )
}

function ProductionBox({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-5 w-5 text-slate-600" />
      <p className="mt-3 text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
    </div>
  )
}
