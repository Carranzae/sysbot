'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useBusinessStore } from '@/store/business'
import { businessApi, filesApi, whatsappApi, metaApi } from '@/lib/api'
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
import { 
  Sparkles, 
  Brain, 
  FileText, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as MusicIcon, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Edit, 
  History, 
  Workflow, 
  PlugZap, 
  Database,
  ArrowRight,
  BookOpen,
  LayoutGrid,
  FileCode,
  Layers,
  Settings2,
  Copy,
  Loader2,
  Search,
  Bell
} from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'

// Mapeos de tipo de archivo
const getFileTypeIcon = (fileType: string) => {
  switch (fileType) {
    case 'IMAGE':
      return <ImageIcon className="w-5 h-5 text-purple-500" />
    case 'VIDEO':
      return <VideoIcon className="w-5 h-5 text-red-500" />
    case 'AUDIO':
      return <MusicIcon className="w-5 h-5 text-orange-500" />
    default:
      return <FileText className="w-5 h-5 text-blue-500" />
  }
}

const getFileTypeLabel = (fileType: string) => {
  switch (fileType) {
    case 'IMAGE': return 'Imagen'
    case 'VIDEO': return 'Video'
    case 'AUDIO': return 'Audio'
    case 'DOCUMENT': return 'Documento'
    default: return 'Archivo'
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

type TriggerType = 'exact' | 'keywords' | 'regex'
type MediaType = 'image' | 'pdf' | 'audio' | 'video'
type RuleChannel = 'whatsapp-web' | 'whatsapp-api' | 'messenger' | 'instagram' | 'telegram'
type RuleScope = 'channel' | 'all'
type RuleEngine = 'manual' | 'rag'

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
  mediaByType: {
    image: string | null
    pdf: string | null
    audio: string | null
    video: string | null
  }
  channels: RuleChannel[]
  scope: RuleScope
  engine: RuleEngine
}

const CHANNEL_CONFIG: Record<RuleChannel, { label: string; description: string }> = {
  'whatsapp-web': { label: 'WhatsApp Web', description: 'Sesión por QR' },
  'whatsapp-api': { label: 'WhatsApp API', description: 'Cloud API Oficial' },
  messenger: { label: 'Facebook Messenger', description: 'Meta Graph API' },
  instagram: { label: 'Instagram Direct', description: 'Instagram Business' },
  telegram: { label: 'Telegram (Próx.)', description: 'Bot API' }
}

export default function AIStudioPage() {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '')
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const businessId = selectedBusiness?.id

  // Tabs de IA Studio: 'rules' | 'rag' | 'gallery'
  const [activeTab, setActiveTab] = useState<'rules' | 'rag' | 'gallery'>('rules')

  // Reglas (Rules) States
  const [rules, setRules] = useState<Rule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  
  const [ruleForm, setRuleForm] = useState({
    name: '',
    category: 'custom' as 'welcome' | 'info' | 'custom',
    triggerType: 'keywords' as TriggerType,
    triggerValue: '',
    keywords: [] as string[],
    responseText: '',
    mediaIds: [] as string[],
    mediaByType: {
      image: null as string | null,
      pdf: null as string | null,
      audio: null as string | null,
      video: null as string | null,
    },
    channels: ['whatsapp-web'] as RuleChannel[],
    scope: 'channel' as RuleScope,
    engine: 'manual' as RuleEngine,
  })
  const [keywordInput, setKeywordInput] = useState('')
  const [activeMediaType, setActiveMediaType] = useState<MediaType>('image')

  // Conocimiento RAG & Multimedia States
  const [files, setFiles] = useState<any[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [fileHistory, setFileHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  
  // Channels connection status
  const [channelStatus, setChannelStatus] = useState<Record<RuleChannel, { connected: boolean; state?: string }>>({
    'whatsapp-web': { connected: false, state: 'Inactivo' },
    'whatsapp-api': { connected: false, state: 'Inactivo' },
    messenger: { connected: false, state: 'Inactivo' },
    instagram: { connected: false, state: 'Inactivo' },
    telegram: { connected: false, state: 'Inactivo' },
  })

  // Load Rules & Files
  const loadRules = useCallback(async () => {
    if (!businessId) return
    setRulesLoading(true)
    try {
      const response = await businessApi.getBotRules(businessId)
      const mapped = (response.data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category || 'custom',
        triggerType: (r.triggerType?.toLowerCase() || 'keywords') as TriggerType,
        triggerValue: r.triggerValue || '',
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        responseText: r.responseText || '',
        active: r.active ?? true,
        mediaIds: r.mediaIds || [],
        mediaByType: {
          image: r.responseMedia?.image || null,
          pdf: r.responseMedia?.pdf || null,
          audio: r.responseMedia?.audio || null,
          video: r.responseMedia?.video || null,
        },
        channels: r.channels || ['whatsapp-web'],
        scope: (r.scope?.toLowerCase() === 'all' ? 'all' : 'channel') as RuleScope,
        engine: (r.engine?.toLowerCase() === 'rag' ? 'rag' : 'manual') as RuleEngine,
      }))
      setRules(mapped)
    } catch (err) {
      toast({
        title: 'Error al cargar reglas',
        description: 'No se pudieron recuperar las reglas de respuestas.',
        variant: 'destructive'
      })
    } finally {
      setRulesLoading(false)
    }
  }, [businessId, toast])

  const loadFiles = useCallback(async () => {
    if (!businessId) return
    setFilesLoading(true)
    try {
      const response = await filesApi.getAll(businessId)
      setFiles(response.data || [])
    } catch (err) {
      toast({
        title: 'Error al cargar conocimiento',
        description: 'No se pudieron recuperar los archivos RAG.',
        variant: 'destructive'
      })
    } finally {
      setFilesLoading(false)
    }
  }, [businessId, toast])

  const loadChannelStatus = useCallback(async () => {
    if (!businessId) return
    try {
      const [wsStatus, botConfig, metaConn] = await Promise.all([
        whatsappApi.getStatus(businessId).catch(() => ({ data: { connected: false, status: 'Inactivo' } })),
        businessApi.getBotConfig(businessId).catch(() => ({ data: {} })),
        metaApi.getConnection(businessId).catch(() => ({ data: {} })),
      ])

      const isWebConnected = wsStatus.data.connected || wsStatus.data.status === 'READY'
      setChannelStatus({
        'whatsapp-web': { connected: isWebConnected, state: wsStatus.data.status || 'Desconectado' },
        'whatsapp-api': { connected: !!botConfig.data?.whatsappApiEnabled, state: botConfig.data?.whatsappApiEnabled ? 'Activo' : 'Inactivo' },
        messenger: { connected: !!metaConn.data?.messengerConnected, state: metaConn.data?.messengerConnected ? 'Conectado' : 'Desconectado' },
        instagram: { connected: !!metaConn.data?.instagramConnected, state: metaConn.data?.instagramConnected ? 'Conectado' : 'Desconectado' },
        telegram: { connected: !!botConfig.data?.telegramConnected, state: botConfig.data?.telegramConnected ? 'Conectado' : 'Inactivo' },
      })
    } catch (e) {
      console.error(e)
    }
  }, [businessId])

  useEffect(() => {
    if (businessId) {
      loadRules()
      loadFiles()
      loadChannelStatus()
    }
  }, [businessId, loadRules, loadFiles, loadChannelStatus])

  // Rules handlers
  const handleKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      const val = keywordInput.trim()
      if (val && !ruleForm.keywords.includes(val)) {
        setRuleForm(prev => ({ ...prev, keywords: [...prev.keywords, val] }))
      }
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw: string) => {
    setRuleForm(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }))
  }

  const toggleChannelSelection = (ch: RuleChannel) => {
    setRuleForm(prev => {
      const exists = prev.channels.includes(ch)
      return {
        ...prev,
        channels: exists ? prev.channels.filter(c => c !== ch) : [...prev.channels, ch]
      }
    })
  }

  const handleRuleSubmit = async () => {
    if (!businessId) return
    if (!ruleForm.name.trim() || !ruleForm.responseText.trim()) {
      toast({
        title: 'Faltan datos',
        description: 'Por favor asigna un nombre y una respuesta de texto.',
        variant: 'destructive'
      })
      return
    }

    setSavingRule(true)
    try {
      const keywordsString = ruleForm.keywords.join(', ')
      const payload = {
        name: ruleForm.name.trim(),
        category: ruleForm.category,
        triggerType: ruleForm.triggerType.toUpperCase(),
        triggerValue: ruleForm.triggerType === 'keywords' ? keywordsString : ruleForm.triggerValue.trim(),
        keywords: ruleForm.keywords,
        responseText: ruleForm.responseText.trim(),
        mediaIds: ruleForm.mediaIds,
        mediaByType: ruleForm.mediaByType,
        channels: ruleForm.scope === 'all' ? [] : ruleForm.channels,
        scope: ruleForm.scope.toUpperCase(),
        engine: ruleForm.engine.toUpperCase(),
      }

      await businessApi.createBotRule(businessId, payload)
      toast({
        title: 'Regla creada',
        description: 'La regla de auto-respuesta se configuró exitosamente.'
      })
      
      // Reset form & reload
      setRuleForm({
        name: '',
        category: 'custom',
        triggerType: 'keywords',
        triggerValue: '',
        keywords: [],
        responseText: '',
        mediaIds: [],
        mediaByType: { image: null, pdf: null, audio: null, video: null },
        channels: ['whatsapp-web'],
        scope: 'channel',
        engine: 'manual',
      })
      loadRules()
    } catch (err) {
      toast({
        title: 'Error al crear regla',
        description: 'Hubo un problema al registrar la regla de IA Studio.',
        variant: 'destructive'
      })
    } finally {
      setSavingRule(false)
    }
  }

  const handleToggleRule = async (ruleId: string, value: boolean) => {
    if (!businessId) return
    try {
      await businessApi.updateBotRule(businessId, ruleId, { active: value })
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, active: value } : r))
      toast({
        title: value ? 'Regla activada' : 'Regla pausada',
        description: 'Se ha cambiado el estado de la regla correctamente.'
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de la regla.',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!businessId || !confirm('¿Estás seguro de eliminar esta regla?')) return
    try {
      await businessApi.deleteBotRule(businessId, ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      toast({
        title: 'Regla eliminada',
        description: 'La regla fue eliminada de forma permanente.'
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la regla.',
        variant: 'destructive'
      })
    }
  }

  // File Upload Handlers (RAG / Multimedia)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!businessId || !e.target.files?.[0]) return
    const file = e.target.files[0]

    // File limit check (10MB default)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Archivo excedido',
        description: 'El tamaño de archivo máximo para entrenamiento RAG es 10MB.',
        variant: 'destructive'
      })
      return
    }

    setUploadingFile(true)
    try {
      const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      await filesApi.upload(businessId, file, description || undefined, parsedTags.length ? parsedTags : undefined)
      toast({
        title: 'Archivo cargado',
        description: 'El archivo fue enviado para indexación y análisis de conocimiento.'
      })
      setDescription('')
      setTagsInput('')
      loadFiles()
    } catch (err) {
      toast({
        title: 'Error al subir',
        description: 'No se pudo procesar el archivo. Revisa el formato.',
        variant: 'destructive'
      })
    } finally {
      setUploadingFile(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDeleteFile = async (id: string) => {
    if (!confirm('¿Deseas eliminar este archivo? Se retirará de la base de datos de conocimiento y reglas.')) return
    try {
      await filesApi.delete(id)
      setFiles(prev => prev.filter(f => f.id !== id))
      toast({
        title: 'Archivo eliminado',
        description: 'El archivo RAG fue removido correctamente.'
      })
    } catch (err) {
      toast({
        title: 'Error al eliminar',
        description: 'No se pudo completar la solicitud.',
        variant: 'destructive'
      })
    }
  }

  const handleViewFileHistory = async (fileId: string) => {
    try {
      const res = await filesApi.getHistory(fileId)
      setFileHistory(res.data || [])
      setShowHistory(true)
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudo obtener el historial de versiones.',
        variant: 'destructive'
      })
    }
  }

  // Calculations for summary RAG
  const totalFiles = files.length
  const processedFiles = files.filter(f => f.isProcessed).length
  const totalRules = rules.length
  const activeRules = rules.filter(r => r.active).length

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Brain className="w-16 h-16 text-slate-400 mb-4 animate-pulse" />
        <h2 className="text-2xl font-black text-slate-800 mb-2 font-syst">IA Studio Exclusivo</h2>
        <p className="text-slate-500 mb-6 max-w-sm">Por favor selecciona un negocio en el panel para ingresar a la consola de IA Studio.</p>
        <Link href="/businesses">
          <Button className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all duration-300">
            Ir a Negocios
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 bg-slate-50/30 rounded-3xl min-h-screen">
      {/* Premium Header aligned to mockup */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-slate-800 font-syst">IA Studio</h1>
          <div className="flex items-center gap-2">
            <Select defaultValue="default-unit">
              <SelectTrigger className="w-[140px] text-xs h-9 rounded-xl border-slate-200 font-semibold focus:ring-violet-600 bg-slate-50">
                <SelectValue placeholder="Business Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default-unit">Principal Unit</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="support">Soporte Médico</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all-resources">
              <SelectTrigger className="w-[140px] text-xs h-9 rounded-xl border-slate-200 font-semibold focus:ring-violet-600 bg-slate-50">
                <SelectValue placeholder="Resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-resources">Todos los Recursos</SelectItem>
                <SelectItem value="agents">Agentes</SelectItem>
                <SelectItem value="prompts">System Prompts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 max-w-sm">
          <div className="relative bg-slate-50 border border-slate-200 rounded-xl flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar recursos cognitivos..."
              className="bg-transparent border-none focus:ring-0 text-xs w-full py-0 text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={() => {
              toast({
                title: 'Nuevo Proyecto',
                description: 'Inicializando constructor de proyecto cognitivo en IA Studio...',
              })
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 h-10 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
          
          <button className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          <button className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>

          <div className="w-9 h-9 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center font-bold text-violet-750 text-xs shadow-xs">
            US
          </div>
        </div>
      </div>

      {/* KPI Stats Row in Light Mode */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-3xl border border-slate-200/60 shadow-xs">
        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-violet-55 text-violet-600 rounded-xl border border-violet-100 shadow-xs">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reglas Activas</p>
            <p className="text-xl font-black text-slate-800 font-mono leading-none mt-1">{activeRules}/{totalRules}</p>
          </div>
        </div>

        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Documentos RAG</p>
            <p className="text-xl font-black text-slate-800 font-mono leading-none mt-1">{processedFiles}/{totalFiles}</p>
          </div>
        </div>

        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estado de IA</p>
            <p className="text-sm font-black text-emerald-650 uppercase tracking-wide mt-1">SISTEMA OPTIMIZADO</p>
          </div>
        </div>

        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-pink-50 text-pink-600 rounded-xl border border-pink-100 shadow-xs">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Archivos Multimedia</p>
            <p className="text-xl font-black text-slate-800 font-mono leading-none mt-1">
              {files.filter(f => ['IMAGE','VIDEO','AUDIO'].includes(f.fileType)).length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200/60 shadow-xs">
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab('rules')}
            className={`rounded-xl px-5 font-bold text-xs h-10 border transition-all duration-300 ${
              activeTab === 'rules' 
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/20' 
                : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Workflow className="w-4 h-4 mr-2" />
            Reglas e Intenciones
          </Button>
          <Button
            onClick={() => setActiveTab('rag')}
            className={`rounded-xl px-5 font-bold text-xs h-10 border transition-all duration-300 ${
              activeTab === 'rag' 
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/20' 
                : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Database className="w-4 h-4 mr-2" />
            Entrenamiento RAG
          </Button>
          <Button
            onClick={() => setActiveTab('gallery')}
            className={`rounded-xl px-5 font-bold text-xs h-10 border transition-all duration-300 ${
              activeTab === 'gallery' 
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/20' 
                : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Galería Multimedia
          </Button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === 'rules' && (
            <motion.div
              key="rules-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Constructor Form (Izquierda 1 Col) */}
              <div className="space-y-6 lg:col-span-1">
                <Card className="border border-slate-200/60 rounded-3xl shadow-sm bg-white">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider font-syst">Nueva Regla de Respuesta</CardTitle>
                    <CardDescription className="text-xs">
                      Define qué palabras disparan esta regla y qué responderá el bot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    
                    {/* Plantillas rápidas */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plantillas de Regla</Label>
                      <div className="flex gap-2">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setRuleForm(prev => ({
                              ...prev,
                              name: 'Bienvenida al Canal',
                              category: 'welcome',
                              triggerType: 'keywords',
                              keywords: ['hola', 'buenos días', 'buenas tardes', 'inicio'],
                              responseText: '¡Hola! Bienvenido a nuestro servicio automático. ¿En qué te puedo asesorar hoy? 👋',
                            }))
                          }}
                          className="text-[10px] rounded-lg border-slate-200 flex-1 font-bold"
                        >
                          Bienvenida
                        </Button>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setRuleForm(prev => ({
                              ...prev,
                              name: 'Horarios de Atención',
                              category: 'info',
                              triggerType: 'keywords',
                              keywords: ['horario', 'hora', 'atienden', 'abierto'],
                              responseText: 'Atendemos de Lunes a Viernes de 9:00 AM a 6:00 PM y Sábados hasta la 1:00 PM. 🕰️',
                            }))
                          }}
                          className="text-[10px] rounded-lg border-slate-200 flex-1 font-bold"
                        >
                          Horarios
                        </Button>
                      </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">Nombre de la Regla</Label>
                      <Input
                        value={ruleForm.name}
                        onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej. Saludo Inicial"
                        className="text-xs h-9 rounded-xl border-slate-200 font-medium focus-visible:ring-violet-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">Disparador (Trigger)</Label>
                      <Select 
                        value={ruleForm.triggerType} 
                        onValueChange={(val: TriggerType) => setRuleForm(prev => ({ ...prev, triggerType: val }))}
                      >
                        <SelectTrigger className="text-xs h-9 rounded-xl border-slate-200 font-semibold focus:ring-violet-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keywords">Palabras Clave (Keywords)</SelectItem>
                          <SelectItem value="exact">Coincidencia Exacta</SelectItem>
                          <SelectItem value="regex">Expresión Regular (Regex)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {ruleForm.triggerType === 'keywords' ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-500">Palabras Clave</Label>
                        <Input
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={handleKeywordKeyDown}
                          placeholder="Escribe palabra y pulsa Enter..."
                          className="text-xs h-9 rounded-xl border-slate-200 font-medium focus-visible:ring-violet-600"
                        />
                        {ruleForm.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {ruleForm.keywords.map((kw, i) => (
                              <span 
                                key={i} 
                                className="bg-violet-50 text-violet-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-violet-100 flex items-center gap-1"
                              >
                                {kw}
                                <button type="button" onClick={() => removeKeyword(kw)} className="font-bold text-violet-400 hover:text-violet-600">&times;</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-500">Valor del Disparador</Label>
                        <Input
                          value={ruleForm.triggerValue}
                          onChange={(e) => setRuleForm(prev => ({ ...prev, triggerValue: e.target.value }))}
                          placeholder={ruleForm.triggerType === 'exact' ? 'Ej. hola' : 'Ej. ^hola|saludos$'}
                          className="text-xs h-9 rounded-xl border-slate-200 font-medium focus-visible:ring-violet-600"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">Respuesta Automática (Texto)</Label>
                      <Textarea
                        value={ruleForm.responseText}
                        onChange={(e) => setRuleForm(prev => ({ ...prev, responseText: e.target.value }))}
                        placeholder="Mensaje de respuesta del bot..."
                        rows={4}
                        className="text-xs rounded-xl border-slate-200 focus-visible:ring-violet-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 font-syst">Motor de Respuesta</Label>
                      <Select 
                        value={ruleForm.engine} 
                        onValueChange={(val: RuleEngine) => setRuleForm(prev => ({ ...prev, engine: val }))}
                      >
                        <SelectTrigger className="text-xs h-9 rounded-xl border-slate-200 font-semibold focus:ring-violet-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual (Regla Exacta)</SelectItem>
                          <SelectItem value="rag">RAG (Búsqueda Cognitiva RAG)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Canales de Destino</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CHANNEL_CONFIG) as RuleChannel[]).map(ch => {
                          const isSelected = ruleForm.channels.includes(ch)
                          return (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => toggleChannelSelection(ch)}
                              className={`p-2 rounded-xl text-[10px] font-bold border text-left transition-colors truncate ${
                                isSelected 
                                  ? 'bg-violet-50 text-violet-700 border-violet-300' 
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {CHANNEL_CONFIG[ch].label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <Button
                      onClick={handleRuleSubmit}
                      disabled={savingRule}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs h-10 rounded-xl mt-4"
                    >
                      {savingRule ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          Guardando Regla...
                        </>
                      ) : (
                        'Crear Regla de Respuesta'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Rules Grid & Logs (Derecha 2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border border-slate-200/60 rounded-3xl shadow-sm bg-white">
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-extrabold uppercase tracking-wider font-syst">Reglas de Respuestas Activas</CardTitle>
                      <CardDescription className="text-xs">
                        Modifica toggles de encendido o elimina las reglas de automatización.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {rulesLoading ? (
                      <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                        Cargando Reglas...
                      </div>
                    ) : rules.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Workflow className="w-10 h-10 opacity-30 mx-auto mb-2" />
                        <p className="text-xs">Aún no se han configurado reglas de auto-respuesta.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 luxury-scrollbar">
                        {rules.map((rule) => (
                          <div 
                            key={rule.id} 
                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50/80 transition-colors flex justify-between items-start gap-4"
                          >
                            <div className="space-y-2 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-xs text-slate-800 font-syst truncate max-w-[200px]">{rule.name}</h4>
                                <span className={cn(
                                  'text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border',
                                  rule.engine === 'rag' 
                                    ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                    : 'bg-violet-50 text-violet-700 border-violet-100'
                                )}>
                                  {rule.engine === 'rag' ? 'RAG Brain' : 'Regla Manual'}
                                </span>
                              </div>
                              
                              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                {rule.responseText}
                              </p>
                              
                              {/* Keywords Trigger */}
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                                <span className="font-bold uppercase">Disparador:</span>
                                {rule.triggerType === 'keywords' ? (
                                  rule.keywords.map((kw, i) => (
                                    <span key={i} className="bg-slate-200/60 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                      {kw}
                                    </span>
                                  ))
                                ) : (
                                  <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px]">
                                    {rule.triggerValue}
                                  </span>
                                )}
                              </div>

                              {/* Target channels */}
                              <div className="flex items-center gap-1 text-[8px] text-slate-400 uppercase font-black">
                                <span className="font-bold">Canales:</span>
                                {rule.channels.length === 0 ? (
                                  <span>Todos los conectados</span>
                                ) : (
                                  rule.channels.map(ch => (
                                    <span key={ch} className="bg-primary/5 text-primary border border-primary/10 rounded px-1">
                                      {CHANNEL_CONFIG[ch]?.label || ch}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3.5 shrink-0">
                              <Switch 
                                checked={rule.active} 
                                onCheckedChange={(val) => handleToggleRule(rule.id, val)}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'rag' && (
            <motion.div
              key="rag-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Upload Panel (Izquierda) */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="border border-slate-200/60 rounded-3xl shadow-sm bg-white">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider font-syst">Entrenar Cerebro RAG</CardTitle>
                    <CardDescription className="text-xs">
                      Sube archivos PDF o TXT con las políticas de tu negocio para que la IA responda preguntas complejas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">Descripción del archivo</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ej. Políticas de Envío y Entregas"
                        className="text-xs h-9 rounded-xl border-slate-200 font-medium focus-visible:ring-violet-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">Tags (Separados por coma)</Label>
                      <Input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Ej. envíos, precios, stock"
                        className="text-xs h-9 rounded-xl border-slate-200 font-medium focus-visible:ring-violet-600"
                      />
                    </div>

                    <div className="pt-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".pdf,.txt,.doc,.docx"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs h-12 rounded-xl flex items-center justify-center gap-2 shadow-sm"
                      >
                        {uploadingFile ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Ingestando conocimiento RAG...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Seleccionar y Subir Documento
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="bg-violet-50/50 rounded-2xl border border-violet-100 p-4 space-y-2 text-[10px] text-violet-800 leading-relaxed font-medium">
                      <p className="font-bold uppercase tracking-wider">💡 Funcionamiento RAG:</p>
                      <p>Al subir un archivo, el sistema lo desglosa en fragmentos (chunks) y genera embeddings vectoriales. Cuando el bot de IA evalúa una regla configurada como &quot;Motor RAG&quot;, recuperará el fragmento más similar para responder al usuario con precisión, basándose 100% en tu documento.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* RAG Grid (Derecha) */}
              <div className="lg:col-span-2">
                <Card className="border border-slate-200/60 rounded-3xl shadow-sm bg-white">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider font-syst">Base de Conocimiento Actual</CardTitle>
                    <CardDescription className="text-xs">
                      Documentos indexados en el motor semántico de Sybot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {filesLoading ? (
                      <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                        Cargando base cognitiva...
                      </div>
                    ) : files.filter(f => f.fileType === 'DOCUMENT').length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Database className="w-10 h-10 opacity-30 mx-auto mb-2" />
                        <p className="text-xs">No hay documentos de conocimiento cargados aún.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1 luxury-scrollbar">
                        {files.filter(f => f.fileType === 'DOCUMENT').map((file) => (
                          <div 
                            key={file.id} 
                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex justify-between items-start gap-4"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                {getFileTypeIcon(file.fileType)}
                                <span className="font-extrabold text-xs text-slate-800 font-syst truncate max-w-[240px]">{file.originalName}</span>
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                                  v{file.version}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {formatFileSize(file.size)} • {file.mimeType} • {file._count?.knowledgeChunks || 0} fragmentos indexados
                              </p>
                              {file.description && (
                                <p className="text-xs text-slate-600 mt-2">{file.description}</p>
                              )}
                              {file.tags && file.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap pt-2">
                                  {file.tags.map((tag: string, i: number) => (
                                    <span key={i} className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded font-bold border border-green-100">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleViewFileHistory(file.id)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100"
                                title="Historial de Versiones"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteFile(file.id)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                title="Eliminar Archivo"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'gallery' && (
            <motion.div
              key="gallery-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Media Upload & Stats header */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 font-syst">Galería Multimedia</h3>
                  <p className="text-xs text-slate-500">Biblioteca de imágenes, videos y audios que el bot puede enviar en sus respuestas.</p>
                </div>
                <div>
                  <input 
                    type="file" 
                    id="media-uploader"
                    className="hidden" 
                    onChange={handleFileUpload} 
                    accept="image/*,video/*,audio/*"
                  />
                  <Button
                    onClick={() => document.getElementById('media-uploader')?.click()}
                    disabled={uploadingFile}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs h-10 rounded-xl flex items-center justify-center gap-2 px-5 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Subir a Galería
                  </Button>
                </div>
              </div>

              {/* Media Grid */}
              {filesLoading ? (
                <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                  Cargando archivos multimedia...
                </div>
              ) : files.filter(f => ['IMAGE', 'VIDEO', 'AUDIO'].includes(f.fileType)).length === 0 ? (
                <div className="bg-white border border-slate-200/60 rounded-3xl p-16 text-center max-w-md mx-auto shadow-sm">
                  <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-syst">Galería Vacía</h3>
                  <p className="text-xs text-slate-500 mt-2">Sube imágenes, audios o videos para utilizarlos en los disparadores del bot.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {files.filter(f => ['IMAGE', 'VIDEO', 'AUDIO'].includes(f.fileType)).map((file) => {
                    const isImg = file.fileType === 'IMAGE'
                    const isAudio = file.fileType === 'AUDIO'

                    return (
                      <Card 
                        key={file.id} 
                        className="overflow-hidden border border-slate-200 bg-white hover:border-violet-300 shadow-sm transition-all duration-300 rounded-2xl flex flex-col justify-between"
                      >
                        {/* Preview */}
                        <div className="h-40 bg-slate-950/5 relative flex items-center justify-center border-b border-slate-100 overflow-hidden group">
                          {isImg ? (
                            <img 
                              src={file.url || file.filePath || `${backendUrl}/uploads/${file.id}`}
                              alt={file.originalName} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                          ) : isAudio ? (
                            <div className="p-4 bg-orange-500/10 text-orange-600 rounded-2xl border border-orange-500/20">
                              <MusicIcon className="w-8 h-8" />
                            </div>
                          ) : (
                            <div className="p-4 bg-red-500/10 text-red-600 rounded-2xl border border-red-500/20">
                              <VideoIcon className="w-8 h-8" />
                            </div>
                          )}
                          <span className="absolute top-2.5 left-2.5 text-[9px] font-black uppercase bg-slate-900/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-md border border-white/5">
                            {getFileTypeLabel(file.fileType)}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-800 truncate font-syst" title={file.originalName}>
                              {file.originalName}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{formatFileSize(file.size)}</p>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-100 pt-3 gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(file.url || file.id)
                                toast({ title: 'Copiado', description: 'ID/URL del archivo copiado al portapapeles' })
                              }}
                              title="Copiar ID/Enlace"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteFile(file.id)}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RAG File History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-3xl p-6 focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-slate-800 font-syst text-base uppercase">Historial del Documento</DialogTitle>
            <DialogDescription className="text-xs">
              Historial de versiones y re-cargas del documento en el RAG.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[300px] overflow-y-auto luxury-scrollbar pr-1 py-2">
            {fileHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">No hay versiones anteriores registradas.</p>
            ) : (
              fileHistory.map((ver) => (
                <div key={ver.id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-700">Versión {ver.version}</span>
                    <span className="text-[9px] text-slate-400 font-bold">{new Date(ver.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 truncate font-semibold">{ver.originalName}</p>
                  <p className="text-[9px] text-slate-400">{formatFileSize(ver.size)} • {ver.mimeType}</p>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button onClick={() => setShowHistory(false)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-9 rounded-xl px-5">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
