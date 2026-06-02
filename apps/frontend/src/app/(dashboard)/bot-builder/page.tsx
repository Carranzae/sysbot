'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Loader2,
  MessageCircle,
  PlugZap,
  Power,
  Radio,
  Repeat,
  Sparkles,
  ToggleRight,
  Trash2,
  Workflow,
} from 'lucide-react'
import { useBusinessStore } from '@/store/business'
import { filesApi, metaApi, whatsappApi, businessApi } from '@/lib/api'
import { subscribeToBotRuleEvents } from '@/lib/websocket'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'


const architecture = [
  { title: 'Canales', description: 'WhatsApp / Instagram / Facebook capturan el mensaje entrante.' },
  { title: 'Webhook receptor', description: 'Normaliza el payload y lo envía al Motor de Conversaciones.' },
  { title: 'Motor de Conversaciones', description: 'Mantiene sesiones, contexto y deriva a reglas o IA.' },
  { title: 'Evaluador de reglas', description: 'Ejecuta INTENCIÓN + CONDICIÓN + RESPUESTA con prioridades.' },
  { title: 'Media sender', description: 'Entrega texto, imágenes, PDFs, audio o video al usuario final.' },
]

const ruleBlocks = [
  {
    title: 'Disparadores',
    items: ['Texto exacto', 'Palabras clave', 'Regex', 'Intención IA (próx.)'],
  },
  {
    title: 'Condiciones',
    items: ['Canal', 'Estado de sesión', 'Paso previo', 'Horario', 'Prioridad'],
  },
  {
    title: 'Acciones',
    items: ['Enviar texto', 'Adjuntar imagen/QR', 'Enviar PDF', 'Audio/Video', 'Derivar a humano'],
  },
]

const mvpScope = [
  'Canal: WhatsApp (api y web)',
  'Disparadores por palabras clave',
  'Sesión simple (ID + estado)',
  'Acciones con texto + imagen',
  'Toggles ON/OFF por regla',
]

const futureScope = [
  'Detección de intención con IA',
  'Estadísticas por regla e intención',
  'Testing A/B y versiones de chatbot',
  'Multi idioma y plantillas por canal',
  'Reglas encadenadas + flujo visual drag & drop',
]

const RAG_PLATFORM_LABELS: Record<'WHATSAPP_WEB' | 'WHATSAPP_API' | 'MESSENGER' | 'INSTAGRAM', string> = {
  WHATSAPP_WEB: 'WhatsApp Web',
  WHATSAPP_API: 'WhatsApp API',
  MESSENGER: 'Messenger',
  INSTAGRAM: 'Instagram',
}

const SUPPORTED_RAG_PLATFORMS = Object.keys(RAG_PLATFORM_LABELS) as Array<keyof typeof RAG_PLATFORM_LABELS>

const isValidRagPlatform = (value: string): value is keyof typeof RAG_PLATFORM_LABELS =>
  Object.prototype.hasOwnProperty.call(RAG_PLATFORM_LABELS, value)

const ruleTemplates = {
  welcome: {
    label: 'Regla de Bienvenida',
    name: 'Bienvenida automática',
    keywords: ['hola', 'buenos días', 'buenas tardes', 'inicio'],
    response:
      '¡Hola! 👋 ¿En qué puedo ayudarte hoy? Estoy listo para darte información de pagos, horarios o productos.',
  },
  info: {
    label: 'Regla de Información',
    name: 'Información de productos',
    keywords: ['tienen', 'medicamentos', 'productos', 'stock'],
    response:
      'Claro, trabajamos con medicamentos aprobados. Dime qué necesitas y te enviaré precios o catálogos.',
  },
}

const MEDIA_TYPES = [
  { key: 'image', label: 'Imagen / QR' },
  { key: 'pdf', label: 'PDF / Catálogo' },
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
]

const createEmptyMediaMap = () => ({
  image: null as string | null,
  pdf: null as string | null,
  audio: null as string | null,
  video: null as string | null,
})

type TriggerType = 'exact' | 'keywords' | 'regex'
type MediaType = 'image' | 'pdf' | 'audio' | 'video'
type RuleChannel = 'whatsapp-web' | 'whatsapp-api' | 'messenger' | 'instagram' | 'telegram'
type RuleScope = 'channel' | 'all'
type RuleEngine = 'manual' | 'rag'
type RuleSectionKey = 'scope' | 'engine' | 'channels'

interface ChannelStatus {
  connected: boolean
  state?: string
  lastCheck?: string
}

interface Rule {
  id: string
  name: string
  category: 'welcome' | 'info' | 'custom'
  triggerType: TriggerType
  triggerValue: string
  keywords: string[]
  responseText: string
  active: boolean
  mediaIds: string[]
  mediaByType: ReturnType<typeof createEmptyMediaMap>
  channels: RuleChannel[]
  scope: RuleScope
  engine: RuleEngine
}

