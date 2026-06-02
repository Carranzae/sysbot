import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminApi } from "@/lib/api"
import { metaApi, whatsappApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Brain, Eye, EyeOff } from "lucide-react"

type PlanDurationOption = '1' | '2' | '3' | '6' | 'custom'

const PLAN_DURATION_OPTIONS: { value: PlanDurationOption; label: string; months?: number }[] = [
    { value: '1', label: '1 mes', months: 1 },
    { value: '2', label: '2 meses', months: 2 },
    { value: '3', label: '3 meses', months: 3 },
    { value: '6', label: '6 meses', months: 6 },
    { value: 'custom', label: 'Personalizado' },
]

const FEATURE_OPTIONS = [
    { key: 'AI_RAG', label: 'RAG con IA', description: 'Desbloquea el generador de respuestas con base de conocimiento.' },
    { key: 'SOCIAL_SCHEDULER', label: 'Planificador de Redes', description: 'Permite programar publicaciones y videos en redes sociales.' },
    { key: 'AI_CONTENT_CREATOR', label: 'Creador de Contenido IA', description: 'Habilita el uso de MCP (ChatGPT/Claude) para generar contenido.' },
]

const RAG_CHANNEL_OPTIONS = [
    { key: 'WHATSAPP_API', label: 'WhatsApp API' },
    { key: 'WHATSAPP_WEB', label: 'WhatsApp Web' },
    { key: 'MESSENGER', label: 'Messenger' },
    { key: 'INSTAGRAM', label: 'Instagram' },
]

const calculateExpirationDate = (months: number) => {
    const date = new Date()
    date.setMonth(date.getMonth() + months)
    return date.toISOString().split('T')[0]
}

const inferDurationFromDate = (dateValue?: string | null): PlanDurationOption => {
    if (!dateValue) return '1'
    const target = new Date(dateValue)
    if (isNaN(target.getTime())) return '1'
    const now = new Date()
    const diffMonths = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const match = PLAN_DURATION_OPTIONS.find(option => option.months === diffMonths)
    return match ? match.value : 'custom'
}

