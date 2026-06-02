'use client'

import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Brain,
    Zap,
    Shield,
    AlertTriangle,
    Play,
    Settings,
    BarChart3,
    RefreshCw,
    CheckCircle,
    XCircle,
    Loader2,
    DollarSign,
    Activity,
    Cpu,
    Database,
    Users,
    Globe,
    CreditCard
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AIEnginePage() {
    const { toast } = useToast()
    const [providers, setProviders] = useState<any[]>([])
    const [usageStats, setUsageStats] = useState<any>(null)
    const [circuitBreakers, setCircuitBreakers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Testing states
    const [testQuery, setTestQuery] = useState('')
    const [selectedProvider, setSelectedProvider] = useState('')
    const [selectedModel, setSelectedModel] = useState('')
    const [testResult, setTestResult] = useState<any>(null)
    const [testing, setTesting] = useState(false)

    // RAG Testing states
    const [ragQuery, setRagQuery] = useState('')
    const [selectedBusiness, setSelectedBusiness] = useState('')
    const [ragResult, setRagResult] = useState<any>(null)
    const [ragTesting, setRagTesting] = useState(false)
    const [businesses, setBusinesses] = useState<any[]>([])

    const loadData = async () => {
        try {
            setLoading(true)
            const [providersData, statsData, breakersData, businessesData] = await Promise.all([
                adminApi.getAllConfigs(),
                adminApi.getAIUsageStats(30), // Últimos 30 días
                adminApi.getSystemHealth(),
                adminApi.getUsers() // Obtener usuarios con negocios
            ])

            // Filter AI-related configs
            const aiConfigs = providersData.filter((config: any) =>
                config.key.includes('OPENAI') ||
                config.key.includes('ANTHROPIC') ||
                config.key.includes('GROQ') ||
                config.key.includes('GOOGLE') ||
                config.key.includes('SYSTEM')
            )

            // Extraer negocios de los usuarios
            const allBusinesses = businessesData.data?.flatMap((user: any) => 
                user.businesses?.map((business: any) => ({
                    id: business.id,
                    name: business.name,
                    industryType: business.industryType,
                    ownerEmail: user.email,
                    botConfig: business.botConfig,
                    _count: business._count || { files: 0 }
                })) || []
            ) || []

            setProviders(aiConfigs)
            setUsageStats(statsData)
            setCircuitBreakers(breakersData?.circuitBreakers || [])
            setBusinesses(allBusinesses)
        } catch (error) {
            console.error('Failed to load AI engine data', error)
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los datos del motor de IA',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleTestAI = async () => {
        if (!testQuery.trim() || !selectedProvider) {
            toast({
                title: 'Error',
                description: 'Por favor completa todos los campos',
                variant: 'destructive'
            })
            return
        }

        try {
            setTesting(true)
            setTestResult(null)

            const result = await adminApi.generateTestResponse({
                businessId: 'system-test', // Special ID for system testing
                message: testQuery,
                provider: selectedProvider,
                model: selectedModel
            })

            setTestResult(result)
            toast({
                title: 'Prueba completada',
                description: 'La consulta de IA se ejecutó exitosamente'
            })
        } catch (error: any) {
            setTestResult({
                error: true,
                message: error.response?.data?.message || error.message
            })
            toast({
                title: 'Error en la prueba',
                description: 'La consulta de IA falló',
                variant: 'destructive'
            })
        } finally {
            setTesting(false)
        }
    }

    const handleTestRAG = async () => {
        if (!ragQuery.trim() || !selectedBusiness) {
            toast({
                title: 'Error',
                description: 'Por favor selecciona un negocio y escribe una consulta',
                variant: 'destructive'
            })
            return
        }

        try {
            setRagTesting(true)
            setRagResult(null)

            const result = await adminApi.executeRAG({
                businessId: selectedBusiness,
                query: ragQuery,
                maxChunks: 5,
                includeMetadata: true
            })

            setRagResult(result)
            toast({
                title: 'Consulta RAG completada',
                description: 'Se encontraron resultados relevantes'
            })
        } catch (error: any) {
            setRagResult({
                error: true,
                message: error.response?.data?.message || error.message
            })
            toast({
                title: 'Error en RAG',
                description: 'La consulta RAG falló',
                variant: 'destructive'
            })
        } finally {
            setRagTesting(false)
        }
    }

    const getProviderStatus = (providerKey: string) => {
        const config = providers.find(p => p.key === providerKey)
        return config?.value ? 'configured' : 'not_configured'
    }

    const getCircuitBreakerStatus = (service: string) => {
        if (!Array.isArray(circuitBreakers)) return 'UNKNOWN'
        const breaker = circuitBreakers.find(cb => cb.service === service)
        return breaker?.state || 'UNKNOWN'
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Motor de IA - Super Admin
                    </h1>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader className="pb-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-full"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Centro de Control Global
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Control total del sistema de IA y facturación de la plataforma
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={loadData} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Security Warning */}
            <Alert className="border-red-200 bg-red-50">
                <Shield className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Acceso Restringido</AlertTitle>
                <AlertDescription className="text-red-700">
                    Esta sección contiene funcionalidades críticas del sistema de IA.
                    Solo Super Administradores tienen acceso. Todas las acciones son auditadas.
                </AlertDescription>
            </Alert>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Proveedores Activos</CardTitle>
                        <Brain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {providers.filter(p => p.value).length}/{providers.length}
                        </div>
                        <p className="text-xs text-muted-foreground">Configurados correctamente</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tokens Consumidos</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{usageStats?.totalTokens?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Últimos 7 días</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            ${usageStats?.totalCost?.toFixed(2) || '0.00'}
                        </div>
                        <p className="text-xs text-muted-foreground">En APIs de IA</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {Array.isArray(circuitBreakers) 
                                ? circuitBreakers.filter(cb => cb.state === 'CLOSED').length 
                                : 0}/
                            {Array.isArray(circuitBreakers) ? circuitBreakers.length : 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Abiertos/Total</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="providers" className="space-y-6">
                <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="providers">IA & Vault</TabsTrigger>
                    <TabsTrigger value="billing">Facturación</TabsTrigger>
                    <TabsTrigger value="automation">Automación</TabsTrigger>
                    <TabsTrigger value="testing">Testing IA</TabsTrigger>
                    <TabsTrigger value="rag">Testing RAG</TabsTrigger>
                    <TabsTrigger value="inventory">Negocios</TabsTrigger>
                    <TabsTrigger value="monitoring">Monitoreo</TabsTrigger>
                </TabsList>

                {/* Providers Management */}
                <TabsContent value="providers" className="space-y-6">
                    {/* Global Configuration Card */}
                    <Card className="border-blue-200 bg-blue-50/30">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-blue-600" />
                                <CardTitle>Configuración Global del Sistema (Bóveda)</CardTitle>
                            </div>
                            <CardDescription className="text-blue-700">
                                Estas llaves se usarán automáticamente para todos los clientes que no tengan una propia.
                                Recomendado: Usa <strong>Groq</strong> para chat y <strong>Gemini</strong> para archivos/RAG para costo $0.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Motor Global por Defecto</label>
                                    <Select 
                                        value={providers.find(p => p.key === 'SYSTEM_DEFAULT_AI_PROVIDER')?.value || 'GROQ'} 
                                        onValueChange={(val) => adminApi.upsertConfig({ key: 'SYSTEM_DEFAULT_AI_PROVIDER', value: val }).then(() => loadData())}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Selecciona motor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GROQ">Groq (Recomendado Gratis)</SelectItem>
                                            <SelectItem value="GEMINI">Google Gemini (Gratis)</SelectItem>
                                            <SelectItem value="OPENAI">OpenAI (Pago)</SelectItem>
                                            <SelectItem value="OLLAMA">Ollama (Local $0)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-green-700">Llave Maestra GROQ</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="password"
                                            placeholder="gsk_..." 
                                            className="bg-white"
                                            defaultValue={providers.find(p => p.key === 'SYSTEM_GROQ_API_KEY')?.value || ''}
                                            onBlur={(e) => {
                                                if (e.target.value) {
                                                    adminApi.upsertConfig({ key: 'SYSTEM_GROQ_API_KEY', value: e.target.value, description: 'Master Groq Key' })
                                                        .then(() => toast({ title: 'Groq Key Guardada' }))
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-orange-700">Llave Maestra GEMINI</label>
                                    <Input 
                                        type="password"
                                        placeholder="AIza..." 
                                        className="bg-white"
                                        defaultValue={providers.find(p => p.key === 'SYSTEM_GEMINI_API_KEY')?.value || ''}
                                        onBlur={(e) => {
                                            if (e.target.value) {
                                                adminApi.upsertConfig({ key: 'SYSTEM_GEMINI_API_KEY', value: e.target.value, description: 'Master Gemini Key' })
                                                    .then(() => toast({ title: 'Gemini Key Guardada' }))
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Estado de Proveedores Individuales</CardTitle>
                            <CardDescription>
                                Detalle técnico de cada motor de inteligencia artificial conectado.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4">
                                {/* OpenAI */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            getProviderStatus('SYSTEM_OPENAI_API_KEY') === 'configured' || getProviderStatus('OPENAI_API_KEY') === 'configured'
                                                ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        <div>
                                            <h4 className="font-semibold">OpenAI</h4>
                                            <p className="text-sm text-gray-600">GPT-4, GPT-3.5, Embeddings</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getCircuitBreakerStatus('openai') === 'CLOSED' ? 'default' : 'destructive'}>
                                            {getCircuitBreakerStatus('openai')}
                                        </Badge>
                                        <Button variant="outline" size="sm">
                                            Logs
                                        </Button>
                                    </div>
                                </div>

                                {/* Anthropic */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            getProviderStatus('ANTHROPIC_API_KEY') === 'configured'
                                                ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        <div>
                                            <h4 className="font-semibold">Anthropic</h4>
                                            <p className="text-sm text-gray-600">Claude 3, Claude 2</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getCircuitBreakerStatus('anthropic') === 'CLOSED' ? 'default' : 'destructive'}>
                                            {getCircuitBreakerStatus('anthropic')}
                                        </Badge>
                                        <Button variant="outline" size="sm">
                                            Configurar
                                        </Button>
                                    </div>
                                </div>

                                {/* Groq */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            getProviderStatus('GROQ_API_KEY') === 'configured'
                                                ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        <div>
                                            <h4 className="font-semibold">Groq</h4>
                                            <p className="text-sm text-gray-600">Llama, Mixtral (Ultra rápido)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getCircuitBreakerStatus('groq') === 'CLOSED' ? 'default' : 'destructive'}>
                                            {getCircuitBreakerStatus('groq')}
                                        </Badge>
                                        <Button variant="outline" size="sm">
                                            Configurar
                                        </Button>
                                    </div>
                                </div>

                                {/* Google AI */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            getProviderStatus('GOOGLE_AI_API_KEY') === 'configured'
                                                ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        <div>
                                            <h4 className="font-semibold">Google AI</h4>
                                            <p className="text-sm text-gray-600">Gemini, LaMDA</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getCircuitBreakerStatus('google-ai') === 'CLOSED' ? 'default' : 'destructive'}>
                                            {getCircuitBreakerStatus('google-ai')}
                                        </Badge>
                                        <Button variant="outline" size="sm">
                                            Configurar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                {/* Billing Management */}
                <TabsContent value="billing" className="space-y-6">
                    <Card className="border-indigo-200 bg-indigo-50/30">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-indigo-600" />
                                <CardTitle>Pasarela de Pagos de la Plataforma (Recaudación)</CardTitle>
                            </div>
                            <CardDescription className="text-indigo-700">
                                Configura la cuenta donde recibirás los pagos de las suscripciones de tus clientes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Pasarela Activa para Suscripciones</label>
                                    <Select 
                                        value={providers.find(p => p.key === 'SYSTEM_SUBSCRIPTION_GATEWAY')?.value || 'IZIPAY'} 
                                        onValueChange={(val) => adminApi.upsertConfig({ key: 'SYSTEM_SUBSCRIPTION_GATEWAY', value: val }).then(() => loadData())}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Selecciona pasarela" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="IZIPAY">IziPay (Recomendado Perú)</SelectItem>
                                            <SelectItem value="STRIPE">Stripe (Internacional)</SelectItem>
                                            <SelectItem value="MANUAL">Manual / Transferencia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-indigo-100">
                                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                    <Zap className="h-4 w-4" /> Configuración IziPay (SaaS Owner)
                                </h4>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Merchant ID</label>
                                        <Input 
                                            placeholder="Ej: 12345678"
                                            className="bg-white"
                                            defaultValue={providers.find(p => p.key === 'SYSTEM_IZIPAY_MERCHANT_ID')?.value || ''}
                                            onBlur={(e) => adminApi.upsertConfig({ key: 'SYSTEM_IZIPAY_MERCHANT_ID', value: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Public Key</label>
                                        <Input 
                                            placeholder="pk_..."
                                            className="bg-white"
                                            defaultValue={providers.find(p => p.key === 'SYSTEM_IZIPAY_PUBLIC_KEY')?.value || ''}
                                            onBlur={(e) => adminApi.upsertConfig({ key: 'SYSTEM_IZIPAY_PUBLIC_KEY', value: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Secret Key / Token API</label>
                                        <Input 
                                            type="password"
                                            placeholder="sk_..."
                                            className="bg-white"
                                            defaultValue={providers.find(p => p.key === 'SYSTEM_IZIPAY_API_KEY')?.value || ''}
                                            onBlur={(e) => adminApi.upsertConfig({ key: 'SYSTEM_IZIPAY_API_KEY', value: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-indigo-100">
                                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> Configuración Stripe (SaaS Owner)
                                </h4>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Stripe Secret Key</label>
                                        <Input 
                                            type="password"
                                            placeholder="sk_live_..."
                                            className="bg-white"
                                            defaultValue={providers.find(p => p.key === 'SYSTEM_STRIPE_SECRET_KEY')?.value || ''}
                                            onBlur={(e) => adminApi.upsertConfig({ key: 'SYSTEM_STRIPE_SECRET_KEY', value: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Stripe Webhook Secret</label>
                                        <Input 
                                            type="password"
                                            placeholder="whsec_..."
                                            className="bg-white"
                                            defaultValue={providers.find(p => p.key === 'SYSTEM_STRIPE_WEBHOOK_SECRET')?.value || ''}
                                            onBlur={(e) => adminApi.upsertConfig({ key: 'SYSTEM_STRIPE_WEBHOOK_SECRET', value: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-indigo-100/50 flex justify-between">
                            <p className="text-xs text-indigo-700">
                                ℹ️ Estos datos son privados y se encriptan en tránsito. Solo el Super Admin puede verlos.
                            </p>
                            <Button size="sm" variant="outline" className="bg-white" onClick={() => loadData()}>
                                Guardar Todo
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* Automation Management */}
                <TabsContent value="automation" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Secuencias Activas</CardTitle>
                                <Activity className="h-4 w-4 text-indigo-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">1,284</div>
                                <p className="text-xs text-muted-foreground">Contactos en nurturing</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Leads Extraídos</CardTitle>
                                <Users className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">5,620</div>
                                <p className="text-xs text-muted-foreground">Desde chats de WhatsApp</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Notificaciones Algorítmicas</CardTitle>
                                <Zap className="h-4 w-4 text-orange-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">428</div>
                                <p className="text-xs text-muted-foreground">Enviadas hoy automáticamente</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Alertas de Intervención</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">12</div>
                                <p className="text-xs text-muted-foreground">Clientes frustrados detectados</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-emerald-200 bg-emerald-50/20">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Cpu className="h-5 w-5 text-emerald-600" />
                                <CardTitle>Motor de Automación Inteligente (SaaS Core)</CardTitle>
                            </div>
                            <CardDescription className="text-emerald-700">
                                Controla las funciones de extracción de leads y algoritmos de retargeting para todos los negocios.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <Button 
                                    className="flex-1 h-24 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={async () => {
                                        toast({ title: "Iniciando Extracción", description: "Escaneando todos los mensajes para extraer nuevos contactos..." })
                                        try {
                                            const res = await adminApi.syncGlobalContacts()
                                            toast({ title: "Éxito", description: `Se extrajeron ${res.totalExtracted} nuevos contactos de ${res.businessesProcessed} negocios.` })
                                        } catch (e) {
                                            toast({ title: "Error", description: "No se pudo completar la extracción global.", variant: "destructive" })
                                        }
                                    }}
                                >
                                    <Users className="mr-3 h-6 w-6" />
                                    Extraer Leads de Chats (Global)
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    className="flex-1 h-24 text-lg border-orange-500 text-orange-700 hover:bg-orange-50"
                                    onClick={async () => {
                                        toast({ title: "Procesando Pulso", description: "Ejecutando algoritmos de seguimiento y notificaciones..." })
                                        try {
                                            await adminApi.processAutomationTick()
                                            toast({ title: "Algoritmo Completado", description: "Se procesaron todas las notificaciones pendientes del sistema." })
                                        } catch (e) {
                                            toast({ title: "Error", description: "Fallo en el motor de automación.", variant: "destructive" })
                                        }
                                    }}
                                >
                                    <Play className="mr-3 h-6 w-6" />
                                    Ejecutar Pulso de Algoritmo
                                </Button>
                            </div>

                            <Alert className="bg-white border-emerald-100">
                                <AlertTriangle className="h-4 w-4 text-emerald-600" />
                                <AlertTitle>Modo de Funcionamiento</AlertTitle>
                                <AlertDescription className="text-sm text-gray-600">
                                    El sistema extrae automáticamente números de teléfono desconocidos de los mensajes entrantes y los clasifica como <strong>Prospectos</strong>. 
                                    El algoritmo de pulso envía recordatorios a contactos que no han interactuado en más de 48 horas según su rubro.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* AI Testing */}
                <TabsContent value="testing" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Testing de IA - Modo Seguro</CardTitle>
                            <CardDescription>
                                Prueba consultas de IA de manera controlada. Todas las acciones son auditadas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Proveedor</label>
                                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona proveedor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="anthropic">Anthropic</SelectItem>
                                            <SelectItem value="groq">Groq</SelectItem>
                                            <SelectItem value="google">Google AI</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Modelo (opcional)</label>
                                    <Input
                                        placeholder="gpt-4, claude-3, etc."
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Consulta de Prueba</label>
                                <Textarea
                                    placeholder="Escribe tu consulta de prueba aquí..."
                                    value={testQuery}
                                    onChange={(e) => setTestQuery(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <Button
                                onClick={handleTestAI}
                                disabled={testing || !testQuery.trim() || !selectedProvider}
                                className="w-full"
                            >
                                {testing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Ejecutando prueba...
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Ejecutar Prueba de IA
                                    </>
                                )}
                            </Button>

                            {testResult && (
                                <div className="mt-6 p-4 border rounded-lg">
                                    <h4 className="font-semibold mb-2">
                                        {testResult.error ? '❌ Error' : '✅ Resultado'}
                                    </h4>
                                    <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                                        {testResult.error
                                            ? testResult.message
                                            : JSON.stringify(testResult, null, 2)
                                        }
                                    </pre>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* RAG Testing */}
                <TabsContent value="rag" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Testing del Sistema RAG</CardTitle>
                            <CardDescription>
                                Prueba consultas al sistema de Retrieval-Augmented Generation con documentos reales.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Negocio</label>
                                    <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona negocio" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {businesses.length === 0 ? (
                                                <SelectItem value="no-businesses" disabled>
                                                    No hay negocios disponibles
                                                </SelectItem>
                                            ) : (
                                                businesses.map((business) => (
                                                    <SelectItem key={business.id} value={business.id}>
                                                        {business.name} ({business.ownerEmail})
                                                        {business._count?.files > 0 && (
                                                            <span className="ml-2 text-xs text-green-600">
                                                                {business._count.files} archivos
                                                            </span>
                                                        )}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Chunks Máximos</label>
                                    <Select defaultValue="5">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3">3 chunks</SelectItem>
                                            <SelectItem value="5">5 chunks</SelectItem>
                                            <SelectItem value="10">10 chunks</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Consulta RAG</label>
                                <Textarea
                                    placeholder="¿Qué información necesitas buscar en los documentos?"
                                    value={ragQuery}
                                    onChange={(e) => setRagQuery(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <Button
                                onClick={handleTestRAG}
                                disabled={ragTesting || !ragQuery.trim() || !selectedBusiness}
                                className="w-full"
                            >
                                {ragTesting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Buscando en documentos...
                                    </>
                                ) : (
                                    <>
                                        <Database className="mr-2 h-4 w-4" />
                                        Ejecutar Consulta RAG
                                    </>
                                )}
                            </Button>

                            {ragResult && (
                                <div className="mt-6 space-y-4">
                                    {ragResult.error ? (
                                        <Alert className="border-red-200 bg-red-50">
                                            <XCircle className="h-4 w-4 text-red-600" />
                                            <AlertTitle className="text-red-800">Error en RAG</AlertTitle>
                                            <AlertDescription className="text-red-700">
                                                {ragResult.message}
                                            </AlertDescription>
                                        </Alert>
                                    ) : ragResult.message ? (
                                        <Alert className="border-yellow-200 bg-yellow-50">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            <AlertTitle className="text-yellow-800">Información</AlertTitle>
                                            <AlertDescription className="text-yellow-700">
                                                {ragResult.message}
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <div className="space-y-4">
                                            <Alert className="border-green-200 bg-green-50">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                <AlertTitle className="text-green-800">Consulta Exitosa</AlertTitle>
                                                <AlertDescription className="text-green-700">
                                                    Se encontraron {ragResult.chunks?.length || 0} fragmentos relevantes 
                                                    {ragResult.totalFiles && ` de ${ragResult.totalFiles} archivos`}
                                                    {ragResult.processingTime && ` en ${ragResult.processingTime}ms`}
                                                </AlertDescription>
                                            </Alert>

                                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                                <p><strong>Proveedor:</strong> {ragResult.provider}</p>
                                                <p><strong>Negocio:</strong> {ragResult.businessName}</p>
                                                <p><strong>Query:</strong> &quot;{ragResult.query}&quot;</p>
                                                {ragResult.totalChunksFound && (
                                                    <p><strong>Total de chunks en BD:</strong> {ragResult.totalChunksFound}</p>
                                                )}
                                            </div>

                                            {ragResult.chunks?.map((chunk: any, index: number) => (
                                                <Card key={index}>
                                                    <CardContent className="pt-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <Badge variant="outline">Chunk {index + 1}</Badge>
                                                            <span className="text-xs text-gray-500">
                                                                Score: {chunk.score?.toFixed(3)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 mb-2">{chunk.content}</p>
                                                        {chunk.metadata && (
                                                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                                                <div><strong>Archivo:</strong> {chunk.metadata.fileName}</div>
                                                                <div><strong>Tipo:</strong> {chunk.metadata.fileType}</div>
                                                                {chunk.metadata.chunkId && (
                                                                    <div><strong>Chunk ID:</strong> {chunk.metadata.chunkId}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Monitoring */}
                <TabsContent value="monitoring" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Alertas Activas</CardTitle>
                                <CardDescription>Problemas que requieren atención inmediata</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {/* Mock alerts - in real implementation, fetch from API */}
                                    <div className="flex items-center gap-3 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                        <div className="flex-1">
                                            <p className="font-medium text-yellow-800">Circuit Breaker Abierto</p>
                                            <p className="text-sm text-yellow-700">Proveedor Anthropic no responde</p>
                                        </div>
                                        <Badge variant="secondary">MEDIA</Badge>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 border border-green-200 bg-green-50 rounded-lg">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <div className="flex-1">
                                            <p className="font-medium text-green-800">Sistema Operativo</p>
                                            <p className="text-sm text-green-700">Todos los servicios funcionando</p>
                                        </div>
                                        <Badge variant="outline">OK</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Uso por Proveedor</CardTitle>
                                <CardDescription>Distribución de carga en proveedores</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">OpenAI</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div className="bg-blue-600 h-2 rounded-full" style={{width: '65%'}}></div>
                                            </div>
                                            <span className="text-sm font-medium">65%</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Anthropic</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div className="bg-purple-600 h-2 rounded-full" style={{width: '25%'}}></div>
                                            </div>
                                            <span className="text-sm font-medium">25%</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Groq</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div className="bg-green-600 h-2 rounded-full" style={{width: '10%'}}></div>
                                            </div>
                                            <span className="text-sm font-medium">10%</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="inventory" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Inventario de Inteligencia por Negocio</CardTitle>
                            <CardDescription>
                                Listado de todos los negocios y su configuración actual de IA.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negocio</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubro</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modelo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Conocimiento</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {businesses.map((business) => (
                                            <tr key={business.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{business.name}</div>
                                                    <div className="text-xs text-gray-500">{business.ownerEmail}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge variant="outline">{business.industryType}</Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {business.botConfig?.aiProvider || <span className="text-gray-400 italic">Global (Master)</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {business.botConfig?.aiModel || <span className="text-gray-400 italic">-</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <Badge variant={business._count.files > 0 ? "success" : "secondary"}>
                                                        {business._count.files} archivos
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge variant={business.botConfig?.aiApiKey ? "success" : "outline"}>
                                                        {business.botConfig?.aiApiKey ? "Llave Propia" : "Usando Vault"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}