const CHANNEL_CONFIG: Record<RuleChannel, { label: string; description: string; configureUrl: string; helper: string }> = {
  'whatsapp-web': {
    label: 'WhatsApp Web',
    description: 'Sesión manual con QR',
    configureUrl: '/channels',
    helper: 'Conecta WhatsApp Web desde Canales → WhatsApp Web',
  },
  'whatsapp-api': {
    label: 'WhatsApp API',
    description: 'Cuenta oficial / Cloud API',
    configureUrl: '/channels',
    helper: 'Activa WhatsApp Business API en Canales → WhatsApp Business API',
  },
  messenger: {
    label: 'Facebook Messenger',
    description: 'Meta Graph API',
    configureUrl: '/channels',
    helper: 'Configura Messenger en Canales → Facebook Messenger',
  },
  instagram: {
    label: 'Instagram Messaging',
    description: 'Instagram Business',
    configureUrl: '/channels',
    helper: 'Conecta Instagram en Canales → Instagram',
  },
  telegram: {
    label: 'Telegram (Próximamente)',
    description: 'Bot API',
    configureUrl: '/channels',
    helper: 'Estamos preparando esta integración.',
  },
}

const CHANNEL_KEYS: RuleChannel[] = ['whatsapp-web', 'whatsapp-api', 'messenger', 'instagram', 'telegram']

const DEFAULT_CHANNEL: RuleChannel = 'whatsapp-web'

const CHANNEL_PLATFORM_MAP: Record<RuleChannel, keyof typeof RAG_PLATFORM_LABELS | null> = {
  'whatsapp-web': 'WHATSAPP_WEB',
  'whatsapp-api': 'WHATSAPP_API',
  messenger: 'MESSENGER',
  instagram: 'INSTAGRAM',
  telegram: null,
}

const getAllChannels = () => [...CHANNEL_KEYS]
const SCOPE_CARDS: { value: RuleScope; title: string; description: string }[] = [
  {
    value: 'channel',
    title: 'Solo canal seleccionado',
    description: 'La regla se ejecuta únicamente en el canal escogido.',
  },
  {
    value: 'all',
    title: 'Todos los canales conectados',
    description: 'Ideal para mensajes globales como bienvenida o información general.',
  },
]

