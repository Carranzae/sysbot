'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'react-qr-code'
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
    Bot,
    Instagram,
    Plus
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useBusinessStore } from '@/store/business'
import { motion, AnimatePresence } from 'framer-motion'

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
    const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'security' | 'billing' | 'apikeys' | 'team'>('general')
    
    // helper to save AI parameters
    const handleSaveAiSettings = async () => {
        if (!businessId) return
        try {
            setSaving(true)
            await businessApi.updateBotConfig(businessId, {
                aiProvider: aiForm.aiProvider,
                aiApiKey: aiForm.aiApiKey,
                aiModel: aiForm.aiModel,
                aiBaseUrl: aiForm.aiBaseUrl,
                temperature: Number(aiForm.temperature),
                maxTokens: Number(aiForm.maxTokens),
            })
            toast({
                title: 'Configuración de IA guardada',
                description: 'Las credenciales y parámetros de IA se han guardado correctamente.',
            })
        } catch (error: any) {
            console.error('Error saving AI settings:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'No se pudo guardar la configuración de IA',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

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

    useEffect(() => {
        const tab = searchParams?.get('tab')
        if (tab === 'billing') {
            setActiveTab('billing')
        } else if (tab === 'integrations') {
            setActiveTab('integrations')
        }
    }, [searchParams])

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
        <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 bg-slate-50/30 rounded-3xl min-h-screen text-slate-700 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 font-syst">Configuración de Canales y Ajustes</h1>
                    <p className="text-slate-500 text-xs mt-1 font-medium">Personaliza los accesos, pasarelas de pago, integraciones omnicanal y agentes de IA.</p>
                </div>
                <Button onClick={loadSettings} variant="outline" size="sm" className="border-slate-200 hover:border-blue-600 text-slate-600 h-9 rounded-xl text-xs font-bold bg-white">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar Estado
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                
                {/* Left Sub-Sidebar Menu */}
                <div className="w-full lg:w-64 shrink-0 bg-white border border-slate-200/60 rounded-3xl p-5 space-y-1.5 shadow-xs flex flex-col h-fit">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all duration-200 text-left ${
                            activeTab === 'general'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <SettingsIcon className="w-4 h-4" />
                        General y Horarios
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('integrations')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all duration-200 text-left ${
                            activeTab === 'integrations'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <Zap className="w-4 h-4" />
                        Integraciones (Canales)
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all duration-200 text-left ${
                            activeTab === 'security'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <Shield className="w-4 h-4" />
                        Seguridad y Modelos IA
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all duration-200 text-left ${
                            activeTab === 'billing'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <CreditCard className="w-4 h-4" />
                        Facturación y Pagos
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('apikeys')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all duration-200 text-left ${
                            activeTab === 'apikeys'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <Key className="w-4 h-4" />
                        API Keys
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all duration-200 text-left ${
                            activeTab === 'team'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        Equipo y Permisos
                    </button>
                </div>

                {/* Right Content Panel */}
                <div className="flex-1 min-w-0">
                    <AnimatePresence mode="wait">
                        
                        {activeTab === 'general' && (
                            <motion.div
                                key="general-pane"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                {/* Contact Settings */}
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <Mail className="h-5 w-5 text-blue-600" />
                                            Configuración de Contacto
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Define cómo tus clientes pueden contactar al equipo de soporte de tu negocio.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="support-email" className="text-xs font-bold text-slate-500">Correo de Soporte</Label>
                                                <Input
                                                    id="support-email"
                                                    type="email"
                                                    placeholder="soporte@tunegocio.com"
                                                    value={contactForm.supportEmail}
                                                    onChange={(e) => setContactForm(prev => ({ ...prev, supportEmail: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="support-phone" className="text-xs font-bold text-slate-500">Teléfono de Soporte</Label>
                                                <Input
                                                    id="support-phone"
                                                    placeholder="+56912345678"
                                                    value={contactForm.supportPhone}
                                                    onChange={(e) => setContactForm(prev => ({ ...prev, supportPhone: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="timezone" className="text-xs font-bold text-slate-500">Zona Horaria</Label>
                                                <Select value={contactForm.timezone} onValueChange={(value) => setContactForm(prev => ({ ...prev, timezone: value }))}>
                                                    <SelectTrigger className="bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-blue-600 font-semibold">
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

                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleSaveContactSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-750 text-white font-extrabold text-xs h-10 rounded-xl px-5 shadow-2xs">
                                                {saving ? (
                                                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                                                ) : (
                                                    <><Save className="mr-2 h-4 w-4" />Guardar Ajustes de Contacto</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                {/* Preferences Settings */}
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <SettingsIcon className="h-5 w-5 text-blue-600" />
                                            Preferencias del Negocio
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Configura el idioma de atención de tu bot y el tipo de moneda para cotizaciones automáticas.</p>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="language" className="text-xs font-bold text-slate-500">Idioma</Label>
                                                <Select value={preferencesForm.language} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, language: value }))}>
                                                    <SelectTrigger className="bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-blue-600 font-semibold">
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

                                            <div className="space-y-1.5">
                                                <Label htmlFor="currency" className="text-xs font-bold text-slate-500">Moneda</Label>
                                                <Select value={preferencesForm.currency} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, currency: value }))}>
                                                    <SelectTrigger className="bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-blue-600 font-semibold">
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

                                        <Separator className="bg-slate-100" />

                                        <div className="space-y-4">
                                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-syst">Ajustes de Notificaciones</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-700">Notificaciones por Email</span>
                                                        <p className="text-[10px] text-slate-400">Recibir alertas de citas agendadas por correo</p>
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
                                                        <span className="text-xs font-bold text-slate-700">Notificaciones SMS</span>
                                                        <p className="text-[10px] text-slate-400">Mensajes de texto con resúmenes del CRM</p>
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
                                                        <span className="text-xs font-bold text-slate-700">Notificaciones Push</span>
                                                        <p className="text-[10px] text-slate-400">Alertas emergentes al recibir mensajes</p>
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

                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleSavePreferences} disabled={saving} className="bg-blue-600 hover:bg-blue-750 text-white font-extrabold text-xs h-10 rounded-xl px-5 shadow-2xs">
                                                {saving ? (
                                                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                                                ) : (
                                                    <><Save className="mr-2 h-4 w-4" />Guardar Preferencias</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                {/* Business Hours */}
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-blue-600" />
                                            Horarios de Atención
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Define el horario laboral de tu negocio. Fuera de estas horas, el bot puede enviar mensajes de ausencia programados.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            {Object.entries(contactForm.businessHours).map(([day, hours]) => (
                                                <div key={day} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <Switch
                                                            checked={!hours.closed}
                                                            onCheckedChange={(checked) => updateBusinessHours(day, 'closed', !checked)}
                                                        />
                                                        <div className="w-20">
                                                            <p className="text-xs font-bold text-slate-700 capitalize font-syst">{day}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2.5">
                                                        <Input
                                                            type="time"
                                                            value={hours.open}
                                                            onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                                                            disabled={hours.closed}
                                                            className="w-24 text-xs h-8 rounded-lg bg-white"
                                                        />
                                                        <span className="text-[10px] font-bold text-slate-400">a</span>
                                                        <Input
                                                            type="time"
                                                            value={hours.close}
                                                            onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                                                            disabled={hours.closed}
                                                            className="w-24 text-xs h-8 rounded-lg bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Separator className="bg-slate-100" />

                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleSaveContactSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-750 text-white font-extrabold text-xs h-10 rounded-xl px-5 shadow-2xs">
                                                {saving ? (
                                                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                                                ) : (
                                                    <><Save className="mr-2 h-4 w-4" />Guardar Horarios</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {activeTab === 'integrations' && (
                            <motion.div
                                key="integrations-pane"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                {/* Connected Channels Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    
                                    {/* WhatsApp Business API */}
                                    <Card className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-2.5 bg-green-50 text-green-600 rounded-xl border border-green-100">
                                                    <MessageCircle className="w-5 h-5" />
                                                </div>
                                                <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black uppercase px-2 py-0.5 rounded">Desconectado</Badge>
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-syst">WhatsApp Business API</h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Conexión Oficial Cloud API</p>
                                            <p className="text-xs text-slate-500 mt-3.5 leading-relaxed font-medium">Conexión robusta para envíos ilimitados de plantillas interactivas aprobadas por Meta.</p>
                                        </div>
                                        <Button 
                                            onClick={() => {
                                                toast({
                                                    title: 'WhatsApp Business API',
                                                    description: 'Esta función requiere verificación de Meta Business Manager en producción.',
                                                })
                                            }}
                                            className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                        >
                                            Configurar API
                                        </Button>
                                    </Card>

                                    {/* WhatsApp Web (QR session) */}
                                    <Card className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                                    <QrCode className="w-5 h-5" />
                                                </div>
                                                {whatsappForm.webConnection.connected ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase px-2 py-0.5 rounded">Conectado</Badge>
                                                ) : (
                                                    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black uppercase px-2 py-0.5 rounded">Desconectado</Badge>
                                                )}
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-syst">WhatsApp Web QR</h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Sesión Web Emulada por QR</p>
                                            <p className="text-xs text-slate-500 mt-3.5 leading-relaxed font-medium">Vincula tu celular en segundos escaneando un código QR. Ideal para pruebas rápidas.</p>
                                        </div>

                                        <div className="space-y-3 mt-6">
                                            {whatsappForm.webConnection.connected ? (
                                                <>
                                                    <p className="text-[10px] text-emerald-600 font-bold text-center">✓ Activo como {whatsappForm.webConnection.phoneNumber}</p>
                                                    <Button 
                                                        onClick={handleDisconnectWhatsApp} 
                                                        variant="destructive"
                                                        className="w-full text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                                    >
                                                        Desconectar Celular
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    {whatsappForm.webConnection.qrCodeData ? (
                                                        <div className="space-y-3">
                                                            <div className="flex justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                                {whatsappForm.webConnection.qrCodeData.startsWith('data:') ? (
                                                                    <img src={whatsappForm.webConnection.qrCodeData} alt="QR Code" className="max-w-[140px]" />
                                                                ) : (
                                                                    <QRCode value={whatsappForm.webConnection.qrCodeData} size={130} />
                                                                )}
                                                            </div>
                                                            <p className="text-[9px] text-slate-450 text-center font-bold uppercase">Escanea con la cámara de WhatsApp</p>
                                                            <Button 
                                                                onClick={handleDisconnectWhatsApp} 
                                                                variant="outline"
                                                                className="w-full border-slate-200 text-slate-650 font-extrabold text-xs h-10 rounded-xl shadow-2xs bg-white hover:bg-slate-50"
                                                            >
                                                                Cancelar QR
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button 
                                                            onClick={handleConnectWhatsApp} 
                                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                                        >
                                                            Conectar con QR
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Instagram Messaging */}
                                    <Card className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-2.5 bg-pink-50 text-pink-600 rounded-xl border border-pink-100">
                                                    <Instagram className="w-5 h-5" />
                                                </div>
                                                <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black uppercase px-2 py-0.5 rounded">Desconectado</Badge>
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-syst">Instagram Messaging</h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Conexión OAuth de Instagram</p>
                                            <p className="text-xs text-slate-500 mt-3.5 leading-relaxed font-medium">Vincula tu cuenta empresarial de Instagram. Responde DMs y comentarios automáticamente.</p>
                                        </div>
                                        <Button 
                                            onClick={() => {
                                                toast({
                                                    title: 'Instagram OAuth',
                                                    description: 'Conectando con Facebook Login API...',
                                                })
                                            }}
                                            className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                        >
                                            Login con Facebook
                                        </Button>
                                    </Card>

                                    {/* Facebook Messenger */}
                                    <Card className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                                    <MessageCircle className="w-5 h-5" />
                                                </div>
                                                <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black uppercase px-2 py-0.5 rounded">Desconectado</Badge>
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-syst">Facebook Messenger</h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Conexión OAuth de Facebook Page</p>
                                            <p className="text-xs text-slate-500 mt-3.5 leading-relaxed font-medium">Conecta tu página empresarial de Facebook para atender todos tus chats de Messenger.</p>
                                        </div>
                                        <Button 
                                            onClick={() => {
                                                toast({
                                                    title: 'Messenger OAuth',
                                                    description: 'Redirigiendo a Meta Login Flow...',
                                                })
                                            }}
                                            className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                        >
                                            Conectar Página
                                        </Button>
                                    </Card>

                                    {/* Telegram Bot API */}
                                    <Card className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                                                    <Send className="w-5 h-5" />
                                                </div>
                                                {telegramConnected ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase px-2 py-0.5 rounded">Conectado</Badge>
                                                ) : (
                                                    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black uppercase px-2 py-0.5 rounded">Desconectado</Badge>
                                                )}
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-syst">Telegram Bot API</h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Token de BotFather</p>
                                            <p className="text-xs text-slate-500 mt-3.5 leading-relaxed font-medium">Atiende chats mediante un Bot Oficial de Telegram. Configura el token de acceso.</p>
                                        </div>

                                        <div className="space-y-3 mt-6">
                                            {!telegramConnected ? (
                                                <div className="space-y-3">
                                                    <Input 
                                                        type="password" 
                                                        placeholder="Token (ej. 1234567:ABC...)"
                                                        value={telegramBotToken}
                                                        onChange={(e) => setTelegramBotToken(e.target.value)}
                                                        className="text-xs h-9 rounded-xl border-slate-200"
                                                    />
                                                    <Button 
                                                        onClick={handleConnectTelegram} 
                                                        disabled={telegramSaving || !telegramBotToken.trim()} 
                                                        className="w-full bg-blue-600 hover:bg-blue-750 text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                                    >
                                                        Conectar Telegram
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button 
                                                    onClick={handleDisconnectTelegram} 
                                                    disabled={telegramSaving} 
                                                    variant="destructive"
                                                    className="w-full text-white font-extrabold text-xs h-10 rounded-xl shadow-2xs"
                                                >
                                                    Desconectar Telegram Bot
                                                </Button>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Proximamente Placeholder */}
                                    <Card className="bg-slate-55 border border-dashed border-slate-200 rounded-3xl p-5 flex flex-col items-center justify-center text-center min-h-[220px]">
                                        <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mt-3 font-syst">Próximos Canales</h4>
                                        <p className="text-[11px] text-slate-400 mt-1 max-w-[160px] font-medium leading-normal">Discord, Slack y Web Chat en desarrollo activo.</p>
                                    </Card>

                                </div>

                                {/* Resumen de Actividad Footer Card */}
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                            <Zap className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-syst">Resumen de Actividad de Canales</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Estado general de tus integraciones</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3.5 text-xs text-slate-650 font-semibold font-mono flex-wrap">
                                        <span>Canales Activos: <strong className="text-slate-800 font-extrabold">{[whatsappForm.webConnection.connected, telegramConnected].filter(Boolean).length} / 5</strong></span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                        <span>Tráfico en Vivo: <strong className="text-emerald-600 font-extrabold">12 m/min</strong></span>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {activeTab === 'security' && (
                            <motion.div
                                key="security-pane"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                {/* Premium AI Features */}
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <Zap className="h-5 w-5 text-purple-650" />
                                            Módulos de Inteligencia Premium
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Potencia tu negocio con algoritmos avanzados de venta proactiva y detección de emociones.</p>
                                    </div>
                                    
                                    <div className="grid gap-6 md:grid-cols-2">
                                        {/* Upselling */}
                                        <div className={`p-5 rounded-2xl border transition-all ${
                                            selectedBusiness?.allowedFeatures?.includes('UPSELLING') 
                                            ? 'border-emerald-250 bg-emerald-50/10' 
                                            : 'border-slate-100 bg-slate-50 opacity-60'
                                        }`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                                        <Zap className="h-4 w-4" />
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 text-xs">Venta Proactiva (Upselling)</h4>
                                                </div>
                                                <Switch
                                                    checked={whatsappForm.upsellingEnabled}
                                                    onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, upsellingEnabled: checked }))}
                                                    disabled={!selectedBusiness?.allowedFeatures?.includes('UPSELLING')}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">El bot detectará intenciones de compra secundarias y recomendará productos o servicios extras automáticos.</p>
                                            {!selectedBusiness?.allowedFeatures?.includes('UPSELLING') && (
                                                <Badge className="bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase mt-3">Plan Premium</Badge>
                                            )}
                                        </div>

                                        {/* Sentiment Analysis */}
                                        <div className={`p-5 rounded-2xl border transition-all ${
                                            selectedBusiness?.allowedFeatures?.includes('SENTIMENT') 
                                            ? 'border-blue-250 bg-blue-50/10' 
                                            : 'border-slate-100 bg-slate-50 opacity-60'
                                        }`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                        <Brain className="h-4 w-4" />
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 text-xs">Análisis de Sentimiento</h4>
                                                </div>
                                                <Switch
                                                    checked={whatsappForm.sentimentAnalysisEnabled}
                                                    onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, sentimentAnalysisEnabled: checked }))}
                                                    disabled={!selectedBusiness?.allowedFeatures?.includes('SENTIMENT')}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">Identifica usuarios frustrados o enfadados y genera alertas prioritarias para pausar la IA e intervenir.</p>
                                            {!selectedBusiness?.allowedFeatures?.includes('SENTIMENT') && (
                                                <Badge className="bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase mt-3">Plan Premium</Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button onClick={handleSaveWhatsAppSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-755 text-white font-extrabold text-xs h-10 rounded-xl px-5">
                                            {saving ? 'Guardando...' : 'Guardar Módulos'}
                                        </Button>
                                    </div>
                                </Card>

                                {/* AI Model Config */}
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <Brain className="h-5 w-5 text-purple-650" />
                                            Credenciales de Modelo de Inferencia (LLM)
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Vincula tus credenciales de proveedor LLM (Groq, OpenAI) para procesar las respuestas del bot.</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-slate-500">Proveedor de Inferencia</Label>
                                                <Select value={aiForm.aiProvider} onValueChange={(val) => setAiForm(prev => ({ ...prev, aiProvider: val }))}>
                                                    <SelectTrigger className="bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-blue-600 font-semibold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="GROQ">Groq Cloud (Recomendado)</SelectItem>
                                                        <SelectItem value="OPENAI">OpenAI API</SelectItem>
                                                        <SelectItem value="CLAUDE">Anthropic Claude</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-slate-500 font-mono">Model ID</Label>
                                                <Input
                                                    value={aiForm.aiModel}
                                                    onChange={(e) => setAiForm(prev => ({ ...prev, aiModel: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-slate-500">Base URL de la API</Label>
                                                <Input
                                                    value={aiForm.aiBaseUrl}
                                                    onChange={(e) => setAiForm(prev => ({ ...prev, aiBaseUrl: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-slate-500">API Key Secreta</Label>
                                                <Input
                                                    type="password"
                                                    value={aiForm.aiApiKey}
                                                    onChange={(e) => setAiForm(prev => ({ ...prev, aiApiKey: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleSaveAiSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-755 text-white font-extrabold text-xs h-10 rounded-xl px-5">
                                                {saving ? 'Guardando...' : 'Guardar Credenciales de IA'}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {activeTab === 'billing' && (
                            <motion.div
                                key="billing-pane"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <CreditCard className="h-5 w-5 text-blue-600" />
                                            Pasarela de Pagos del CRM
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Configura las credenciales de Stripe/MercadoPago para recibir cobros directamente vinculados a tus chats y presupuestos.</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="payment-email" className="text-xs font-bold text-slate-500">Correo para Cobros</Label>
                                                <Input
                                                    id="payment-email"
                                                    type="email"
                                                    placeholder="pagos@tunegocio.com"
                                                    value={paymentForm.email}
                                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, email: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="payment-gateway" className="text-xs font-bold text-slate-500">Pasarela</Label>
                                                <Select value={paymentForm.gateway} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, gateway: value }))}>
                                                    <SelectTrigger className="bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-blue-600 font-semibold">
                                                        <SelectValue placeholder="Selecciona pasarela" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="stripe">Stripe (Oficial)</SelectItem>
                                                        <SelectItem value="paypal">PayPal</SelectItem>
                                                        <SelectItem value="mercadopago">MercadoPago</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="whatsapp-number" className="text-xs font-bold text-slate-500">Celular de Control de Pagos</Label>
                                                <Input
                                                    id="whatsapp-number"
                                                    placeholder="+51999888777"
                                                    value={paymentForm.whatsappNumber}
                                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="webhook-url" className="text-xs font-bold text-slate-500">Webhook URL</Label>
                                                <Input
                                                    id="webhook-url"
                                                    placeholder="https://tuapi.com/payments"
                                                    value={paymentForm.webhookUrl}
                                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                                                    className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-blue-600 font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleSavePaymentSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-755 text-white font-extrabold text-xs h-10 rounded-xl px-5">
                                                {saving ? 'Guardando...' : 'Guardar Pasarela'}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {activeTab === 'apikeys' && (
                            <motion.div
                                key="apikeys-pane"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div>
                                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                            <Key className="h-5 w-5 text-blue-600" />
                                            API Keys de Acceso
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Genera y administra tokens seguros para conectar tus propios endpoints y desarrollos externos.</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 font-mono">sb_live_048f3eaabf6b46a39c9c8230e3d29297</p>
                                                <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider mt-1">Creado: Hace 3 días • Permisos: Full Access</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText("sb_live_048f3eaabf6b46a39c9c8230e3d29297");
                                                    toast({ title: "Copiado", description: "API Key copiada al portapapeles" });
                                                }}
                                                className="border-slate-200 text-slate-655 hover:text-blue-600 rounded-xl bg-white hover:bg-slate-50"
                                            >
                                                Copiar Key
                                            </Button>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                toast({
                                                    title: "Nueva API Key",
                                                    description: "Función premium habilitada. La key se ha registrado en tu consola.",
                                                });
                                            }}
                                            className="bg-blue-600 hover:bg-blue-750 text-white font-extrabold text-xs h-10 rounded-xl"
                                        >
                                            <Plus className="w-4 h-4 mr-1.5" />
                                            Generar Nueva Key
                                        </Button>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {activeTab === 'team' && (
                            <motion.div
                                key="team-pane"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <Card className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
                                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                                        <div>
                                            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850 font-syst flex items-center gap-2">
                                                <Users className="h-5 w-5 text-blue-600" />
                                                Equipo y Colaboradores
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">Administra los accesos de tus agentes, médicos y administradores.</p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                toast({
                                                    title: "Invitar Miembro",
                                                    description: "Abre el panel de invitaciones del equipo.",
                                                });
                                            }}
                                            className="bg-blue-600 hover:bg-blue-750 text-white font-extrabold text-xs h-10 rounded-xl"
                                        >
                                            <Plus className="w-4 h-4 mr-1.5" />
                                            Invitar Miembro
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">PP</div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Pedro Pérez</p>
                                                    <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">pedro@tunegocio.com</p>
                                                </div>
                                            </div>
                                            <Badge className="bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-black uppercase">Owner</Badge>
                                        </div>

                                        <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-750 flex items-center justify-center font-bold text-xs">MR</div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">María Rojas</p>
                                                    <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">maria@tunegocio.com</p>
                                                </div>
                                            </div>
                                            <Badge className="bg-violet-50 text-violet-600 border border-violet-100 text-[8px] font-black uppercase">Administrador</Badge>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

            </div>

        </div>
    )
}