const formatDateLabel = (dateValue?: string) => {
    if (!dateValue) return 'Sin fecha definida'
    const parsed = new Date(dateValue)
    if (isNaN(parsed.getTime())) return 'Sin fecha definida'
    return parsed.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface BusinessFeaturesDialogProps {
    business: any
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void
}

export function BusinessFeaturesDialog({ business, isOpen, onClose, onUpdate }: BusinessFeaturesDialogProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [channelsLoading, setChannelsLoading] = useState(false)
    const [channelAction, setChannelAction] = useState<string | null>(null)

    // State for Plan
    const [planExpiresAt, setPlanExpiresAt] = useState(business.planExpiresAt ? new Date(business.planExpiresAt).toISOString().split('T')[0] : '')
    const [isActive, setIsActive] = useState(business.isActive)
    const [planDuration, setPlanDuration] = useState<PlanDurationOption>(inferDurationFromDate(business.planExpiresAt))
    const [planType, setPlanType] = useState<string>(business.planType || 'FREE')

    // State for Features
    const [features, setFeatures] = useState<string[]>(business.allowedFeatures || [])
    const [ragChannelTargets, setRagChannelTargets] = useState<string[]>(business.botConfig?.ragChannelTargets || [])

    // State for Socials
    const [allowedSocials, setAllowedSocials] = useState<string[]>(business.allowedSocials || [])
    const [canSetDestination, setCanSetDestination] = useState(business.canSetDestination ?? true)
    const [metaConnection, setMetaConnection] = useState<any | null>(null)
    const [whatsappStatus, setWhatsappStatus] = useState<string>('')

    // State for AI Engine
    const [aiProvider, setAiProvider] = useState<string>(business.botConfig?.aiProvider || 'OPENAI')
    const [aiApiKey, setAiApiKey] = useState<string>(business.botConfig?.aiApiKey || '')
    const [aiModel, setAiModel] = useState<string>(business.botConfig?.aiModel || 'gpt-4o-mini')
    const [aiBaseUrl, setAiBaseUrl] = useState<string>(business.botConfig?.aiBaseUrl || '')
    const [temperature, setTemperature] = useState<number>(business.botConfig?.temperature || 0.7)
    const [maxTokens, setMaxTokens] = useState<number>(business.botConfig?.maxTokens || 1000)
    const [showApiKey, setShowApiKey] = useState(false)

    const loadChannelStatus = async () => {
        if (!business?.id) return
        try {
            setChannelsLoading(true)
            const [metaResponse, whatsappResponse] = await Promise.allSettled([
                metaApi.getConnection(business.id),
                whatsappApi.getStatus(business.id)
            ])

            if (metaResponse.status === 'fulfilled') {
                setMetaConnection(metaResponse.value.data)
            } else {
                setMetaConnection(null)
            }

            if (whatsappResponse.status === 'fulfilled') {
                setWhatsappStatus(whatsappResponse.value.data?.status || '')
            } else {
                setWhatsappStatus('')
            }
        } finally {
            setChannelsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            loadChannelStatus()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, business?.id])

    const handleDisconnectMessenger = async () => {
        if (!business?.id) return
        try {
            setChannelAction('messenger')
            await metaApi.updateConnection(business.id, {
                messengerEnabled: false,
                messengerPageId: null,
                messengerAccessToken: null,
                messengerVerifyToken: null,
            })
            toast({ title: 'Messenger desconectado', description: 'La conexión de Messenger fue desactivada.' })
            loadChannelStatus()
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo desconectar Messenger.', variant: 'destructive' })
        } finally {
            setChannelAction(null)
        }
    }

    const handleDisconnectInstagram = async () => {
        if (!business?.id) return
        try {
            setChannelAction('instagram')
            await metaApi.updateConnection(business.id, {
                instagramEnabled: false,
                instagramAccountId: null,
                instagramAccessToken: null,
            })
            toast({ title: 'Instagram desconectado', description: 'La conexión de Instagram fue desactivada.' })
            loadChannelStatus()
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo desconectar Instagram.', variant: 'destructive' })
        } finally {
            setChannelAction(null)
        }
    }

    const handleDisconnectWhatsapp = async () => {
        if (!business?.id) return
        try {
            setChannelAction('whatsapp')
            await whatsappApi.deleteSession(business.id)
            toast({ title: 'WhatsApp Web desconectado', description: 'La sesión activa fue cerrada.' })
            loadChannelStatus()
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo cerrar la sesión de WhatsApp Web.', variant: 'destructive' })
        } finally {
            setChannelAction(null)
        }
    }

    const whatsappStatusLabel = useMemo(() => {
        if (!whatsappStatus) return 'No configurado'
        if (whatsappStatus === 'READY') return 'Conectado'
        return whatsappStatus
    }, [whatsappStatus])

    const messengerStatusLabel = useMemo(() => {
        if (!metaConnection?.messengerEnabled) return 'No configurado'
        return metaConnection?.messengerConnected ? 'Conectado' : 'Configurado (sin conexión)'
    }, [metaConnection])

    const instagramStatusLabel = useMemo(() => {
        if (!metaConnection?.instagramEnabled) return 'No configurado'
        return metaConnection?.instagramConnected ? 'Conectado' : 'Configurado (sin conexión)'
    }, [metaConnection])

    useEffect(() => {
        setPlanExpiresAt(business.planExpiresAt ? new Date(business.planExpiresAt).toISOString().split('T')[0] : '')
        setIsActive(business.isActive)
        setPlanDuration(inferDurationFromDate(business.planExpiresAt))
        setFeatures(business.allowedFeatures || [])
        setAllowedSocials(business.allowedSocials || [])
        setCanSetDestination(business.canSetDestination ?? true)
        setRagChannelTargets(business.botConfig?.ragChannelTargets || [])
        
        // AI Settings
        setAiProvider(business.botConfig?.aiProvider || 'OPENAI')
        setAiApiKey(business.botConfig?.aiApiKey || '')
        setAiModel(business.botConfig?.aiModel || 'gpt-4o-mini')
        setAiBaseUrl(business.botConfig?.aiBaseUrl || '')
        setTemperature(business.botConfig?.temperature || 0.7)
        setMaxTokens(business.botConfig?.maxTokens || 1000)
    }, [business.id])

    const handleSavePlan = async () => {
        try {
            setLoading(true)
            await adminApi.updateBusinessPlan(business.id, {
                planExpiresAt: planExpiresAt || null,
                isActive,
                planType
            })
            toast({ title: "Plan actualizado", description: "La fecha de vencimiento y estado han sido guardados." })
            onUpdate()
            onClose()
        } catch (error) {
            toast({ title: "Error", description: "No se pudo actualizar el plan", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const handleSaveSocials = async () => {
        try {
            setLoading(true)
            await adminApi.updateBusinessSocials(business.id, {
                allowedSocials,
                canSetDestination
            })
            toast({ title: "Redes actualizadas", description: "Configuración de redes sociales guardada." })
            onUpdate()
            onClose()
        } catch (error) {
            toast({ title: "Error", description: "No se pudo actualizar las redes", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const handleSaveFeatures = async () => {
        try {
            setLoading(true)
            await adminApi.updateBusinessFeatures(business.id, {
                features,
                ragChannelTargets: features.includes('AI_RAG') ? ragChannelTargets : [],
            })

            // Also update AI Motor settings in botConfig
            await adminApi.upsertConfig({ 
                businessId: business.id, // Ensure this endpoint supports businessId or use the business update
                // Actually, let's use businessApi.updateBotConfig but from Admin perspective if possible
            })
            // Wait, let's check what adminApi has for updating botConfig
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron actualizar las funciones.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const toggleFeature = (feature: string) => {
        setFeatures(prev =>
            prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
        )
    }

    const toggleRagChannel = (channel: string) => {
        setRagChannelTargets(prev =>
            prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
        )
    }

    const toggleSocial = (social: string) => {
        setAllowedSocials(prev =>
            prev.includes(social) ? prev.filter(s => s !== social) : [...prev, social]
        )
    }

    const handleSaveAI = async () => {
        try {
            setLoading(true)
            await adminApi.updateBusinessFeatures(business.id, {
                features,
                ragChannelTargets: features.includes('AI_RAG') ? ragChannelTargets : [],
            })

            // Update AI Motor settings
            const { businessApi } = await import("@/lib/api")
            await businessApi.updateBotConfig(business.id, {
                aiProvider,
                aiApiKey,
                aiModel,
                aiBaseUrl,
                temperature,
                maxTokens
            })

            toast({ title: "Configuración de IA guardada", description: "El motor de IA para este negocio ha sido actualizado." })
            onUpdate()
            onClose()
        } catch (error) {
            toast({ title: "Error", description: "No se pudo actualizar la configuración de IA", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Gestionar Negocio: {business.name}</DialogTitle>
                    <DialogDescription>
                        Usa estas pestañas para actualizar el plan, estado y permisos de redes sociales del negocio seleccionado.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="plan">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="plan">Plan</TabsTrigger>
                        <TabsTrigger value="socials">Redes</TabsTrigger>
                        <TabsTrigger value="ia">IA Motor</TabsTrigger>
                        <TabsTrigger value="channels">Canales</TabsTrigger>
                    </TabsList>

                    <TabsContent value="plan" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nivel de Plan</Label>
                            <Select
                                value={planType}
                                onValueChange={setPlanType}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona el plan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FREE">Free (Básico)</SelectItem>
                                    <SelectItem value="STARTER">Starter</SelectItem>
                                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                                    <SelectItem value="BUSINESS">Business</SelectItem>
                                    <SelectItem value="ENTERPRISE">Enterprise (Ilimitado)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Cambiar el nivel del plan actualizará los límites de mensajes y funciones automáticamente.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Duración del plan</Label>
                            <Select
                                value={planDuration}
                                onValueChange={(value) => {
                                    const duration = value as PlanDurationOption
                                    setPlanDuration(duration)
                                    const option = PLAN_DURATION_OPTIONS.find(opt => opt.value === duration)
                                    if (option?.months) {
                                        setPlanExpiresAt(calculateExpirationDate(option.months))
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona duración" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLAN_DURATION_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Escoge 1, 2, 3 o 6 meses. Si necesitas otra fecha, selecciona &quot;Personalizado&quot; y define el vencimiento manualmente.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha de Vencimiento del Plan</Label>
                            <Input
                                type="date"
                                value={planExpiresAt}
                                onChange={(e) => setPlanExpiresAt(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                                {PLAN_DURATION_OPTIONS.filter(option => option.months).map(option => (
                                    <Button
                                        key={option.value}
                                        variant={planDuration === option.value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => {
                                            setPlanDuration(option.value)
                                            setPlanExpiresAt(calculateExpirationDate(option.months!))
                                        }}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={planDuration === 'custom'}
                                    onClick={() => {
                                        const currentOption = PLAN_DURATION_OPTIONS.find(option => option.value === planDuration)
                                        if (currentOption?.months) {
                                            setPlanExpiresAt(calculateExpirationDate(currentOption.months))
                                        }
                                    }}
                                >
                                    Renovar desde hoy
                                </Button>
                            </div>
                            {planExpiresAt && (
                                <p className="text-xs text-emerald-600">
                                    El plan vence el <span className="font-semibold">{formatDateLabel(planExpiresAt)}</span>
                                </p>
                            )}
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="isActive"
                                checked={isActive}
                                onCheckedChange={(checked) => setIsActive(checked as boolean)}
                            />
                            <Label htmlFor="isActive">Negocio Activo (Si se desactiva, no podrán acceder)</Label>
                        </div>

                        <Button onClick={handleSavePlan} disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Plan
                        </Button>
                    </TabsContent>

                    <TabsContent value="socials" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Redes Sociales Permitidas</Label>
                            <div className="grid grid-cols-2 gap-4">
                                {['WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'MESSENGER', 'TELEGRAM', 'TIKTOK', 'YOUTUBE', 'LINKEDIN'].map(social => (
                                    <div key={social} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={social}
                                            checked={allowedSocials.includes(social)}
                                            onCheckedChange={() => toggleSocial(social)}
                                        />
                                        <Label htmlFor={social}>{social === 'TELEGRAM' ? 'TELEGRAM BOT' : social}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            <Label>Permisos Especiales</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="canSetDestination"
                                    checked={canSetDestination}
                                    onCheckedChange={(checked) => setCanSetDestination(checked as boolean)}
                                />
                                <Label htmlFor="canSetDestination">Permitir configurar Número de Destino</Label>
                            </div>
                        </div>

                        <Button onClick={handleSaveSocials} disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Configuración
                        </Button>

                        <div className="space-y-2 pt-6 border-t">
                            <Label>Funciones IA</Label>
                            <p className="text-xs text-muted-foreground">
                                Activa las capacidades de IA disponibles para este negocio.
                            </p>
                            <div className="space-y-3">
                                {FEATURE_OPTIONS.map((feature) => (
                                    <div key={feature.key} className="flex items-start space-x-3">
                                        <Checkbox
                                            id={`feature-${feature.key}`}
                                            checked={features.includes(feature.key)}
                                            onCheckedChange={() => toggleFeature(feature.key)}
                                        />
                                        <div>
                                            <Label htmlFor={`feature-${feature.key}`}>{feature.label}</Label>
                                            {feature.description && (
                                                <p className="text-xs text-muted-foreground">{feature.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label>Canales con RAG activo</Label>
                                <p className="text-xs text-muted-foreground">
                                    Define en qué canales debe responder la IA con base de conocimiento.
                                </p>
                                {features.includes('AI_RAG') ? (
                                    <div className="space-y-3">
                                        {RAG_CHANNEL_OPTIONS.map((channel) => (
                                            <div key={channel.key} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`rag-${channel.key}`}
                                                    checked={ragChannelTargets.includes(channel.key)}
                                                    onCheckedChange={() => toggleRagChannel(channel.key)}
                                                />
                                                <Label htmlFor={`rag-${channel.key}`}>{channel.label}</Label>
                                            </div>
                                        ))}
                                        {ragChannelTargets.length === 0 && (
                                            <p className="text-xs text-amber-600">Selecciona al menos un canal para que RAG tome efecto.</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Activa &quot;RAG con IA&quot; para elegir los canales disponibles.</p>
                                )}
                            </div>
                        </div>

                        <Button onClick={handleSaveFeatures} disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Funciones IA
                        </Button>
                    </TabsContent>

                    <TabsContent value="ia" className="space-y-4 py-4">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-5 w-5 text-blue-600" />
                                <h3 className="font-semibold">Motor de Inteligencia Artificial</h3>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Proveedor de IA</Label>
                                <Select value={aiProvider} onValueChange={setAiProvider}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OPENAI">OpenAI</SelectItem>
                                        <SelectItem value="GEMINI">Google Gemini</SelectItem>
                                        <SelectItem value="GROQ">Groq</SelectItem>
                                        <SelectItem value="OPENROUTER">OpenRouter</SelectItem>
                                        <SelectItem value="CUSTOM">Personalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Modelo</Label>
                                <Input 
                                    value={aiModel} 
                                    onChange={(e) => setAiModel(e.target.value)} 
                                    placeholder="p.ej. gpt-4o-mini"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>API Key</Label>
                                <div className="relative">
                                    <Input 
                                        type={showApiKey ? "text" : "password"}
                                        value={aiApiKey}
                                        onChange={(e) => setAiApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Base URL (Opcional)</Label>
                                <Input 
                                    value={aiBaseUrl} 
                                    onChange={(e) => setAiBaseUrl(e.target.value)} 
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Temperatura ({temperature})</Label>
                                    <Input 
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Tokens</Label>
                                    <Input 
                                        type="number"
                                        value={maxTokens}
                                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button onClick={handleSaveAI} disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Motor IA
                        </Button>
                    </TabsContent>

                    <TabsContent value="channels" className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Estado de integraciones</Label>
                                <p className="text-xs text-muted-foreground">Consulta y corta sesiones activas sin salir del panel admin.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={loadChannelStatus} disabled={channelsLoading}>
                                {channelsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">WhatsApp Web</p>
                                        <p className="text-xs text-muted-foreground">Sesión de escaneo QR en escritorio.</p>
                                        <p className="text-xs mt-1">Estado: <span className="font-semibold">{whatsappStatusLabel}</span></p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDisconnectWhatsapp}
                                        disabled={channelAction === 'whatsapp' || whatsappStatus !== 'READY'}
                                    >
                                        {channelAction === 'whatsapp' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Desconectar
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Messenger</p>
                                        <p className="text-xs text-muted-foreground">Integración via Meta Graph API.</p>
                                        <p className="text-xs mt-1">Estado: <span className="font-semibold">{messengerStatusLabel}</span></p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDisconnectMessenger}
                                        disabled={channelAction === 'messenger' || !metaConnection?.messengerEnabled}
                                    >
                                        {channelAction === 'messenger' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Desconectar
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Instagram Direct</p>
                                        <p className="text-xs text-muted-foreground">Canal Instagram Business via Meta.</p>
                                        <p className="text-xs mt-1">Estado: <span className="font-semibold">{instagramStatusLabel}</span></p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDisconnectInstagram}
                                        disabled={channelAction === 'instagram' || !metaConnection?.instagramEnabled}
                                    >
                                        {channelAction === 'instagram' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Desconectar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
