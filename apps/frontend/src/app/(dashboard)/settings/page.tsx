'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { businessApi, whatsappApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    CreditCard,
    Phone,
    Clock,
    Globe,
    Bell,
    Shield,
    Save,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Mail,
    Smartphone,
    Settings as SettingsIcon,
    MessageCircle,
    QrCode,
    Users,
    Send,
    Brain,
    Key,
    Eye,
    EyeOff,
    Zap,
    Bot
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useBusinessStore } from '@/store/business'

const LANGUAGE_OPTIONS = [{ value: 'es', label: 'Español' }]
const CURRENCY_OPTIONS = [{ value: 'PEN', label: 'Sol peruano (PEN)' }]
type BusinessHours = Record<string, { open: string; close: string; closed: boolean }>
const getDefaultBusinessHours = (): BusinessHours => ({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '14:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
})
const normalizeBusinessHours = (hours?: any): BusinessHours => {
    if (!hours || typeof hours !== 'object') return getDefaultBusinessHours()
    const defaults = getDefaultBusinessHours()
    return Object.keys(defaults).reduce((acc, key) => {
        const value = hours[key]
        if (
            value &&
            typeof value.open === 'string' &&
            typeof value.close === 'string' &&
            typeof value.closed === 'boolean'
        ) {
            acc[key] = value
        } else {
            acc[key] = defaults[key]
        }
        return acc
    }, {} as BusinessHours)
}

