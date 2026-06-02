'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { adminApi } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, Key, Plus, Brain, Database, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

// Configuraciones predefinidas para diferentes categorías
const AI_PROVIDERS = [
    { id: 'OPENAI', name: 'OpenAI', keys: ['OPENAI_API_KEY'], models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { id: 'ANTHROPIC', name: 'Anthropic (Claude)', keys: ['ANTHROPIC_API_KEY'], models: ['claude-3-5-sonnet-20241022', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
    { id: 'GROQ', name: 'Groq', keys: ['GROQ_API_KEY'], models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
    { id: 'GOOGLE', name: 'Google AI', keys: ['GOOGLE_AI_API_KEY'], models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
]

const EMBEDDING_PROVIDERS = [
    { id: 'OPENAI_EMBEDDINGS', name: 'OpenAI Embeddings', keys: ['OPENAI_API_KEY'], models: ['text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002'] },
    { id: 'HUGGINGFACE', name: 'Hugging Face', keys: ['HUGGINGFACE_API_KEY'], models: ['sentence-transformers/all-MiniLM-L6-v2'] },
    { id: 'COHERE', name: 'Cohere', keys: ['COHERE_API_KEY'], models: ['embed-multilingual-v3.0', 'embed-english-v3.0'] },
    { id: 'LOCAL', name: 'Local (Sin API)', keys: [], models: ['local-embeddings'] },
]

export default function AdminConfigPage() {
    const { toast } = useToast()
    const [configs, setConfigs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingConfig, setEditingConfig] = useState<any>(null)
    const [showValue, setShowValue] = useState<{ [key: string]: boolean }>({})

    // Form state
    const [formData, setFormData] = useState({ key: '', value: '', description: '', isEncrypted: false })

    // Quick setup states
    const [selectedAIProvider, setSelectedAIProvider] = useState('')
    const [selectedEmbeddingProvider, setSelectedEmbeddingProvider] = useState('')
    const [quickSetupDialog, setQuickSetupDialog] = useState<'ai' | 'embedding' | null>(null)

    async function loadConfigs() {
        try {
            setLoading(true)
            const data = await adminApi.getAllConfigs()
            setConfigs(data)
        } catch (e) {
            console.error('Failed to load configs', e)
            toast({ title: 'Error', description: 'No se pudieron cargar las configuraciones', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadConfigs()
    }, [])

    const handleEdit = (config: any) => {
        setEditingConfig(config)
        setFormData({
            key: config.key,
            value: config.isEncrypted ? '' : config.value,
            description: config.description || '',
            isEncrypted: config.isEncrypted
        })
        setIsDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingConfig(null)
        setFormData({ key: '', value: '', description: '', isEncrypted: false })
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        try {
            if (!formData.key || !formData.value) {
                toast({ title: 'Error', description: 'La clave y el valor son obligatorios', variant: 'destructive' })
                return
            }

            await adminApi.upsertConfig(formData)
            toast({ title: 'Guardado', description: 'Configuración actualizada correctamente.', duration: 3000 })
            setIsDialogOpen(false)
            loadConfigs()
        } catch (e) {
            toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' })
        }
    }

    const handleQuickSetupAI = (providerId: string) => {
        const provider = AI_PROVIDERS.find(p => p.id === providerId)
        if (!provider) return

        setFormData({
            key: provider.keys[0],
            value: '',
            description: `API Key para ${provider.name}`,
            isEncrypted: true
        })
        setQuickSetupDialog(null)
        setIsDialogOpen(true)
    }

    const handleQuickSetupEmbedding = (providerId: string) => {
        const provider = EMBEDDING_PROVIDERS.find(p => p.id === providerId)
        if (!provider) return

        if (provider.keys.length === 0) {
            toast({
                title: 'Local Embeddings',
                description: 'No requiere configuración de API. Los embeddings se generarán localmente.',
                duration: 5000
            })
            return
        }

        setFormData({
            key: provider.keys[0],
            value: '',
            description: `API Key para ${provider.name} (Embeddings)`,
            isEncrypted: true
        })
        setQuickSetupDialog(null)
        setIsDialogOpen(true)
    }

    const getConfigsByCategory = (category: string) => {
        const keywords: { [key: string]: string[] } = {
            ai: ['OPENAI', 'ANTHROPIC', 'GROQ', 'GOOGLE', 'GPT', 'CLAUDE', 'GEMINI', 'AI_'],
            embedding: ['EMBEDDING', 'HUGGINGFACE', 'COHERE', 'VECTOR'],
            database: ['DATABASE', 'POSTGRES', 'REDIS', 'DB_'],
            other: []
        }

        return configs.filter(config => {
            const key = config.key.toUpperCase()
            if (category === 'other') {
                return !keywords.ai.some(k => key.includes(k)) &&
                    !keywords.embedding.some(k => key.includes(k)) &&
                    !keywords.database.some(k => key.includes(k))
            }
            return keywords[category].some(k => key.includes(k))
        })
    }

    const toggleShowValue = (configId: string) => {
        setShowValue(prev => ({ ...prev, [configId]: !prev[configId] }))
    }

    const getProviderStatus = (providerId: string, type: 'ai' | 'embedding') => {
        const provider = type === 'ai'
            ? AI_PROVIDERS.find(p => p.id === providerId)
            : EMBEDDING_PROVIDERS.find(p => p.id === providerId)

        if (!provider) return { configured: false, keyName: '' }

        const hasKey = provider.keys.length === 0 || provider.keys.some(key =>
            configs.some(config => config.key === key && config.value)
        )

        return { configured: hasKey, keyName: provider.keys[0] || '' }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configuración del Sistema</h1>
                    <p className="text-gray-500 mt-1">Gestiona APIs de IA, RAG, bases de datos y servicios externos.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setQuickSetupDialog('ai')} variant="outline" className="gap-2">
                        <Brain className="h-4 w-4" />
                        Configurar IA
                    </Button>
                    <Button onClick={() => setQuickSetupDialog('embedding')} variant="outline" className="gap-2">
                        <Database className="h-4 w-4" />
                        Configurar RAG
                    </Button>
                    <Button onClick={handleCreate} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Variable
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="ai" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="ai" className="gap-2">
                        <Brain className="h-4 w-4" />
                        APIs de IA
                    </TabsTrigger>
                    <TabsTrigger value="embedding" className="gap-2">
                        <Database className="h-4 w-4" />
                        RAG & Embeddings
                    </TabsTrigger>
                    <TabsTrigger value="balancer" className="gap-2">
                        ⚖️ Balanceo APIs
                    </TabsTrigger>
                    <TabsTrigger value="database" className="gap-2">
                        <Database className="h-4 w-4" />
                        Base de Datos
                    </TabsTrigger>
                    <TabsTrigger value="other" className="gap-2">
                        <Key className="h-4 w-4" />
                        Otras
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="space-y-4">
                    <div className="grid gap-4">
                        {AI_PROVIDERS.map(provider => {
                            const status = getProviderStatus(provider.id, 'ai')
                            return (
                                <Card key={provider.id} className={status.configured ? 'border-emerald-200 bg-emerald-50/30' : ''}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`rounded-full p-2 ${status.configured ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                                    <Brain className={`h-5 w-5 ${status.configured ? 'text-emerald-600' : 'text-gray-500'}`} />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                                                    <CardDescription className="text-xs mt-1">
                                                        Modelos: {provider.models.slice(0, 2).join(', ')}...
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {status.configured ? (
                                                    <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Configurado
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Sin configurar
                                                    </div>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant={status.configured ? "outline" : "default"}
                                                    onClick={() => handleQuickSetupAI(provider.id)}
                                                >
                                                    {status.configured ? 'Actualizar' : 'Configurar'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            )
                        })}
                    </div>
                    {getConfigsByCategory('ai').length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Configuraciones Existentes</h3>
                            <div className="grid gap-3 md:grid-cols-2">
                                {getConfigsByCategory('ai').map(config => (
                                    <ConfigCard key={config.id} config={config} onEdit={handleEdit} showValue={showValue} onToggleShow={toggleShowValue} />
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="embedding" className="space-y-4">
                    <div className="grid gap-4">
                        {EMBEDDING_PROVIDERS.map(provider => {
                            const status = getProviderStatus(provider.id, 'embedding')
                            return (
                                <Card key={provider.id} className={status.configured ? 'border-blue-200 bg-blue-50/30' : ''}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`rounded-full p-2 ${status.configured ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                                    <Database className={`h-5 w-5 ${status.configured ? 'text-blue-600' : 'text-gray-500'}`} />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                                                    <CardDescription className="text-xs mt-1">
                                                        {provider.keys.length === 0 ? 'No requiere API' : `Requiere: ${provider.keys[0]}`}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {status.configured ? (
                                                    <div className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        {provider.keys.length === 0 ? 'Disponible' : 'Configurado'}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Sin configurar
                                                    </div>
                                                )}
                                                {provider.keys.length > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant={status.configured ? "outline" : "default"}
                                                        onClick={() => handleQuickSetupEmbedding(provider.id)}
                                                    >
                                                        {status.configured ? 'Actualizar' : 'Configurar'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            )
                        })}
                    </div>
                    {getConfigsByCategory('embedding').length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Configuraciones Existentes</h3>
                            <div className="grid gap-3 md:grid-cols-2">
                                {getConfigsByCategory('embedding').map(config => (
                                    <ConfigCard key={config.id} config={config} onEdit={handleEdit} showValue={showValue} onToggleShow={toggleShowValue} />
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* 🚀 SESIÓN #1: Pestaña de Balanceo de APIs */}
                <TabsContent value="balancer" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                ⚖️ Estrategia de Balanceo
                                <Badge variant="outline" className="ml-2">
                                    COST_OPTIMIZED
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Controla cómo se distribuyen las solicitudes entre los proveedores de embeddings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Estrategia Actual</label>
                                    <Select defaultValue="COST_OPTIMIZED">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="COST_OPTIMIZED">
                                                💰 Optimizado por Costo
                                                <span className="text-xs block text-gray-500">Prioriza proveedores más baratos</span>
                                            </SelectItem>
                                            <SelectItem value="PERFORMANCE">
                                                ⚡ Optimizado por Velocidad
                                                <span className="text-xs block text-gray-500">Prioriza proveedores más rápidos</span>
                                            </SelectItem>
                                            <SelectItem value="LOAD_BALANCED">
                                                ⚖️ Balanceado por Carga
                                                <span className="text-xs block text-gray-500">Distribuye equitativamente</span>
                                            </SelectItem>
                                            <SelectItem value="ROUND_ROBIN">
                                                🔄 Round Robin
                                                <span className="text-xs block text-gray-500">Rota entre todos los proveedores</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Configuración Global</label>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">Failover Automático</span>
                                            <input type="checkbox" defaultChecked className="rounded" />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">Reintento Inteligente</span>
                                            <input type="checkbox" defaultChecked className="rounded" />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">Monitoreo en Tiempo Real</span>
                                            <input type="checkbox" defaultChecked className="rounded" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <Button className="gap-2">
                                    <Save className="h-4 w-4" />
                                    Aplicar Cambios
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Configuración de Quotas por API</CardTitle>
                            <CardDescription>
                                Establece límites de uso por hora para cada proveedor
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">OpenAI Embeddings</label>
                                        <div className="flex gap-2">
                                            <Input placeholder="50000" defaultValue="50000" />
                                            <span className="text-sm text-gray-500 self-center">tokens/hora</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Cohere Embeddings</label>
                                        <div className="flex gap-2">
                                            <Input placeholder="100000" defaultValue="100000" />
                                            <span className="text-sm text-gray-500 self-center">tokens/hora</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">HuggingFace (Gratis)</label>
                                        <div className="flex gap-2">
                                            <Input placeholder="10000" defaultValue="10000" />
                                            <span className="text-sm text-gray-500 self-center">tokens/hora</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Local Embeddings</label>
                                        <div className="flex gap-2">
                                            <Input placeholder="5000" defaultValue="5000" />
                                            <span className="text-sm text-gray-500 self-center">tokens/hora</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <Button variant="outline" className="gap-2">
                                        <Save className="h-4 w-4" />
                                        Guardar Quotas
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Alertas y Monitoreo</CardTitle>
                            <CardDescription>
                                Configura alertas automáticas para problemas con las APIs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Umbral de Latencia (ms)</label>
                                        <Input placeholder="2000" defaultValue="2000" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Máximo Errores/Hora</label>
                                        <Input placeholder="10" defaultValue="10" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Costo Máximo/Hora ($)</label>
                                        <Input placeholder="50" defaultValue="50" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email para Alertas</label>
                                        <Input placeholder="admin@tudominio.com" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <Button variant="outline" className="gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        Configurar Alertas
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="database" className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        {getConfigsByCategory('database').map(config => (
                            <ConfigCard key={config.id} config={config} onEdit={handleEdit} showValue={showValue} onToggleShow={toggleShowValue} />
                        ))}
                        {getConfigsByCategory('database').length === 0 && (
                            <div className="col-span-2 text-center py-10 text-gray-500 border rounded-lg border-dashed">
                                No hay configuraciones de base de datos.
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="other" className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        {getConfigsByCategory('other').map(config => (
                            <ConfigCard key={config.id} config={config} onEdit={handleEdit} showValue={showValue} onToggleShow={toggleShowValue} />
                        ))}
                        {getConfigsByCategory('other').length === 0 && (
                            <div className="col-span-2 text-center py-10 text-gray-500 border rounded-lg border-dashed">
                                No hay otras configuraciones.
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Dialog para editar/crear config */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingConfig ? 'Editar Configuración' : 'Nueva Configuración'}</DialogTitle>
                        <DialogDescription>
                            {formData.isEncrypted && '🔒 Esta configuración será encriptada en la base de datos'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Clave (Key)</Label>
                            <Input
                                value={formData.key}
                                onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                                disabled={!!editingConfig}
                                placeholder="OPENAI_API_KEY"
                                className="font-mono uppercase"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor</Label>
                            <Textarea
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                placeholder={formData.isEncrypted ? "sk-..." : "Valor de la configuración"}
                                className="font-mono"
                                rows={4}
                            />
                            {editingConfig?.isEncrypted && !formData.value && (
                                <p className="text-xs text-amber-600">Deja vacío para mantener el valor actual encriptado</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descripción opcional"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isEncrypted"
                                checked={formData.isEncrypted}
                                onChange={(e) => setFormData({ ...formData, isEncrypted: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <Label htmlFor="isEncrypted" className="cursor-pointer flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                Encriptar valor (recomendado para API keys)
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" /> Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Setup AI Dialog */}
            <Dialog open={quickSetupDialog === 'ai'} onOpenChange={(open) => !open && setQuickSetupDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Configuración Rápida: IA</DialogTitle>
                        <DialogDescription>Selecciona el proveedor de IA que deseas configurar</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        {AI_PROVIDERS.map(provider => {
                            const status = getProviderStatus(provider.id, 'ai')
                            return (
                                <button
                                    key={provider.id}
                                    onClick={() => handleQuickSetupAI(provider.id)}
                                    className="w-full flex items-center justify-between p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <Brain className="h-5 w-5 text-primary" />
                                        <div className="text-left">
                                            <p className="font-semibold">{provider.name}</p>
                                            <p className="text-xs text-gray-500">{provider.models[0]}</p>
                                        </div>
                                    </div>
                                    {status.configured && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                                </button>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Quick Setup Embedding Dialog */}
            <Dialog open={quickSetupDialog === 'embedding'} onOpenChange={(open) => !open && setQuickSetupDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Configuración Rápida: RAG & Embeddings</DialogTitle>
                        <DialogDescription>Selecciona el proveedor de embeddings para RAG</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        {EMBEDDING_PROVIDERS.map(provider => {
                            const status = getProviderStatus(provider.id, 'embedding')
                            return (
                                <button
                                    key={provider.id}
                                    onClick={() => handleQuickSetupEmbedding(provider.id)}
                                    className="w-full flex items-center justify-between p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <Database className="h-5 w-5 text-blue-600" />
                                        <div className="text-left">
                                            <p className="font-semibold">{provider.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {provider.keys.length === 0 ? 'Sin API requerida' : provider.keys[0]}
                                            </p>
                                        </div>
                                    </div>
                                    {status.configured && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                                </button>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ConfigCard({ config, onEdit, showValue, onToggleShow }: any) {
    const isVisible = showValue[config.id] || false

    return (
        <Card className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => onEdit(config)}>
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-start text-base">
                    <span className="font-mono text-primary text-sm">{config.key}</span>
                    <div className="flex items-center gap-1">
                        {config.isEncrypted && <Key className="h-4 w-4 text-amber-500" />}
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleShow(config.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {isVisible ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                        </button>
                    </div>
                </CardTitle>
                <CardDescription className="text-xs">{config.description || 'Sin descripción'}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-slate-100 p-2 rounded text-xs font-mono break-all text-gray-600">
                    {config.isEncrypted && !isVisible
                        ? '••••••••••••••••'
                        : isVisible
                            ? config.value
                            : (config.value.length > 50 ? config.value.substring(0, 50) + '...' : config.value)
                    }
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">
                    Actualizado: {new Date(config.updatedAt).toLocaleDateString()}
                </p>
            </CardContent>
        </Card>
    )
}