export default function BotBuilderPage() {
  const { selectedBusiness } = useBusinessStore()
  const { toast } = useToast()
  const [rules, setRules] = useState<Rule[]>([])
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    category: 'custom' as 'welcome' | 'info' | 'custom',
    triggerType: 'keywords' as TriggerType,
    triggerValue: '',
    keywords: [] as string[],
    responseText: '',
    mediaIds: [] as string[],
    mediaByType: createEmptyMediaMap(),
    channels: [DEFAULT_CHANNEL] as RuleChannel[],
    scope: 'channel' as RuleScope,
    engine: 'manual' as RuleEngine,
  })
  const [keywordInput, setKeywordInput] = useState('')
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [activeMediaType, setActiveMediaType] = useState<MediaType>('image')
  const [channelStatus, setChannelStatus] = useState<Record<RuleChannel, ChannelStatus>>({
    'whatsapp-web': { connected: false, state: 'Sin configurar' },
    'whatsapp-api': { connected: false, state: 'Sin configurar' },
    messenger: { connected: false, state: 'Sin configurar' },
    instagram: { connected: false, state: 'Sin configurar' },
    telegram: { connected: false, state: 'Inactivo' },
  })
  const [ruleSectionsOpen, setRuleSectionsOpen] = useState<Record<RuleSectionKey, boolean>>({
    scope: false,
    engine: false,
    channels: false,
  })

  const hasBusiness = Boolean(selectedBusiness)
  const summary = useMemo(() => {
    const totalRules = rules.length
    const activeRules = rules.filter((rule) => rule.active).length
    return { totalRules, activeRules }
  }, [rules])


  const businessId = selectedBusiness?.id
  const ragFeatureUnlocked = selectedBusiness?.allowedFeatures?.includes('AI_RAG')
  const ragChannelTargetsRaw = selectedBusiness?.botConfig?.ragChannelTargets || []
  const ragTargetsAllChannels = ragChannelTargetsRaw.length === 0
  const ragPlatformsEnabled: Array<keyof typeof RAG_PLATFORM_LABELS> = ragTargetsAllChannels
    ? SUPPORTED_RAG_PLATFORMS
    : ragChannelTargetsRaw.filter(isValidRagPlatform)
  const planExpired = selectedBusiness?.planExpiresAt ? new Date(selectedBusiness.planExpiresAt) < new Date() : false
  const businessInactive = selectedBusiness?.isActive === false
  const canUseRag = Boolean(ragFeatureUnlocked && !planExpired && !businessInactive)
  const [upgradePromptVisible, setUpgradePromptVisible] = useState(false)
  const shouldShowUpgradeBanner = upgradePromptVisible && !canUseRag

  const selectedRuleChannels = ruleForm.scope === 'all' ? getAllChannels() : ruleForm.channels
  const selectedRulePlatforms = selectedRuleChannels
    .map((channel) => CHANNEL_PLATFORM_MAP[channel])
    .filter((platform): platform is keyof typeof RAG_PLATFORM_LABELS => Boolean(platform))
  const ragBlockedChannels = ruleForm.engine === 'rag'
    ? selectedRulePlatforms.filter((platform) => !ragPlatformsEnabled.includes(platform))
    : []

  const mapApiRule = useCallback((rule: any): Rule => {
    const scopeValue = (rule.scope?.toLowerCase?.() === 'all' ? 'all' : 'channel') as RuleScope
    const baseChannels = Array.isArray(rule.channels) ? rule.channels : []
    const channels: RuleChannel[] = scopeValue === 'all'
      ? getAllChannels()
      : (baseChannels.length ? (baseChannels as RuleChannel[]) : [DEFAULT_CHANNEL])

    return {
      id: rule.id,
      name: rule.name,
      category: (rule.category as 'welcome' | 'info' | 'custom') || 'custom',
      triggerType: (rule.triggerType?.toLowerCase?.() || 'keywords') as TriggerType,
      triggerValue: rule.triggerValue || '',
      keywords: Array.isArray(rule.keywords) ? rule.keywords : [],
      responseText: rule.responseText || '',
      active: rule.active ?? true,
      mediaIds: Array.isArray(rule.mediaIds) ? rule.mediaIds : [],
      mediaByType: {
        ...createEmptyMediaMap(),
        ...(rule.responseMedia || {}),
      },
      channels,
      scope: scopeValue,
      engine: (rule.engine?.toLowerCase?.() === 'rag' ? 'rag' : 'manual') as RuleEngine,
    }
  }, [])

  const loadRules = useCallback(async () => {
    if (!businessId) {
      setRules([])
      return
    }
    setRulesLoading(true)
    try {
      const response = await businessApi.getBotRules(businessId)
      const apiRules = response.data || []
      setRules(apiRules.map(mapApiRule))
    } catch (error: any) {
      console.error('Failed to load bot rules', error)
      toast({
        title: 'No se pudieron cargar las reglas',
        description: error?.response?.data?.message || 'Intenta nuevamente más tarde.',
        variant: 'destructive',
      })
      setRules([])
    } finally {
      setRulesLoading(false)
    }
  }, [businessId, mapApiRule, toast])

  const loadMedia = useCallback(async () => {
    if (!businessId) {
      setMediaLibrary([])
      return
    }
    setMediaLoading(true)
    try {
      const response = await filesApi.getAll(businessId)
      setMediaLibrary(response.data || [])
    } catch (error: any) {
      toast({
        title: 'No se pudo cargar la biblioteca',
        description: error.response?.data?.message || 'Intenta nuevamente',
        variant: 'destructive',
      })
    } finally {
      setMediaLoading(false)
    }
  }, [businessId, toast])

  const loadChannelStatus = useCallback(async () => {
    if (!selectedBusiness) {
      setChannelStatus((prev) => ({
        ...prev,
        'whatsapp-web': { connected: false, state: 'Sin negocio' },
        'whatsapp-api': { connected: false, state: 'Sin negocio' },
        messenger: { connected: false, state: 'Sin negocio' },
        instagram: { connected: false, state: 'Sin negocio' },
        telegram: { connected: false, state: 'Sin negocio' },
      }))
      return
    }

    const status: Record<RuleChannel, ChannelStatus> = {
      'whatsapp-web': { connected: false },
      'whatsapp-api': { connected: false },
      messenger: { connected: false },
      instagram: { connected: false },
      telegram: { connected: false },
    }

    try {
      const whatsappWebResponse = await whatsappApi.getStatus(selectedBusiness.id)
      const statusVal = whatsappWebResponse.data.status
      const isConnected = whatsappWebResponse.data.connected || whatsappWebResponse.data.status?.connected || statusVal === 'READY' || statusVal?.statusString === 'READY'
      const statusStr = typeof statusVal === 'object' && statusVal !== null
        ? (statusVal.statusString || statusVal.status || '')
        : (statusVal || '')
      status['whatsapp-web'] = {
        connected: isConnected,
        state: statusStr,
        lastCheck: new Date().toLocaleString(),
      }
    } catch (error) {
      status['whatsapp-web'] = { connected: false, state: 'Sin conexión' }
    }

    try {
      const botConfigResponse = await businessApi.getBotConfig(selectedBusiness.id)
      const config = botConfigResponse?.data?.data || botConfigResponse?.data || {}
      status['whatsapp-api'] = {
        connected: Boolean(config.whatsappApiEnabled),
        state: config.whatsappApiEnabled ? 'Activo' : 'Inactivo',
      }
      status.telegram = {
        connected: Boolean(config.telegramConnected),
        state: config.telegramConnected ? 'Conectado' : config.telegramEnabled ? 'Registrado' : 'Inactivo',
        lastCheck: config.telegramLastSyncAt ? new Date(config.telegramLastSyncAt).toLocaleString() : undefined,
      }
    } catch (error) {
      status['whatsapp-api'] = { connected: false, state: 'Sin datos' }
      status.telegram = { connected: false, state: 'Sin datos' }
    }

    try {
      const metaResponse = await metaApi.getConnection(selectedBusiness.id)
      const metaData = metaResponse.data
      status.messenger = {
        connected: Boolean(metaData?.messengerConnected),
        state: metaData?.messengerConnected ? 'Conectado' : metaData?.messengerEnabled ? 'Configurado' : 'Sin configurar',
      }
      status.instagram = {
        connected: Boolean(metaData?.instagramConnected),
        state: metaData?.instagramConnected ? 'Conectado' : metaData?.instagramEnabled ? 'Configurado' : 'Sin configurar',
      }
    } catch (error) {
      status.messenger = { connected: false, state: 'Sin datos' }
      status.instagram = { connected: false, state: 'Sin datos' }
    }

    setChannelStatus(status)
  }, [selectedBusiness])

  useEffect(() => {
    loadRules()
    loadMedia()
    loadChannelStatus()
  }, [loadRules, loadMedia, loadChannelStatus])

  useEffect(() => {
    if (!businessId) return
    const unsubscribe = subscribeToBotRuleEvents((event) => {
      if (event.businessId !== businessId) return
      if (event.action === 'created') {
        setRules((prev) => [mapApiRule(event.rule), ...prev])
      } else if (event.action === 'updated') {
        setRules((prev) => prev.map((rule) => (rule.id === event.rule.id ? mapApiRule(event.rule) : rule)))
      } else if (event.action === 'deleted') {
        setRules((prev) => prev.filter((rule) => rule.id !== event.rule.id))
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [businessId, mapApiRule])

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      category: 'custom',
      triggerType: 'keywords',
      triggerValue: '',
      keywords: [],
      responseText: '',
      mediaIds: [],
      mediaByType: createEmptyMediaMap(),
      channels: [DEFAULT_CHANNEL],
      scope: 'channel',
      engine: 'manual',
    })
    setKeywordInput('')
    setActiveMediaType('image')
  }

  const applyTemplate = (template: 'welcome' | 'info') => {
    const data = ruleTemplates[template]
    setRuleForm((prev) => ({
      ...prev,
      name: data.name,
      category: template,
      triggerType: 'keywords',
      keywords: data.keywords,
      triggerValue: data.keywords.join(', '),
      responseText: data.response,
      mediaByType: createEmptyMediaMap(),
      channels: template === 'welcome' ? getAllChannels() : [DEFAULT_CHANNEL],
      scope: template === 'welcome' ? 'all' : 'channel',
      engine: 'manual',
    }))
  }

  const addKeyword = () => {
    const value = keywordInput.trim()
    if (!value) return
    setRuleForm((prev) => ({
      ...prev,
      keywords: prev.keywords.includes(value) ? prev.keywords : [...prev.keywords, value],
    }))
    setKeywordInput('')
  }

  const removeKeyword = (keyword: string) => {
    setRuleForm((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((item) => item !== keyword),
    }))
  }

  const handleKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addKeyword()
    }
  }

  const handleRuleSubmit = async () => {
    if (!businessId) {
      toast({ title: 'Selecciona un negocio', description: 'Elige un negocio antes de crear reglas.', variant: 'destructive' })
      return
    }
    const requiresKeywords = ruleForm.triggerType === 'keywords'
    if (
      !ruleForm.name.trim() ||
      (!requiresKeywords && !ruleForm.triggerValue.trim()) ||
      (requiresKeywords && ruleForm.keywords.length === 0) ||
      !ruleForm.responseText.trim()
    ) {
      toast({ title: 'Faltan datos', description: 'Completa nombre, disparadores y respuesta.', variant: 'destructive' })
      return
    }
    setSavingRule(true)
    const triggerValue = requiresKeywords ? ruleForm.keywords.join(', ') : ruleForm.triggerValue.trim()
    const dedupMediaIds = Array.from(
      new Set([
        ...ruleForm.mediaIds,
        ...Object.values(ruleForm.mediaByType).filter(Boolean) as string[],
      ])
    )
    const selectedChannels = ruleForm.scope === 'all' ? getAllChannels() : ruleForm.channels
    if (!selectedChannels.length && ruleForm.scope !== 'all') {
      toast({ title: 'Selecciona canales', description: 'Debes elegir al menos un canal para esta regla.', variant: 'destructive' })
      setSavingRule(false)
      return
    }

    try {
      const payload = {
        name: ruleForm.name.trim(),
        category: ruleForm.category,
        triggerType: ruleForm.triggerType.toUpperCase(),
        triggerValue,
        keywords: ruleForm.keywords,
        responseText: ruleForm.responseText.trim(),
        mediaIds: dedupMediaIds,
        mediaByType: ruleForm.mediaByType,
        channels: ruleForm.scope === 'all' ? [] : selectedChannels,
        scope: ruleForm.scope.toUpperCase(),
        engine: ruleForm.engine.toUpperCase(),
      }
      const response = await businessApi.createBotRule(businessId, payload)
      const createdRule = mapApiRule(response.data)
      setRules((prev) => [createdRule, ...prev])
      resetRuleForm()
      toast({ title: 'Regla creada', description: 'Tu bot responderá según las condiciones definidas.' })
    } catch (error: any) {
      console.error('Failed to create rule', error)
      toast({
        title: 'No se pudo crear la regla',
        description: error?.response?.data?.message || 'Intenta nuevamente más tarde.',
        variant: 'destructive',
      })
    } finally {
      setSavingRule(false)
    }
  }

  const handleToggleRule = async (ruleId: string, value: boolean) => {
    if (!businessId) return
    const previous = rules
    setRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, active: value } : rule)))
    try {
      await businessApi.updateBotRule(businessId, ruleId, { active: value })
    } catch (error: any) {
      console.error('Failed to toggle rule', error)
      setRules(previous)
      toast({
        title: 'No se pudo actualizar la regla',
        description: error?.response?.data?.message || 'Vuelve a intentarlo en unos minutos.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!businessId) return
    const previous = rules
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    try {
      await businessApi.deleteBotRule(businessId, ruleId)
      toast({ title: 'Regla eliminada', description: 'Se eliminó la regla correctamente.' })
    } catch (error: any) {
      console.error('Failed to delete rule', error)
      setRules(previous)
      toast({
        title: 'No se pudo eliminar',
        description: error?.response?.data?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      })
    }
  }

  const handleMediaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!businessId || !event.target.files?.[0]) return
    const file = event.target.files[0]
    setUploadingMedia(true)
    try {
      await filesApi.upload(businessId, file)
      toast({ title: 'Archivo subido', description: 'Disponible para tus reglas.' })
      await loadMedia()
    } catch (error: any) {
      toast({
        title: 'No se pudo subir',
        description: error.response?.data?.message || 'Revisa el formato del archivo.',
        variant: 'destructive',
      })
    } finally {
      setUploadingMedia(false)
      event.target.value = ''
    }
  }

  const openMediaDialog = () => {
    if (!mediaInputRef.current || !hasBusiness || uploadingMedia) return
    mediaInputRef.current.click()
  }

  const assignMediaToType = (mediaId: string) => {
    setRuleForm((prev) => {
      const updatedMediaByType = { ...prev.mediaByType, [activeMediaType]: mediaId }
      const mediaIds = Array.from(new Set([...prev.mediaIds, mediaId]))
      return {
        ...prev,
        mediaByType: updatedMediaByType,
        mediaIds,
      }
    })
  }

  const clearMediaType = (type: MediaType) => {
    setRuleForm((prev) => ({
      ...prev,
      mediaByType: { ...prev.mediaByType, [type]: null },
    }))
  }

  const toggleChannelSelection = (channel: RuleChannel) => {
    if (ruleForm.scope === 'all') return
    setRuleForm((prev) => {
      const exists = prev.channels.includes(channel)
      const nextChannels = exists ? prev.channels.filter((ch) => ch !== channel) : [...prev.channels, channel]
      return {
        ...prev,
        channels: nextChannels.length ? nextChannels : [channel],
      }
    })
  }

  const handleScopeChange = (scope: RuleScope) => {
    setRuleForm((prev) => ({
      ...prev,
      scope,
      channels: scope === 'all' ? getAllChannels() : prev.channels.length ? prev.channels : [DEFAULT_CHANNEL],
    }))
  }

  const handleEngineChange = (engine: RuleEngine) => {
    if (engine === 'rag' && !canUseRag) {
      toast({
        title: 'Actualiza tu plan',
        description: 'Activa IA RAG para generar respuestas con tu base de conocimiento.',
        variant: 'destructive',
      })
      setUpgradePromptVisible(true)
      return
    }
    if (engine === 'rag' && ragBlockedChannels.length === selectedRulePlatforms.length && selectedRulePlatforms.length > 0) {
      toast({
        title: 'Canal no habilitado para RAG',
        description: 'Solicita al administrador activar IA en estos canales o usa el motor manual.',
        variant: 'destructive',
      })
      return
    }
    setRuleForm((prev) => ({ ...prev, engine }))
  }

  const toggleRuleSection = (section: RuleSectionKey) => {
    setRuleSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="space-y-8">
      <input
        ref={mediaInputRef}
        type="file"
        className="hidden"
        disabled={!hasBusiness || uploadingMedia}
        onChange={handleMediaUpload}
      />
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary font-semibold">Rule-Based Conversational Engine</p>
            <h1 className="text-3xl font-bold text-white mt-2">Constructor de Bots (No-Code)</h1>
            <p className="text-slate-300 mt-3 max-w-3xl">
              Configura intenciones, condiciones y respuestas multimedia sin escribir código. Tu empresa define las reglas; el motor
              se encarga de ejecutarlas en todos los canales conectados.
            </p>
          </div>
          <Button asChild className="w-full lg:w-auto">
            <Link href="/files">
              Administrar archivos multimedia
            </Link>
          </Button>
        </div>
        {!hasBusiness && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-slate-500">Selecciona un negocio para comenzar a crear bots.</p>
              <Link href="/businesses" className="text-primary font-semibold">Ir a Negocios →</Link>
            </CardContent>
          </Card>
        )}
      </header>

      <Accordion type="multiple" defaultValue={[]} className="space-y-4">
        <AccordionItem value="channels">
          <AccordionTrigger>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Integraciones</p>
              <p className="text-lg font-semibold text-white">Estado de canales y configuraciones</p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <section className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => {
                const status = channelStatus[key as RuleChannel]
                const connected = status?.connected
                return (
                  <Card key={key} className="border border-white/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{cfg.label}</span>
                        {connected ? (
                          <Badge variant="default">Conectado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Pendiente</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{cfg.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-slate-300">
                        Estado: <span className="font-semibold">{status?.state || 'Sin datos'}</span>
                      </p>
                      {!connected && (
                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                          <p>{cfg.helper}</p>
                        </div>
                      )}
                      {key !== 'telegram' ? (
                        <Link href={cfg.configureUrl}>
                          <Button variant="outline" className="w-full">
                            <PlugZap className="h-4 w-4 mr-2" />
                            Gestionar
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" className="w-full" disabled>
                          Próximamente
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </section>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bots">
          <AccordionTrigger>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Operación</p>
              <p className="text-lg font-semibold text-white">Bots activos y arquitectura del motor</p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <section className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">

              <Card className="xl:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4" />Arquitectura del motor</CardTitle>
                  <CardDescription>Vista rápida del recorrido de cada mensaje.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-5">
                    {architecture.map((step, index) => (
                      <div key={step.title} className="relative">
                        <div className={cn('rounded-xl border p-3 h-full bg-white shadow-sm', index === 0 && 'border-primary')}>
                          <p className="text-xs uppercase text-primary font-semibold">Paso {index + 1}</p>
                          <p className="font-semibold mt-1">{step.title}</p>
                          <p className="text-xs text-slate-500 mt-2">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    * Primero se evalúan reglas exactas, luego palabras clave y finalmente un fallback configurable.
                  </p>
                </CardContent>
              </Card>
            </section>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rules">
          <AccordionTrigger>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Fundamentos</p>
              <p className="text-lg font-semibold text-white">Bloques de regla y contexto de sesiones</p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><ToggleRight className="h-4 w-4" />Bloques de regla</CardTitle>
                  <CardDescription>Modelo mental INTENCIÓN + CONDICIÓN + RESPUESTA.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {ruleBlocks.map((block) => (
                    <div key={block.title} className="space-y-3 rounded-xl border p-4">
                      <p className="text-sm font-semibold">{block.title}</p>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {block.items.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" />Sesiones y contexto</CardTitle>
                  <CardDescription>Control por ID de sesión + estado actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border p-4 bg-gradient-to-br from-slate-50 to-white">
                    <p className="text-sm text-slate-300">Ejemplo</p>
                    <p className="text-lg font-semibold mt-1">Sesión #WH-9813</p>
                    <p className="text-xs text-slate-500">Canal: WhatsApp • Estado: <span className="text-primary font-semibold">ESPERANDO_PAGO</span></p>
                    <Separator className="my-3" />
                    <div className="text-xs text-slate-300 space-y-1">
                      <p>Cliente: &quot;+51 999 999 999&quot;</p>
                      <p>Último paso: Detalle de pago enviado</p>
                      <p>Próxima acción: Esperar confirmación / enviar recordatorio</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cada regla puede leer y actualizar el estado de la sesión para responder con contexto real.
                  </p>
                </CardContent>
              </Card>
            </section>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="roadmap">
          <AccordionTrigger>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Planeación</p>
              <p className="text-lg font-semibold text-white">MVP en curso y hoja de ruta</p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <section className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Power className="h-4 w-4" />MVP en curso</CardTitle>
                  <CardDescription>Alcance recomendado para salir a producción rápido.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {mvpScope.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Repeat className="h-4 w-4" />Hoja de ruta</CardTitle>
                  <CardDescription>Capacidades avanzadas planificadas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {futureScope.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Reglas configurables</CardTitle>
            <CardDescription>Define disparadores, respuestas y adjunta multimedia.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Plantillas rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ruleTemplates).map(([key, template]) => (
                    <Button key={key} type="button" variant="outline" size="sm" onClick={() => applyTemplate(key as 'welcome' | 'info')}>
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleRuleSection('scope')}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm uppercase font-semibold text-white">Alcance de la regla</p>
                    <p className="text-sm text-slate-200">Define dónde se ejecutará esta lógica.</p>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', !ruleSectionsOpen.scope && '-rotate-90')} />
                </button>
                {ruleSectionsOpen.scope && (
                  <div className="grid grid-cols-2 gap-3">
                    {SCOPE_CARDS.map((card) => (
                      <button
                        key={card.value}
                        type="button"
                        className={cn(
                          'rounded-xl border p-3 text-left transition hover:border-primary',
                          ruleForm.scope === card.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-white/10'
                        )}
                        onClick={() => handleScopeChange(card.value)}
                      >
                        <p className="text-sm font-semibold">{card.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleRuleSection('engine')}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm uppercase font-semibold text-white">Motor de respuesta</p>
                    <p className="text-sm text-slate-200">Selecciona cómo se genera la respuesta.</p>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', !ruleSectionsOpen.engine && '-rotate-90')} />
                </button>
                {ruleSectionsOpen.engine && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          value: 'manual' as RuleEngine,
                          title: 'Manual',
                          description: 'Usa el texto y multimedia definidos en la regla.',
                        },
                        {
                          value: 'rag' as RuleEngine,
                          title: 'IA RAG',
                          description: 'Genera respuestas con tu conocimiento (requiere plan IA).',
                        },
                      ].map((option) => {
                        const disabled =
                          option.value === 'rag' &&
                          (!canUseRag || (selectedRulePlatforms.length > 0 && ragBlockedChannels.length === selectedRulePlatforms.length))
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleEngineChange(option.value)}
                            className={cn(
                              'rounded-xl border p-3 text-left transition hover:border-primary',
                              ruleForm.engine === option.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-white/10',
                              disabled && 'cursor-not-allowed opacity-70'
                            )}
                          >
                            <div className="text-sm font-semibold flex items-center gap-2">
                              <span>{option.title}</span>
                              {option.value === 'rag' && !canUseRag && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                  Requiere IA
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                          </button>
                        )
                      })}
                    </div>
                    {ruleForm.engine === 'rag' && canUseRag && (
                      <div className="mt-3 rounded-xl border border-dashed p-3 text-xs text-slate-300 space-y-1">
                        <p className="font-semibold text-slate-100">Canales habilitados para IA:</p>
                        <p>
                          {ragTargetsAllChannels
                            ? 'Todos los canales conectados pueden usar RAG.'
                            : ragPlatformsEnabled.map((platform) => RAG_PLATFORM_LABELS[platform]).join(', ') || 'Sin canales configurados'}
                        </p>
                        {ragBlockedChannels.length > 0 && (
                          <p className="text-amber-600 font-medium">
                            RAG no responderá en: {ragBlockedChannels.map((platform) => RAG_PLATFORM_LABELS[platform]).join(', ')}.
                          </p>
                        )}
                      </div>
                    )}
                    {shouldShowUpgradeBanner && (
                      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
                        <p className="font-semibold">IA RAG está bloqueado por tu plan actual.</p>
                        <p className="text-xs">
                          Para activar respuestas automáticas con tu base de conocimiento, actualiza tu plan o contacta a soporte.
                        </p>
                        <div className="flex gap-2">
                          <Button asChild size="sm">
                            <Link href="/settings?tab=payments">Actualizar plan</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href="/support">Hablar con soporte</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleRuleSection('channels')}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm uppercase font-semibold text-white">Canales a utilizar</p>
                    <p className="text-sm text-slate-200">Activa o desactiva canales para esta regla.</p>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', !ruleSectionsOpen.channels && '-rotate-90')} />
                </button>
                {ruleSectionsOpen.channels && (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CHANNEL_KEYS.map((channel) => {
                        const cfg = CHANNEL_CONFIG[channel]
                        const status = channelStatus[channel]
                        const selected = ruleForm.scope === 'all' ? true : ruleForm.channels.includes(channel)
                        return (
                          <button
                            key={channel}
                            type="button"
                            disabled={ruleForm.scope === 'all'}
                            onClick={() => toggleChannelSelection(channel)}
                            className={cn(
                              'rounded-xl border p-3 text-left flex flex-col gap-1 transition',
                              selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-white/10',
                              ruleForm.scope === 'all' && 'cursor-not-allowed opacity-70'
                            )}
                          >
                            <span className="text-sm font-semibold">{cfg.label}</span>
                            <span className="text-xs text-slate-500">{cfg.description}</span>
                            <Badge variant={status?.connected ? 'default' : 'outline'} className="mt-1 self-start">
                              {status?.connected ? 'Conectado' : 'Pendiente'}
                            </Badge>
                          </button>
                        )
                      })}
                    </div>
                    {ruleForm.scope === 'all' ? (
                      <p className="text-xs text-slate-500 mt-1">Esta regla se ejecutará en todos los canales conectados.</p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">Selecciona uno o varios canales. Debes mantener al menos uno activo.</p>
                    )}
                  </>
                )}
              </div>
              <div>
                <Label htmlFor="rule-name">Nombre de la regla</Label>
                <Input
                  id="rule-name"
                  placeholder="Ej. Número de pago"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Tipo de disparador</Label>
                  <Select
                    value={ruleForm.triggerType}
                    onValueChange={(value: TriggerType) => setRuleForm((prev) => ({ ...prev, triggerType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Texto exacto</SelectItem>
                      <SelectItem value="keywords">Palabras clave</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ruleForm.triggerType === 'keywords' ? 'Palabras clave' : 'Texto / patrón'}</Label>
                  {ruleForm.triggerType === 'keywords' ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Ej. pagar, QR, cuenta"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeywordKeyDown}
                      />
                      <div className="flex flex-wrap gap-2">
                        {ruleForm.keywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="gap-1">
                            {keyword}
                            <button type="button" className="ml-1 text-xs" onClick={() => removeKeyword(keyword)}>
                              ✕
                            </button>
                          </Badge>
                        ))}
                        {ruleForm.keywords.length === 0 && (
                          <p className="text-xs text-slate-500">Agrega al menos una palabra clave y presiona Enter.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Input
                      placeholder={ruleForm.triggerType === 'exact' ? 'Texto exacto' : 'Expresión regular'}
                      value={ruleForm.triggerValue}
                      onChange={(e) => setRuleForm((prev) => ({ ...prev, triggerValue: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <div>
                <Label>Respuesta automática</Label>
                <Textarea
                  rows={4}
                  placeholder="Este es nuestro número de pago..."
                  value={ruleForm.responseText}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, responseText: e.target.value }))}
                />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {MEDIA_TYPES.map((type) => (
                    <Button
                      key={type.key}
                      type="button"
                      size="sm"
                      variant={activeMediaType === (type.key as MediaType) ? 'default' : 'outline'}
                      onClick={() => setActiveMediaType(type.key as MediaType)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
                <div className="rounded-lg border p-4 space-y-2 bg-transparent/60">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                    <span>
                      Archivo para {MEDIA_TYPES.find((t) => t.key === activeMediaType)?.label || 'respuesta'}
                    </span>
                    {ruleForm.mediaByType[activeMediaType] && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => clearMediaType(activeMediaType)}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  {(() => {
                    const selectedId = ruleForm.mediaByType[activeMediaType]
                    const selectedMedia = mediaLibrary.find((media) => media.id === selectedId)
                    if (!selectedMedia) {
                      return <p className="text-xs text-slate-500">Selecciona un archivo o súbelo ahora.</p>
                    }
                    return (
                      <div className="rounded border bg-white p-3 text-xs text-slate-200">
                        <p className="font-semibold truncate" title={selectedMedia.filename || selectedMedia.originalName}>
                          {selectedMedia.filename || selectedMedia.originalName || selectedMedia.id}
                        </p>
                        <p className="text-[11px] text-slate-500">{selectedMedia.mimeType || selectedMedia.type}</p>
                      </div>
                    )
                  })()}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openMediaDialog}
                      disabled={!hasBusiness || uploadingMedia}
                    >
                      {uploadingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Subir archivo
                    </Button>
                    {mediaLibrary.length === 0 && (
                      <p className="text-xs text-slate-500">Aún no hay archivos disponibles.</p>
                    )}
                  </div>
                  {mediaLibrary.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase text-slate-500 mb-1">Biblioteca ({mediaLibrary.length})</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {mediaLibrary.map((media) => (
                          <button
                            type="button"
                            key={media.id}
                            className={cn(
                              'w-full rounded border px-3 py-2 text-left text-xs transition-colors',
                              ruleForm.mediaByType[activeMediaType] === media.id
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-white/10 hover:border-primary'
                            )}
                            onClick={() => assignMediaToType(media.id)}
                          >
                            <p className="font-semibold truncate">{media.filename || media.originalName || media.id}</p>
                            <p className="text-[11px] text-slate-500">{media.mimeType || media.type || 'archivo'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={handleRuleSubmit} disabled={!hasBusiness || savingRule} className="w-full">
                {savingRule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Crear regla
              </Button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Reglas configuradas ({rules.length})</h3>
                <p className="text-xs text-slate-500">Se guardan localmente por negocio.</p>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {rulesLoading && (
                  <div className="border border-dashed rounded-lg p-6 text-center text-sm text-slate-500">
                    Cargando reglas...
                  </div>
                )}
                {!rulesLoading && rules.length === 0 && (
                  <div className="border border-dashed rounded-lg p-6 text-center text-sm text-slate-500">
                    Aún no has creado reglas. Completa el formulario para comenzar.
                  </div>
                )}
                {rules.map((rule) => (
                  <Card key={rule.id} className="border border-white/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-white">{rule.name}</p>
                          <p className="text-xs text-slate-500">
                            {rule.category === 'welcome'
                              ? 'Bienvenida'
                              : rule.category === 'info'
                                ? 'Información'
                                : 'Personalizada'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={rule.active} onCheckedChange={(checked) => handleToggleRule(rule.id, checked)} />
                          <Badge variant={rule.active ? 'default' : 'outline'}>{rule.active ? 'ON' : 'OFF'}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                            <Trash2 className="h-4 w-4 text-slate-500" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500">Disparador</p>
                        <p className="text-sm text-slate-200">{rule.keywords?.length ? rule.keywords.join(', ') : rule.triggerValue}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500">Respuesta</p>
                        <p className="text-sm text-slate-200 whitespace-pre-line">{rule.responseText}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default" className="text-xs">
                          {rule.engine === 'rag' ? 'IA RAG' : 'Manual'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rule.scope === 'all' ? (
                          <Badge variant="outline" className="text-xs">
                            Todos los canales conectados
                          </Badge>
                        ) : (
                          rule.channels.map((channel) => (
                            <Badge key={`${rule.id}-${channel}`} variant="outline" className="text-xs">
                              {CHANNEL_CONFIG[channel]?.label || channel}
                            </Badge>
                          ))
                        )}
                      </div>
                      {MEDIA_TYPES.some((type) => rule.mediaByType?.[type.key as MediaType]) && (
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_TYPES.map((type) => {
                            const mediaId = rule.mediaByType?.[type.key as MediaType]
                            if (!mediaId) return null
                            const media = mediaLibrary.find((item) => item.id === mediaId)
                            if (!media) return null
                            return (
                              <Badge key={`${rule.id}-${type.key}`} variant="outline" className="text-xs">
                                {type.label}: {media.filename || media.originalName || 'Archivo'}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4" />Biblioteca multimedia</CardTitle>
          <CardDescription>Sube imágenes, PDFs, audio o video para reutilizarlos en reglas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-300">Los archivos se guardan por negocio.</p>
              {!hasBusiness && <p className="text-xs text-red-500">Selecciona un negocio para habilitar la subida.</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn('inline-flex items-center gap-2', !hasBusiness && 'opacity-50 cursor-not-allowed')}
              onClick={openMediaDialog}
              disabled={!hasBusiness || uploadingMedia}
            >
              {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Subir archivo
            </Button>
          </div>
          {mediaLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando biblioteca...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {mediaLibrary.length === 0 && (
                <div className="col-span-full border border-dashed rounded-lg p-6 text-center text-sm text-slate-500">
                  No hay archivos aún. Sube tus QR, catálogos o audios.
                </div>
              )}
              {mediaLibrary.map((media) => (
                <div key={media.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold truncate" title={media.filename || media.originalName}>
                    {media.filename || media.originalName || media.id}
                  </p>
                  <p className="text-xs text-slate-500">{media.mimeType || media.type || 'archivo'}</p>
                  <p className="text-xs text-slate-500 mt-1">{Math.round((media.size || 0) / 1024)} KB</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