export default function BusinessSettingsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const { selectedBusiness, loadBusinesses } = useBusinessStore()
    
    // Usar businessId de la URL o del negocio seleccionado
    const businessId = searchParams?.get('businessId') || selectedBusiness?.id
    
    console.log('Settings page - searchParams businessId:', searchParams?.get('businessId'))
    console.log('Settings page - selectedBusiness:', selectedBusiness)
    console.log('Settings page - final businessId:', businessId)

    // Loading states
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [telegramBotToken, setTelegramBotToken] = useState('')
    const [telegramConnected, setTelegramConnected] = useState(false)
    const [telegramSaving, setTelegramSaving] = useState(false)
    // Form states
    const [paymentForm, setPaymentForm] = useState({
        email: '',
        gateway: '',
        whatsappNumber: '',
        webhookUrl: ''
    })

    const [contactForm, setContactForm] = useState({
        supportEmail: '',
        supportPhone: '',
        timezone: 'America/Lima',
        businessHours: getDefaultBusinessHours(),
    })

    const [preferencesForm, setPreferencesForm] = useState({
        language: LANGUAGE_OPTIONS[0].value,
        currency: CURRENCY_OPTIONS[0].value,
        notifications: {
            emailNotifications: true,
            smsNotifications: false,
            pushNotifications: true,
        },
        privacy: {
            dataRetentionDays: 365,
            allowAnalytics: true,
            shareData: false,
        }
    })

    const [whatsappForm, setWhatsappForm] = useState({
        enabled: false,
        destinationNumber: '',
        autoReply: true, // Habilitado por defecto
        qrCode: '',
        upsellingEnabled: false,
        sentimentAnalysisEnabled: false,
        groups: [] as Array<{
            id: string;
            name: string;
            participants: string[];
            autoSendFiles: boolean;
            fileTypes: string[];
        }>,
        webConnection: {
            connected: false,
            phoneNumber: '',
            qrCodeData: '',
            lastConnected: null as Date | null
        },
        respondInGroups: false
    })

    const [aiForm, setAiForm] = useState({
        aiProvider: 'GROQ',
        aiApiKey: '',
        aiModel: 'llama-3.1-8b-instant',
        aiBaseUrl: 'https://api.groq.com/openai/v1',
        temperature: 0.7,
        maxTokens: 500,
        showApiKey: false
    })

    const loadSettings = async () => {
        if (!businessId) return

        try {
            setLoading(true)
            
            // Primero verificar el estado de WhatsApp Web (antes que todo)
            await checkWhatsAppStatus()
            
            // Cargar configuración real del bot desde el backend
            try {
                const botConfigResponse = await businessApi.getBotConfig(businessId)
                const botConfig = botConfigResponse.data
                
                setWhatsappForm({
                    enabled: botConfig.whatsappWebEnabled || false,
                    destinationNumber: botConfig.whatsappWebNumber || '',
                    autoReply: botConfig.autoReply || false,
                    upsellingEnabled: botConfig.upsellingEnabled || false,
                    sentimentAnalysisEnabled: botConfig.sentimentAnalysisEnabled || false,
                    qrCode: '',
                    groups: [],
                    webConnection: whatsappForm.webConnection, // Mantener estado de conexión
                    respondInGroups: botConfig.respondInGroups || false
                })

                // Cargar configuración de IA
                setAiForm({
                    aiProvider: botConfig.aiProvider || 'GROQ',
                    aiApiKey: botConfig.aiApiKey || '',
                    aiModel: botConfig.aiModel || 'llama-3.1-8b-instant',
                    aiBaseUrl: botConfig.aiBaseUrl || 'https://api.groq.com/openai/v1',
                    temperature: botConfig.temperature || 0.7,
                    maxTokens: botConfig.maxTokens || 500,
                    showApiKey: false
                })

                // Cargar configuración de Telegram
                setTelegramBotToken(botConfig.telegramBotToken || '')
                setTelegramConnected(botConfig.telegramConnected || false)
            } catch (error) {
                console.log('Bot config not found, using defaults')
                // Si no hay configuración, usar valores por defecto
                setWhatsappForm({
                    enabled: false,
                    destinationNumber: '',
                    autoReply: true,
                    upsellingEnabled: false,
                    sentimentAnalysisEnabled: false,
                    qrCode: '',
                    groups: [],
                    webConnection: whatsappForm.webConnection,
                    respondInGroups: false
                })

                setAiForm({
                    aiProvider: 'GROQ',
                    aiApiKey: '',
                    aiModel: 'llama-3.1-8b-instant',
                    aiBaseUrl: 'https://api.groq.com/openai/v1',
                    temperature: 0.7,
                    maxTokens: 500,
                    showApiKey: false
                })
            }
            
            try {
                const paymentResponse = await businessApi.getPaymentSettings(businessId)
                const paymentData = paymentResponse.data
                setPaymentForm({
                    email: paymentData.email || '',
                    gateway: paymentData.gateway || '',
                    whatsappNumber: paymentData.whatsappNumber || '',
                    webhookUrl: paymentData.webhookUrl || '',
                })
            } catch (paymentError) {
                console.error('Error loading payment settings', paymentError)
                setPaymentForm({
                    email: '',
                    gateway: '',
                    whatsappNumber: '',
                    webhookUrl: '',
                })
            }

            try {
                const contactResponse = await businessApi.getContactSettings(businessId)
                const contactData = contactResponse.data
                setContactForm({
                    supportEmail: contactData.supportEmail || '',
                    supportPhone: contactData.supportPhone || '',
                    timezone: contactData.timezone || 'America/Lima',
                    businessHours: contactData.businessHours || getDefaultBusinessHours(),
                })
            } catch (contactError) {
                console.error('Error loading contact settings', contactError)
                setContactForm({
                    supportEmail: '',
                    supportPhone: '',
                    timezone: 'America/Lima',
                    businessHours: getDefaultBusinessHours(),
                })
            }
            
            try {
                const preferencesResponse = await businessApi.getPreferences(businessId)
                const prefData = preferencesResponse.data
                setPreferencesForm({
                    language: prefData.language || LANGUAGE_OPTIONS[0].value,
                    currency: prefData.currency || CURRENCY_OPTIONS[0].value,
                    notifications: {
                        emailNotifications: prefData.notifications?.emailNotifications ?? true,
                        smsNotifications: prefData.notifications?.smsNotifications ?? false,
                        pushNotifications: prefData.notifications?.pushNotifications ?? true,
                    },
                    privacy: {
                        dataRetentionDays: prefData.privacy?.dataRetentionDays ?? 365,
                        allowAnalytics: prefData.privacy?.allowAnalytics ?? true,
                        shareData: prefData.privacy?.shareData ?? false,
                    }
                })
            } catch (preferencesError) {
                console.error('Error loading business preferences', preferencesError)
                setPreferencesForm({
                    language: LANGUAGE_OPTIONS[0].value,
                    currency: CURRENCY_OPTIONS[0].value,
                    notifications: {
                        emailNotifications: true,
                        smsNotifications: false,
                        pushNotifications: true,
                    },
                    privacy: {
                        dataRetentionDays: 365,
                        allowAnalytics: true,
                        shareData: false,
                    }
                })
            }

        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'No se pudo cargar la configuración',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadBusinessesFromStore = async () => {
        try {
            await loadBusinesses()
            // Después de cargar los negocios, verificar si hay uno seleccionado
            if (selectedBusiness) {
                loadSettings()
            }
        } catch (error: any) {
            console.error('Error loading businesses:', error)
        }
    }

    const handleSavePaymentSettings = async () => {
        if (!businessId) return

        try {
            setSaving(true)
            await businessApi.updatePaymentSettings(businessId, {
                email: paymentForm.email,
                gateway: paymentForm.gateway,
                whatsappNumber: paymentForm.whatsappNumber,
                paymentWebhookUrl: paymentForm.webhookUrl,
            })
            toast({
                title: 'Configuración guardada',
                description: 'La configuración de pagos se ha guardado correctamente',
            })
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo guardar la configuración de pagos',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const handleSaveContactSettings = async () => {
        if (!businessId) return

        try {
            setSaving(true)
            await businessApi.updateContactSettings(businessId, {
                supportEmail: contactForm.supportEmail,
                supportPhone: contactForm.supportPhone,
                timezone: contactForm.timezone,
                businessHours: contactForm.businessHours,
            })
            toast({
                title: 'Configuración guardada',
                description: 'La configuración de contacto se ha guardado correctamente',
            })
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo guardar la configuración de contacto',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const handleSavePreferences = async () => {
        if (!businessId) return

        try {
            setSaving(true)
            await businessApi.updatePreferences(businessId, {
                language: preferencesForm.language,
                currency: preferencesForm.currency,
                notifications: preferencesForm.notifications,
                privacy: preferencesForm.privacy,
            })
            toast({
                title: 'Configuración guardada',
                description: 'Las preferencias se han guardado correctamente',
            })
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo guardar las preferencias',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const handleSaveWhatsAppSettings = async () => {
        if (!businessId) return

        try {
            setSaving(true)
            
            // Guardar configuración real del bot en el backend
            await businessApi.updateBotConfig(businessId, {
                whatsappWebEnabled: whatsappForm.enabled,
                autoReply: whatsappForm.autoReply,
                destinationNumber: whatsappForm.destinationNumber,
                upsellingEnabled: whatsappForm.upsellingEnabled,
                sentimentAnalysisEnabled: whatsappForm.sentimentAnalysisEnabled,
                respondInGroups: whatsappForm.respondInGroups,
                welcomeMessage: '¡Hola! 👋 Bienvenido a nuestro negocio. ¿En qué podemos ayudarte?',
                fallbackMessage: 'En este momento no estamos disponibles. Te responderemos pronto.',
            })
            
            toast({
                title: 'Configuración guardada',
                description: 'La configuración de WhatsApp se ha guardado correctamente',
            })
        } catch (error: any) {
            console.error('Error saving WhatsApp settings:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo guardar la configuración de WhatsApp',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const handleConnectTelegram = async () => {
        if (!businessId || !telegramBotToken.trim()) return
        try {
            setTelegramSaving(true)
            await businessApi.connectTelegram(businessId, { botToken: telegramBotToken })
            setTelegramConnected(true)
            toast({
                title: 'Telegram conectado',
                description: 'El bot de Telegram se ha conectado correctamente.',
            })
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo conectar el bot de Telegram.',
                variant: 'destructive',
            })
        } finally {
            setTelegramSaving(false)
        }
    }

    const handleDisconnectTelegram = async () => {
        if (!businessId) return
        try {
            setTelegramSaving(true)
            await businessApi.disconnectTelegram(businessId)
            setTelegramConnected(false)
            setTelegramBotToken('')
            toast({
                title: 'Telegram desconectado',
                description: 'El bot de Telegram ha sido desconectado.',
            })
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo desconectar.',
                variant: 'destructive',
            })
        } finally {
            setTelegramSaving(false)
        }
    }

    const checkWhatsAppStatus = async () => {
        if (!businessId) return

        try {
            const response = await whatsappApi.getStatus(businessId)
            const statusData = response.data
            const isConnected = statusData.connected || statusData.status?.connected || statusData.status === 'READY' || statusData.status?.statusString === 'READY'
            const phoneNumber = statusData.phoneNumber || statusData.status?.phoneNumber || ''
            const rawLastConnected = statusData.lastConnected || statusData.status?.lastConnected
            const lastConnected = rawLastConnected ? new Date(rawLastConnected) : null

            setWhatsappForm(prev => ({
                ...prev,
                webConnection: {
                    ...prev.webConnection,
                    connected: isConnected,
                    phoneNumber: phoneNumber,
                    lastConnected: lastConnected
                }
            }))
        } catch (error: any) {
            console.error('Error checking WhatsApp status:', error)
        }
    }

    const handleDisconnectWhatsApp = async () => {
        if (!businessId) {
            toast({
                title: 'Error',
                description: 'No se encontró el ID del negocio',
                variant: 'destructive',
            })
            return
        }

        // Limpiar el interval de refresco si existe
        if ((window as any).qrRefreshInterval) {
            clearInterval((window as any).qrRefreshInterval)
            delete (window as any).qrRefreshInterval
        }

        try {
            await whatsappApi.deleteSession(businessId)
            
            setWhatsappForm(prev => ({
                ...prev,
                webConnection: {
                    ...prev.webConnection,
                    connected: false,
                    phoneNumber: '',
                    qrCodeData: '',
                    lastConnected: null
                }
            }))
            
            toast({
                title: 'WhatsApp desconectado',
                description: 'La sesión de WhatsApp Web se ha cerrado correctamente',
            })
        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'No se pudo desconectar WhatsApp Web',
                variant: 'destructive',
            })
        }
    }

    const handleConnectWhatsApp = async () => {
        if (!businessId) {
            toast({
                title: 'Error',
                description: 'No se encontró el ID del negocio',
                variant: 'destructive',
            })
            return
        }

        try {
            console.log('Connecting WhatsApp for business:', businessId)
            
            // Inicializar WhatsApp Web
            await whatsappApi.initWeb(businessId)
            console.log('WhatsApp Web initialized')
            
            // Obtener el código QR inicial
            await refreshQrCode()
            
            // Configurar refresco automático cada 15 segundos
            const refreshInterval = setInterval(async () => {
                try {
                    await refreshQrCode()
                } catch (error) {
                    console.error('Error refreshing QR:', error)
                    clearInterval(refreshInterval)
                }
            }, 15000)
            
            // Guardar el interval ID para limpiarlo después
            ;(window as any).qrRefreshInterval = refreshInterval
            
            toast({
                title: 'QR generado',
                description: 'Escanea el código QR con WhatsApp. El QR se actualizará automáticamente cada 15 segundos.',
            })
        } catch (error: any) {
            console.error('Error connecting WhatsApp:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo generar el código QR',
                variant: 'destructive',
            })
        }
    }

    const refreshQrCode = async () => {
        if (!businessId) return
        
        try {
            const response = await whatsappApi.getQr(businessId)
            console.log('QR response:', response.data)
            
            setWhatsappForm(prev => ({
                ...prev,
                webConnection: {
                    ...prev.webConnection,
                    qrCodeData: response.data.qr || ''
                }
            }))
        } catch (error: any) {
            console.error('Error getting QR:', error)
            throw error
        }
    }

    const addGroup = () => {
        const newGroup = {
            id: `group_${Date.now()}`,
            name: 'Nuevo Grupo',
            participants: [],
            autoSendFiles: false,
            fileTypes: []
        }
        setWhatsappForm(prev => ({
            ...prev,
            groups: [...prev.groups, newGroup]
        }))
    }

    const updateGroup = (groupId: string, field: string, value: any) => {
        setWhatsappForm(prev => ({
            ...prev,
            groups: prev.groups.map(group => 
                group.id === groupId ? { ...group, [field]: value } : group
            )
        }))
    }

    const removeGroup = (groupId: string) => {
        setWhatsappForm(prev => ({
            ...prev,
            groups: prev.groups.filter(group => group.id !== groupId)
        }))
    }

    const updateBusinessHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
        setContactForm(prev => ({
            ...prev,
            businessHours: {
                ...prev.businessHours,
                [day]: {
                    ...prev.businessHours[day as keyof typeof prev.businessHours],
                    [field]: value
                }
            }
        }))
    }

    useEffect(() => {
        loadSettings()
    }, [businessId])

    // Verificar estado de WhatsApp periódicamente cuando hay QR activo
    useEffect(() => {
        if (!businessId || !whatsappForm.webConnection.qrCodeData) return

        const statusInterval = setInterval(async () => {
            try {
                const response = await whatsappApi.getStatus(businessId)
                const statusData = response.data
                const isConnected = statusData.connected || statusData.status?.connected || statusData.status === 'READY' || statusData.status?.statusString === 'READY'
                
                if (isConnected) {
                    // Si se conectó, limpiar interval de refresco QR y actualizar estado
                    if ((window as any).qrRefreshInterval) {
                        clearInterval((window as any).qrRefreshInterval)
                        delete (window as any).qrRefreshInterval
                    }
                    
                    const phoneNumber = statusData.phoneNumber || statusData.status?.phoneNumber || ''
                    const rawLastConnected = statusData.lastConnected || statusData.status?.lastConnected
                    const lastConnected = rawLastConnected ? new Date(rawLastConnected) : new Date()

                    setWhatsappForm(prev => ({
                        ...prev,
                        webConnection: {
                            ...prev.webConnection,
                            connected: true,
                            phoneNumber: phoneNumber,
                            qrCodeData: '', // Limpiar QR ya no necesario
                            lastConnected: lastConnected
                        }
                    }))
                    
                    toast({
                        title: '¡WhatsApp conectado!',
                        description: 'Tu negocio está ahora conectado a WhatsApp Web',
                    })
                }
            } catch (error) {
                console.error('Error checking WhatsApp status:', error)
            }
        }, 3000) // Verificar cada 3 segundos

        return () => clearInterval(statusInterval)
    }, [businessId, whatsappForm.webConnection.qrCodeData])

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Configuración del Negocio
                    </h1>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader className="pb-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 rounded"></div>
                                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    if (!businessId) {
        return (
            <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Negocio no seleccionado</AlertTitle>
                <AlertDescription className="text-red-700">
                    Debes seleccionar un negocio para configurar sus ajustes.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Configuración del Negocio
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Personaliza los pagos, contacto y preferencias de tu negocio
                    </p>
                </div>
                <Button onClick={loadSettings} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                </Button>
            </div>

            <Tabs defaultValue="payments" className="space-y-6">
                <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="payments" className="gap-2">
                        <CreditCard className="h-4 w-4" />
                        Pagos
                    </TabsTrigger>
                    <TabsTrigger value="contact" className="gap-2">
                        <Phone className="h-4 w-4" />
                        Contacto
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="gap-2">
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="hours" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Horarios
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        Preferencias
                    </TabsTrigger>
                    <TabsTrigger value="ai-advanced" className="gap-2">
                        <Brain className="h-4 w-4" />
                        IA Avanzada
                    </TabsTrigger>
                    <TabsTrigger value="telegram" className="gap-2">
                        <Send className="h-4 w-4" />
                        Telegram
                    </TabsTrigger>
                </TabsList>

                {/* Payment Settings */}
                <TabsContent value="payments" className="space-y-6">
                    <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Configuración de Pagos
                            </CardTitle>
                            <CardDescription>
                                Configura cómo recibirás pagos y notificaciones de tu negocio
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="payment-email">Correo para Pagos</Label>
                                    <Input
                                        id="payment-email"
                                        type="email"
                                        placeholder="pagos@tunegocio.com"
                                        value={paymentForm.email}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Recibirás notificaciones de pagos en este correo
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="payment-gateway">Pasarela de Pago</Label>
                                    <Select value={paymentForm.gateway} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, gateway: value }))}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona pasarela" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="stripe">Stripe</SelectItem>
                                            <SelectItem value="paypal">PayPal</SelectItem>
                                            <SelectItem value="mercadopago">MercadoPago</SelectItem>
                                            <SelectItem value="transbank">Transbank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="whatsapp-number">Número de WhatsApp</Label>
                                    <Input
                                        id="whatsapp-number"
                                        placeholder="+56912345678"
                                        value={paymentForm.whatsappNumber}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Número para recibir confirmaciones de pago
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="webhook-url">URL de Webhook</Label>
                                    <Input
                                        id="webhook-url"
                                        placeholder="https://tu-api.com/webhooks/payments"
                                        value={paymentForm.webhookUrl}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Endpoint para recibir actualizaciones de pago
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex justify-end">
                                <Button onClick={handleSavePaymentSettings} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Guardar Configuración de Pagos
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contact Settings */}
                <TabsContent value="contact" className="space-y-6">
                    <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Configuración de Contacto
                            </CardTitle>
                            <CardDescription>
                                Define cómo tus clientes pueden contactarte
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="support-email">Correo de Soporte</Label>
                                    <Input
                                        id="support-email"
                                        type="email"
                                        placeholder="soporte@tunegocio.com"
                                        value={contactForm.supportEmail}
                                        onChange={(e) => setContactForm(prev => ({ ...prev, supportEmail: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="support-phone">Teléfono de Soporte</Label>
                                    <Input
                                        id="support-phone"
                                        placeholder="+56912345678"
                                        value={contactForm.supportPhone}
                                        onChange={(e) => setContactForm(prev => ({ ...prev, supportPhone: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="timezone">Zona Horaria</Label>
                                    <Select value={contactForm.timezone} onValueChange={(value) => setContactForm(prev => ({ ...prev, timezone: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="America/Lima">Lima (GMT-5)</SelectItem>
                                            <SelectItem value="America/Santiago">Santiago (GMT-3)</SelectItem>
                                            <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                                            <SelectItem value="America/New_York">Nueva York (GMT-5)</SelectItem>
                                            <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex justify-end">
                                <Button onClick={handleSaveContactSettings} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Guardar Configuración de Contacto
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* WhatsApp Settings */}
                <TabsContent value="whatsapp" className="space-y-6">
                    <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5" />
                                Configuración de WhatsApp Web
                            </CardTitle>
                            <CardDescription>
                                Configura la conexión con WhatsApp Web, números de destino y grupos
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* WhatsApp Connection */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold">Conexión WhatsApp Web</h3>
                                        <p className="text-sm text-slate-300">
                                            {whatsappForm.webConnection.connected 
                                                ? `Conectado como ${whatsappForm.webConnection.phoneNumber}`
                                                : 'No conectado'
                                            }
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={checkWhatsAppStatus} className="gap-2">
                                            <RefreshCw className="h-4 w-4" />
                                            Refrescar Estado
                                        </Button>
                                        {whatsappForm.webConnection.connected ? (
                                            <>
                                                <Button variant="outline" className="gap-2" onClick={handleDisconnectWhatsApp}>
                                                    <Smartphone className="h-4 w-4" />
                                                    Desconectar
                                                </Button>
                                                <Button variant="destructive" className="gap-2" onClick={handleDisconnectWhatsApp}>
                                                    <AlertTriangle className="h-4 w-4" />
                                                    Forzar Desconexión
                                                </Button>
                                            </>
                                        ) : (
                                            <Button onClick={handleConnectWhatsApp} className="gap-2">
                                                <QrCode className="h-4 w-4" />
                                                Conectar con QR
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {whatsappForm.webConnection.qrCodeData && (
                                    <div className="flex justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                                        <div className="text-center">
                                            <div className="mb-4 p-4 bg-white rounded-lg">
                                                <img 
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(whatsappForm.webConnection.qrCodeData)}`}
                                                    alt="WhatsApp QR Code"
                                                    className="mx-auto"
                                                />
                                            </div>
                                            <p className="text-sm text-slate-300 mb-2">
                                                Escanea este código QR con WhatsApp
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Abre WhatsApp &gt; Menú &gt; WhatsApp Web &gt; Escanear código QR
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* General Settings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Configuración General</h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp-enabled">Habilitar WhatsApp</Label>
                                        <Switch
                                            checked={whatsappForm.enabled}
                                            onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, enabled: checked }))}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Activa o desactiva el servicio de WhatsApp
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="auto-reply">Respuestas Automáticas</Label>
                                        <Switch
                                            checked={whatsappForm.autoReply}
                                            onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, autoReply: checked }))}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Habilita respuestas automáticas del bot cuando recibas mensajes
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="destination-number">Número de Destino</Label>
                                        <Input
                                            id="destination-number"
                                            placeholder="+56912345678"
                                            value={whatsappForm.destinationNumber}
                                            onChange={(e) => setWhatsappForm(prev => ({ ...prev, destinationNumber: e.target.value }))}
                                            disabled={!whatsappForm.enabled}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Número al que se enviarán los mensajes por defecto
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="auto-reply">Respuesta Automática</Label>
                                        <Switch
                                            checked={whatsappForm.autoReply}
                                            onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, autoReply: checked }))}
                                            disabled={!whatsappForm.enabled}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Responde automáticamente a mensajes entrantes
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Groups Configuration */}
                            <div className="space-y-4 border rounded-lg p-6 bg-blue-50/30 border-blue-100">
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-blue-900">Gestión de Grupos</h3>
                                        <p className="text-sm text-blue-700">
                                            Habilita el bot para responder y gestionar grupos de WhatsApp automáticamente.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Auto-gestión de grupos</span>
                                    <Switch 
                                        checked={whatsappForm.respondInGroups}
                                        onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, respondInGroups: checked }))}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSaveWhatsAppSettings} disabled={saving} className="bg-green-600 hover:bg-green-700 h-12 px-8">
                                    {saving ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Guardar Configuración WhatsApp
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Telegram Settings */}
                <TabsContent value="telegram" className="space-y-6">
                    <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-blue-500" />
                                Configuración de Telegram
                            </CardTitle>
                            <CardDescription>
                                Conecta tu negocio con Telegram para responder a tus clientes
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-4 border rounded-xl p-6 bg-white shadow-sm border-white/5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Bot className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Telegram Bot (Recomendado)</h3>
                                            {telegramConnected && (
                                                <Badge className="bg-green-100 text-green-800 border-green-200">Conectado</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Crea un bot oficial con @BotFather y pega el token aquí.
                                    </p>
                                    <div className="space-y-2">
                                        <Label>Token del Bot</Label>
                                        <Input 
                                            type="password" 
                                            placeholder="123456789:ABCDEF..."
                                            value={telegramBotToken}
                                            onChange={(e) => setTelegramBotToken(e.target.value)}
                                            disabled={telegramConnected}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        {!telegramConnected ? (
                                            <Button 
                                                onClick={handleConnectTelegram} 
                                                disabled={telegramSaving || !telegramBotToken.trim()} 
                                                className="w-full bg-blue-600 hover:bg-blue-700"
                                            >
                                                {telegramSaving ? (
                                                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Conectando...</>
                                                ) : (
                                                    'Conectar Bot'
                                                )}
                                            </Button>
                                        ) : (
                                            <Button 
                                                onClick={handleDisconnectTelegram} 
                                                disabled={telegramSaving} 
                                                variant="destructive" 
                                                className="w-full"
                                            >
                                                {telegramSaving ? 'Desconectando...' : 'Desconectar Bot'}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 border rounded-xl p-6 bg-transparent border-white/5 opacity-60">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-slate-200 rounded-lg">
                                            <Smartphone className="h-5 w-5 text-slate-300" />
                                        </div>
                                        <h3 className="font-bold text-white">Telegram Personal</h3>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Usa tu propia cuenta como bot. Requiere API ID y API Hash.
                                    </p>
                                    <Badge variant="outline" className="bg-white/10">Próximamente en panel web</Badge>
                                    <p className="text-xs text-slate-500">
                                        Esta función ya es estable en el backend pero requiere configuración asistida.
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-900">¿Cómo conectar Telegram?</p>
                                    <p className="text-xs text-amber-800 mt-1">
                                        Para usar Telegram Bot, busca a <strong>@BotFather</strong> en Telegram, usa /newbot y sigue las instrucciones. 
                                        Copia el API Token resultante y pégalo arriba.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Business Hours */}
                <TabsContent value="hours" className="space-y-6">
                    <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Horarios de Atención
                            </CardTitle>
                            <CardDescription>
                                Define tus horarios de atención para tus clientes
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {Object.entries(contactForm.businessHours).map(([day, hours]) => (
                                <div key={day} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <Switch
                                            checked={!hours.closed}
                                            onCheckedChange={(checked) => updateBusinessHours(day, 'closed', !checked)}
                                        />
                                        <div className="w-20">
                                            <p className="font-medium capitalize">{day}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="time"
                                            value={hours.open}
                                            onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                                            disabled={hours.closed}
                                            className="w-24"
                                        />
                                        <span>a</span>
                                        <Input
                                            type="time"
                                            value={hours.close}
                                            onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                                            disabled={hours.closed}
                                            className="w-24"
                                        />
                                    </div>
                                </div>
                            ))}

                            <Separator />

                            <div className="flex justify-end">
                                <Button onClick={handleSaveContactSettings} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Guardar Horarios
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Preferences */}
                <TabsContent value="preferences" className="space-y-6">
                    <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <SettingsIcon className="h-5 w-5" />
                                Preferencias del Negocio
                            </CardTitle>
                            <CardDescription>
                                Configura las preferencias generales de tu negocio
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="language">Idioma</Label>
                                    <Select value={preferencesForm.language} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, language: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LANGUAGE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="currency">Moneda</Label>
                                    <Select value={preferencesForm.currency} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, currency: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CURRENCY_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Notificaciones</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium">Notificaciones por Email</span>
                                            <p className="text-xs text-slate-500">Recibir alertas y actualizaciones por correo</p>
                                        </div>
                                        <Switch
                                            checked={preferencesForm.notifications.emailNotifications}
                                            onCheckedChange={(checked) => setPreferencesForm(prev => ({
                                                ...prev,
                                                notifications: { ...prev.notifications, emailNotifications: checked }
                                            }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium">Notificaciones SMS</span>
                                            <p className="text-xs text-slate-500">Alertas importantes por mensaje de texto</p>
                                        </div>
                                        <Switch
                                            checked={preferencesForm.notifications.smsNotifications}
                                            onCheckedChange={(checked) => setPreferencesForm(prev => ({
                                                ...prev,
                                                notifications: { ...prev.notifications, smsNotifications: checked }
                                            }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-medium">Notificaciones Push</span>
                                            <p className="text-xs text-slate-500">Notificaciones en tiempo real</p>
                                        </div>
                                        <Switch
                                            checked={preferencesForm.notifications.pushNotifications}
                                            onCheckedChange={(checked) => setPreferencesForm(prev => ({
                                                ...prev,
                                                notifications: { ...prev.notifications, pushNotifications: checked }
                                            }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex justify-end">
                                <Button onClick={handleSavePreferences} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Guardar Preferencias
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* AI Advanced Settings */}
                <TabsContent value="ai-advanced" className="space-y-6">
                    <Card className="border-purple-200 bg-purple-50/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-purple-900">
                                <Zap className="h-5 w-5 text-purple-600" />
                                Módulos de Inteligencia Premium
                            </CardTitle>
                            <CardDescription className="text-purple-700">
                                Potencia tu negocio con algoritmos de venta proactiva y detección de emociones.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Upselling */}
                                <div className={`p-4 rounded-xl border-2 transition-all ${
                                    selectedBusiness?.allowedFeatures?.includes('UPSELLING') 
                                    ? 'border-emerald-200 bg-white' 
                                    : 'border-white/5 bg-white/5 opacity-60'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-emerald-100 rounded-lg">
                                                <Zap className="h-4 w-4 text-emerald-600" />
                                            </div>
                                            <h4 className="font-bold text-white">Venta Proactiva (Upselling)</h4>
                                        </div>
                                        <Switch
                                            checked={whatsappForm.upsellingEnabled}
                                            onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, upsellingEnabled: checked }))}
                                            disabled={!selectedBusiness?.allowedFeatures?.includes('UPSELLING')}
                                        />
                                    </div>
                                    <p className="text-sm text-slate-300 mb-4">
                                        El bot detectará momentos de felicidad e intención de compra para sugerir productos o servicios adicionales según tu rubro ({selectedBusiness?.industryType}).
                                    </p>
                                    {!selectedBusiness?.allowedFeatures?.includes('UPSELLING') && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                            Requiere Plan Premium
                                        </Badge>
                                    )}
                                </div>

                                {/* Sentiment Analysis */}
                                <div className={`p-4 rounded-xl border-2 transition-all ${
                                    selectedBusiness?.allowedFeatures?.includes('SENTIMENT') 
                                    ? 'border-blue-200 bg-white' 
                                    : 'border-white/5 bg-white/5 opacity-60'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-blue-100 rounded-lg">
                                                <Brain className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <h4 className="font-bold text-white">Análisis de Sentimiento</h4>
                                        </div>
                                        <Switch
                                            checked={whatsappForm.sentimentAnalysisEnabled}
                                            onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, sentimentAnalysisEnabled: checked }))}
                                            disabled={!selectedBusiness?.allowedFeatures?.includes('SENTIMENT')}
                                        />
                                    </div>
                                    <p className="text-sm text-slate-300 mb-4">
                                        Identifica automáticamente clientes frustrados o urgentes y activa alertas de intervención humana inmediata.
                                    </p>
                                    {!selectedBusiness?.allowedFeatures?.includes('SENTIMENT') && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                            Módulo Bloqueado
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-3">
                                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-blue-900">¿Cómo funcionan estos módulos?</p>
                                    <p className="text-xs text-blue-800 mt-1">
                                        Estas funciones utilizan modelos de IA avanzados para analizar el contexto emocional y comercial de cada mensaje. 
                                        Si no tienes acceso, contacta con soporte para actualizar tu plan de rubro <strong>{selectedBusiness?.industryType}</strong>.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleSaveWhatsAppSettings} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                                    {saving ? 'Guardando...' : 'Guardar Configuración IA'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    )
}
