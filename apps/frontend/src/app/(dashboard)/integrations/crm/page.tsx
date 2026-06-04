'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  Database,
  MessageSquare,
} from 'lucide-react'
import { useBusinessStore } from '@/store/business'
import { crmApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const crmProviders = [
  { value: 'NONE', label: 'Ninguno' },
  { value: 'META_CRM', label: 'Meta CRM' },
  { value: 'HUBSPOT', label: 'HubSpot' },
  { value: 'SALESFORCE', label: 'Salesforce' },
  { value: 'ZOHO', label: 'Zoho CRM' },
  { value: 'PIPEDRIVE', label: 'Pipedrive' },
  { value: 'MONDAY', label: 'Monday.com' },
  { value: 'GOOGLE_SHEETS', label: 'Google Sheets' },
  { value: 'CUSTOM', label: 'CRM Personalizado' },
]

interface CRMConnection {
  id?: string
  businessId: string
  provider: string
  isActive: boolean
  isConnected: boolean
  syncEnabled: boolean
  syncDirection: 'TO_CRM' | 'FROM_CRM' | 'BIDIRECTIONAL'
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  apiSecret?: string
  baseUrl?: string
  config?: any
  lastSyncAt?: string
}

interface CRMChannelOption {
  key: string
  type: string
  label: string
  description?: string
  status?: string | null
  compatible: boolean
  reasons?: string[]
  actions?: string[]
}

export default function CRMPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [crmConnection, setCrmConnection] = useState<CRMConnection | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [channelOptions, setChannelOptions] = useState<CRMChannelOption[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [channelLoading, setChannelLoading] = useState(false)
  const [savingChannels, setSavingChannels] = useState(false)

  // Estados para formularios según el CRM
  const [selectedProvider, setSelectedProvider] = useState('NONE')
  const [formData, setFormData] = useState({
    accessToken: '',
    refreshToken: '',
    apiKey: '',
    apiSecret: '',
    baseUrl: '',
    pageId: '', // Para Meta CRM
    spreadsheetId: '', // Para Google Sheets
    syncEnabled: true,
    syncDirection: 'BIDIRECTIONAL' as 'TO_CRM' | 'FROM_CRM' | 'BIDIRECTIONAL',
  })

  const loadConnection = useCallback(async () => {
    if (!selectedBusiness) return

    try {
      const response = await crmApi.getConnection(selectedBusiness.id)
      setCrmConnection(response.data)
      setSelectedProvider(response.data.provider || 'NONE')
    } catch (error: any) {
      console.error('Error loading CRM connection:', error)
      // Si no existe, crear uno por defecto
      setCrmConnection({
        businessId: selectedBusiness.id,
        provider: 'NONE',
        isActive: false,
        isConnected: false,
        syncEnabled: false,
        syncDirection: 'BIDIRECTIONAL',
      })
    }
  }, [selectedBusiness])

  const loadChannelMappings = useCallback(async () => {
    if (!selectedBusiness) return

    setChannelLoading(true)
    try {
      const response = await crmApi.getChannelMappings(selectedBusiness.id)
      setChannelOptions(response.data?.options || [])
      setSelectedChannels(response.data?.enabledKeys || [])
    } catch (error: any) {
      console.error('Error loading channel mappings:', error)
      toast({
        title: 'No se pudieron cargar los canales',
        description: error.response?.data?.message || 'Intenta nuevamente en unos segundos.',
        variant: 'destructive',
      })
    } finally {
      setChannelLoading(false)
    }
  }, [selectedBusiness, toast])

  useEffect(() => {
    loadConnection()
  }, [loadConnection])

  useEffect(() => {
    if (!selectedBusiness) return
    loadChannelMappings()
  }, [selectedBusiness, loadChannelMappings])

  useEffect(() => {
    if (crmConnection && configDialogOpen) {
      setSelectedProvider(crmConnection.provider || 'NONE')
      setFormData({
        accessToken: crmConnection.accessToken || '',
        refreshToken: crmConnection.refreshToken || '',
        apiKey: crmConnection.apiKey || '',
        apiSecret: crmConnection.apiSecret || '',
        baseUrl: crmConnection.baseUrl || '',
        pageId: crmConnection.config?.pageId || '',
        spreadsheetId: crmConnection.config?.spreadsheetId || '',
        syncEnabled: crmConnection.syncEnabled ?? true,
        syncDirection: crmConnection.syncDirection || 'BIDIRECTIONAL',
      })
    }
  }, [crmConnection, configDialogOpen])

  const handleSave = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      const connectionData: any = {
        provider: selectedProvider,
        syncEnabled: formData.syncEnabled,
        syncDirection: formData.syncDirection,
      }

      // Agregar campos según el proveedor
      if (selectedProvider === 'META_CRM') {
        connectionData.accessToken = formData.accessToken
        connectionData.config = { pageId: formData.pageId }
      } else if (selectedProvider === 'GOOGLE_SHEETS') {
        connectionData.accessToken = formData.accessToken
        connectionData.config = { spreadsheetId: formData.spreadsheetId }
      } else if (selectedProvider === 'HUBSPOT' || selectedProvider === 'SALESFORCE') {
        connectionData.accessToken = formData.accessToken
        connectionData.refreshToken = formData.refreshToken
      } else if (selectedProvider === 'CUSTOM') {
        connectionData.apiKey = formData.apiKey
        connectionData.apiSecret = formData.apiSecret
        connectionData.baseUrl = formData.baseUrl
      }

      await crmApi.createConnection(selectedBusiness.id, connectionData)
      toast({
        title: 'CRM configurado',
        description: 'La configuración del CRM se ha guardado correctamente.',
      })
      setConfigDialogOpen(false)
      loadConnection()
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.response?.data?.message || 'No se pudo guardar la configuración.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!selectedBusiness) return

    setTesting(true)
    try {
      const response = await crmApi.testConnection(selectedBusiness.id)
      if (response.data.success) {
        toast({
          title: '✅ Conexión exitosa',
          description: response.data.message || 'El CRM está conectado correctamente.',
        })
      } else {
        toast({
          title: '❌ Error de conexión',
          description: response.data.message || 'No se pudo conectar con el CRM.',
          variant: 'destructive',
        })
      }
      loadConnection()
    } catch (error: any) {
      toast({
        title: 'Error al probar conexión',
        description: error.response?.data?.message || 'Ocurrió un error al probar la conexión.',
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      await crmApi.updateConnection(selectedBusiness.id, {
        provider: 'NONE',
        isActive: false,
      })
      toast({
        title: 'CRM desconectado',
        description: 'La conexión del CRM ha sido desconectada.',
      })
      loadConnection()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo desconectar.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerSync = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      await crmApi.triggerSync(selectedBusiness.id)
      toast({
        title: 'Sincronización iniciada',
        description: 'La sincronización con el CRM ha comenzado.',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo iniciar la sincronización.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleChannelSelection = (key: string) => {
    setSelectedChannels((prev) =>
      prev.includes(key) ? prev.filter((channelKey) => channelKey !== key) : [...prev, key],
    )
  }

  const handleChannelToggle = (channel: CRMChannelOption) => {
    if (!channel.compatible) {
      toast({
        title: 'Canal no disponible',
        description:
          channel.reasons?.[0] || 'Este canal requiere configuración adicional antes de habilitarse.',
        variant: 'destructive',
      })
      return
    }
    toggleChannelSelection(channel.key)
  }

  const handleSaveChannels = async () => {
    if (!selectedBusiness) return
    setSavingChannels(true)
    try {
      await crmApi.saveChannelMappings(selectedBusiness.id, selectedChannels)
      toast({
        title: 'Canales actualizados',
        description: 'La selección de canales para el CRM se guardó correctamente.',
      })
      loadChannelMappings()
    } catch (error: any) {
      toast({
        title: 'No se pudo guardar',
        description: error.response?.data?.message || 'Intenta nuevamente en unos minutos.',
        variant: 'destructive',
      })
    } finally {
      setSavingChannels(false)
    }
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay negocio seleccionado</h2>
        <p className="text-gray-600 mb-6">Configura o selecciona un negocio para continuar.</p>
        <Link href="/businesses">
          <Button>Ir a Negocios</Button>
        </Link>
      </div>
    )
  }

  const currentProvider = crmProviders.find((p) => p.value === (crmConnection?.provider || 'NONE'))

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary/80 uppercase tracking-wide">Configuración por negocio</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">Integraciones CRM</h1>
        <p className="text-gray-600 mt-2">
          Conecta tu sistema con un CRM externo para sincronizar contactos, mensajes y etiquetas para{' '}
          <span className="font-semibold">{selectedBusiness.name}</span>.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Estado de la Conexión
          </CardTitle>
          <CardDescription>Gestiona la integración con tu CRM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {crmConnection?.isConnected ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {currentProvider?.label || 'CRM Conectado'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {crmConnection.syncEnabled ? 'Sincronización activa' : 'Sincronización desactivada'}
                    </p>
                    {crmConnection.lastSyncAt && (
                      <p className="text-xs text-gray-400">
                        Última sincronización: {new Date(crmConnection.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </>
              ) : crmConnection?.isActive ? (
                <>
                  <Wifi className="h-6 w-6 text-yellow-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {currentProvider?.label || 'CRM Configurado'}
                    </p>
                    <p className="text-xs text-gray-500">Configurado pero no conectado</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-500">No hay CRM configurado</p>
                    <p className="text-xs text-gray-400">Selecciona un CRM para comenzar</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {crmConnection?.isActive && (
                <>
                  <Button
                    onClick={handleTestConnection}
                    disabled={testing}
                    variant="outline"
                    size="sm"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Probar Conexión
                      </>
                    )}
                  </Button>
                  {crmConnection.isConnected && (
                    <Button
                      onClick={handleTriggerSync}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sincronizar Ahora
                    </Button>
                  )}
                </>
              )}
              <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant={crmConnection?.isActive ? 'outline' : 'default'} size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    {crmConnection?.isActive ? 'Editar' : 'Configurar CRM'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Configurar CRM</DialogTitle>
                    <DialogDescription>
                      Selecciona tu CRM y configura las credenciales necesarias.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Proveedor de CRM</Label>
                      <Select
                        value={selectedProvider}
                        onValueChange={(value) => {
                          setSelectedProvider(value)
                          // Resetear formulario al cambiar proveedor
                          setFormData({
                            accessToken: '',
                            refreshToken: '',
                            apiKey: '',
                            apiSecret: '',
                            baseUrl: '',
                            pageId: '',
                            syncEnabled: true,
                            syncDirection: 'BIDIRECTIONAL',
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un CRM" />
                        </SelectTrigger>
                        <SelectContent>
                          {crmProviders.map((provider) => (
                            <SelectItem key={provider.value} value={provider.value}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProvider !== 'NONE' && (
                      <>
                        {/* Meta CRM */}
                        {selectedProvider === 'META_CRM' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Access Token</Label>
                              <Input
                                type="password"
                                value={formData.accessToken}
                                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                                placeholder="EAA..."
                              />
                              <p className="text-xs text-gray-500">
                                Token de acceso de Facebook Graph API
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Page ID</Label>
                              <Input
                                value={formData.pageId}
                                onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
                                placeholder="123456789012345"
                              />
                              <p className="text-xs text-gray-500">
                                ID de tu página de Facebook
                              </p>
                            </div>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs text-blue-800">
                                <strong>ℹ️ Nota:</strong> Obtén las credenciales desde{' '}
                                <a
                                  href="https://developers.facebook.com/"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  Facebook Developers
                                </a>
                                .
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Google Sheets */}
                        {selectedProvider === 'GOOGLE_SHEETS' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Spreadsheet ID (ID de la Hoja de Cálculo)</Label>
                              <Input
                                value={formData.spreadsheetId}
                                onChange={(e) => setFormData({ ...formData, spreadsheetId: e.target.value })}
                                placeholder="1a2b3c4d5e6f7g8h9i0j..."
                                required
                              />
                              <p className="text-xs text-gray-500">
                                Copia el ID de la URL de tu Google Sheet (entre /d/ y /edit).
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Google Service Account JSON (Credenciales de Cuenta de Servicio)</Label>
                              <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                value={formData.accessToken}
                                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                                placeholder='{ "type": "service_account", "project_id": ... }'
                                required
                              />
                              <p className="text-xs text-gray-500">
                                Pega el contenido completo del archivo JSON de tu Cuenta de Servicio. Recuerda compartir tu Hoja de Cálculo con el correo electrónico de esta Cuenta de Servicio (client_email) con permisos de Editor.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* HubSpot / Salesforce */}
                        {(selectedProvider === 'HUBSPOT' || selectedProvider === 'SALESFORCE') && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Access Token</Label>
                              <Input
                                type="password"
                                value={formData.accessToken}
                                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                                placeholder="Token de acceso"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Refresh Token (Opcional)</Label>
                              <Input
                                type="password"
                                value={formData.refreshToken}
                                onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                                placeholder="Token de actualización"
                              />
                            </div>
                          </div>
                        )}

                        {/* Custom CRM */}
                        {selectedProvider === 'CUSTOM' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>API Key</Label>
                              <Input
                                type="password"
                                value={formData.apiKey}
                                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                placeholder="Tu API Key"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>API Secret</Label>
                              <Input
                                type="password"
                                value={formData.apiSecret}
                                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                                placeholder="Tu API Secret"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Base URL</Label>
                              <Input
                                value={formData.baseUrl}
                                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                placeholder="https://api.tu-crm.com"
                              />
                            </div>
                          </div>
                        )}

                        {/* Configuración de sincronización */}
                        <div className="space-y-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label>Dirección de sincronización</Label>
                            <Select
                              value={formData.syncDirection}
                              onValueChange={(value: 'TO_CRM' | 'FROM_CRM' | 'BIDIRECTIONAL') =>
                                setFormData({ ...formData, syncDirection: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BIDIRECTIONAL">Bidireccional (Recomendado)</SelectItem>
                                <SelectItem value="TO_CRM">Solo hacia el CRM</SelectItem>
                                <SelectItem value="FROM_CRM">Solo desde el CRM</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">
                              Controla cómo se sincronizan los datos entre tu sistema y el CRM
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="syncEnabled"
                              checked={formData.syncEnabled}
                              onChange={(e) => setFormData({ ...formData, syncEnabled: e.target.checked })}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="syncEnabled" className="text-sm cursor-pointer">
                              Habilitar sincronización automática
                            </Label>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t">
                          <Button onClick={handleSave} disabled={loading} className="flex-1">
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              'Guardar'
                            )}
                          </Button>
                          {crmConnection?.isActive && (
                            <Button onClick={handleDisconnect} variant="destructive" disabled={loading}>
                              Desconectar
                            </Button>
                          )}
                        </div>
                      </>
                    )}

                    {selectedProvider === 'NONE' && (
                      <div className="pt-4">
                        <Button onClick={handleSave} disabled={loading} className="w-full">
                          Guardar
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Canales conectados al CRM
          </CardTitle>
          <CardDescription>Elige qué cuentas y canales se sincronizan con tu CRM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!crmConnection?.isActive ? (
            <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Configura primero un CRM para habilitar la selección de canales.
            </div>
          ) : channelLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando canales disponibles...
            </div>
          ) : channelOptions.length === 0 ? (
            <p className="text-sm text-slate-500">No hay canales disponibles para este negocio.</p>
          ) : (
            <div className="space-y-3">
              {channelOptions.map((channel) => {
                const checked = selectedChannels.includes(channel.key)
                const incompatible = !channel.compatible
                return (
                  <label
                    key={channel.key}
                    className={`flex flex-col gap-3 rounded-lg border p-4 transition ${checked ? 'border-primary/60 bg-primary/5' : 'border-slate-200'} ${incompatible ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-primary/40'}`}
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                          <span
                            className={`rounded-full px-2 py-[2px] text-[11px] font-semibold ${incompatible ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}
                          >
                            {incompatible ? 'Requiere acción' : 'Listo para sincronizar'}
                          </span>
                        </div>
                        {channel.description && (
                          <p className="text-xs text-slate-500">{channel.description}</p>
                        )}
                        {channel.status && (
                          <p className="text-[11px] text-slate-400 mt-1">Estado actual: {channel.status}</p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                        checked={checked}
                        disabled={incompatible}
                        onChange={() => handleChannelToggle(channel)}
                      />
                    </div>

                    {incompatible && (channel.reasons?.length || channel.actions?.length) && (
                      <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 space-y-2">
                        {channel.reasons && channel.reasons.length > 0 && (
                          <ul className="list-disc pl-4 space-y-1">
                            {channel.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        )}
                        {channel.actions && channel.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {channel.actions.map((action) => (
                              <span
                                key={action}
                                className="rounded-full bg-white/90 px-2 py-[2px] text-[11px] font-medium text-red-600 shadow-sm"
                              >
                                {action}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveChannels} disabled={!crmConnection?.isActive || savingChannels || channelOptions.length === 0}>
              {savingChannels ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...
                </>
              ) : (
                'Guardar selección'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ℹ️ Información sobre Integraciones CRM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>¿Qué es una integración CRM?</strong>
              <br />
              Las integraciones CRM permiten sincronizar automáticamente contactos, mensajes, etiquetas y otros datos entre tu sistema y un CRM externo.
            </p>
            <p>
              <strong>¿Qué se sincroniza?</strong>
              <br />
              • Contactos y clientes
              <br />
              • Mensajes y conversaciones
              <br />
              • Etiquetas y categorías
              <br />
              • Oportunidades y deals (según el CRM)
              <br />
              • Tareas y notas (según el CRM)
            </p>
            <p>
              <strong>CRM Disponibles:</strong>
              <br />
              • <strong>Meta CRM:</strong> Integración con Facebook Business Suite
              <br />
              • <strong>HubSpot:</strong> CRM completo con marketing y ventas
              <br />
              • <strong>Salesforce:</strong> Plataforma CRM empresarial
              <br />
              • <strong>Zoho CRM:</strong> CRM con suite completa de herramientas
              <br />
              • <strong>Pipedrive:</strong> CRM enfocado en ventas
              <br />
              • <strong>Monday.com:</strong> Plataforma de gestión de proyectos
              <br />
              • <strong>CRM Personalizado:</strong> Conecta tu propio CRM mediante API
            </p>
            <p className="text-xs text-gray-500">
              <strong>Nota:</strong> Algunos CRMs requieren configuración adicional en sus plataformas. Consulta la documentación de cada CRM para obtener las credenciales necesarias.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

