'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Building2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useBusinessStore } from '@/store/business'
import { metaApi, whatsappApi, businessApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface MetaConnection {
  businessId: string
  messengerEnabled: boolean
  messengerPageId?: string
  messengerAccessToken?: string
  messengerVerifyToken?: string
  messengerConnected: boolean
  instagramEnabled: boolean
  instagramAccountId?: string
  instagramAccessToken?: string
  instagramConnected: boolean
  webhookUrl?: string
  webhookVerified: boolean
}

export default function ChannelsPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [loading, setLoading] = useState(false)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace(':3000', ':3001')}/api/v1/webhooks/meta`
    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/webhooks/meta`

  const [metaConnection, setMetaConnection] = useState<MetaConnection | null>(null)
  const [whatsappWebStatus, setWhatsappWebStatus] = useState('')
  const [whatsappApiStatus, setWhatsappApiStatus] = useState(false)
  const [messengerDialogOpen, setMessengerDialogOpen] = useState(false)
  const [instagramDialogOpen, setInstagramDialogOpen] = useState(false)

  // Estados para formularios
  const [messengerForm, setMessengerForm] = useState({
    pageId: '',
    accessToken: '',
    verifyToken: '',
  })
  const [instagramForm, setInstagramForm] = useState({
    accountId: '',
    accessToken: '',
  })
  const [telegramBotDialogOpen, setTelegramBotDialogOpen] = useState(false)
  const [telegramPersonalDialogOpen, setTelegramPersonalDialogOpen] = useState(false)
  const [telegramVerifyDialogOpen, setTelegramVerifyDialogOpen] = useState(false)
  const [telegramBotForm, setTelegramBotForm] = useState({ token: '' })
  const [telegramPersonalForm, setTelegramPersonalForm] = useState({
    apiId: '',
    apiHash: '',
    phone: '',
  })
  const [telegramVerifyCode, setTelegramVerifyCode] = useState('')
  const [telegramBotStatus, setTelegramBotStatus] = useState(false)
  const [telegramPersonalStatus, setTelegramPersonalStatus] = useState(false)

  const loadConnections = useCallback(async () => {
    if (!selectedBusiness) return

    try {
      // Cargar conexión de Meta
      try {
        const metaResponse = await metaApi.getConnection(selectedBusiness.id)
        setMetaConnection(metaResponse.data)
      } catch (error) {
        setMetaConnection(null)
      }

      // Cargar estado de WhatsApp Web
      try {
        const whatsappWebResponse = await whatsappApi.getStatus(selectedBusiness.id)
        const statusVal = whatsappWebResponse.data.status
        const statusStr = typeof statusVal === 'object' && statusVal !== null
          ? (statusVal.statusString || statusVal.status || '')
          : (statusVal || '')
        setWhatsappWebStatus(statusStr)
      } catch (error) {
        setWhatsappWebStatus('')
      }

      // Cargar estado de WhatsApp API y Telegram desde botConfig
      try {
        const botConfigResponse = await businessApi.getBotConfig(selectedBusiness.id)
        setWhatsappApiStatus(botConfigResponse.data.whatsappApiEnabled || false)
        setTelegramBotStatus(botConfigResponse.data.telegramConnected || false)
        setTelegramPersonalStatus(botConfigResponse.data.telegramStatus === 'CONNECTED')
        
        if (botConfigResponse.data.telegramBotToken) {
            setTelegramBotForm({ token: botConfigResponse.data.telegramBotToken })
        }
      } catch (error) {
        setWhatsappApiStatus(false)
        setTelegramBotStatus(false)
        setTelegramPersonalStatus(false)
      }
    } catch (error: any) {
      console.error('Error loading connections:', error)
    }
  }, [selectedBusiness])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  useEffect(() => {
    if (metaConnection && messengerDialogOpen) {
      setMessengerForm({
        pageId: metaConnection.messengerPageId || '',
        accessToken: metaConnection.messengerAccessToken || '',
        verifyToken: metaConnection.messengerVerifyToken || '',
      })
    }
  }, [metaConnection, messengerDialogOpen])

  useEffect(() => {
    if (metaConnection && instagramDialogOpen) {
      setInstagramForm({
        accountId: metaConnection.instagramAccountId || '',
        accessToken: metaConnection.instagramAccessToken || '',
      })
    }
  }, [metaConnection, instagramDialogOpen])

  const handleSaveMessenger = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      await metaApi.updateConnection(selectedBusiness.id, {
        messengerEnabled: true,
        messengerPageId: messengerForm.pageId,
        messengerAccessToken: messengerForm.accessToken,
        messengerVerifyToken: messengerForm.verifyToken,
      })
      toast({
        title: 'Messenger configurado',
        description: 'La configuración de Messenger se ha guardado correctamente.',
      })
      setMessengerDialogOpen(false)
      loadConnections()
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

  const handleSaveInstagram = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      await metaApi.updateConnection(selectedBusiness.id, {
        instagramEnabled: true,
        instagramAccountId: instagramForm.accountId,
        instagramAccessToken: instagramForm.accessToken,
      })
      toast({
        title: 'Instagram configurado',
        description: 'La configuración de Instagram se ha guardado correctamente.',
      })
      setInstagramDialogOpen(false)
      loadConnections()
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

  const handleDisconnectMessenger = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      await metaApi.updateConnection(selectedBusiness.id, {
        messengerEnabled: false,
        messengerPageId: null,
        messengerAccessToken: null,
        messengerVerifyToken: null,
      })
      toast({
        title: 'Messenger desconectado',
        description: 'La conexión de Messenger ha sido desconectada.',
      })
      loadConnections()
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

  const handleDisconnectInstagram = async () => {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      await metaApi.updateConnection(selectedBusiness.id, {
        instagramEnabled: false,
        instagramAccountId: null,
        instagramAccessToken: null,
      })
      toast({
        title: 'Instagram desconectado',
        description: 'La conexión de Instagram ha sido desconectada.',
      })
      loadConnections()
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

  const handleSaveTelegramBot = async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      await businessApi.connectTelegram(selectedBusiness.id, {
        botToken: telegramBotForm.token
      })
      toast({ title: 'Telegram Bot conectado' })
      setTelegramBotDialogOpen(false)
      loadConnections()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo conectar.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStartTelegramPersonal = async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      await businessApi.startTelegramPersonal(selectedBusiness.id, telegramPersonalForm)
      toast({ title: 'Código enviado', description: 'Revisa tu Telegram para el código de verificación.' })
      setTelegramPersonalDialogOpen(false)
      setTelegramVerifyDialogOpen(true)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo iniciar.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyTelegramPersonal = async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      await businessApi.verifyTelegramPersonal(selectedBusiness.id, { code: telegramVerifyCode })
      toast({ title: 'Telegram Personal conectado' })
      setTelegramVerifyDialogOpen(false)
      loadConnections()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Código inválido.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectTelegramBot = async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      await businessApi.disconnectTelegram(selectedBusiness.id)
      toast({ title: 'Telegram Bot desconectado' })
      loadConnections()
    } catch (error: any) {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectTelegramPersonal = async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      await businessApi.disconnectTelegramPersonal(selectedBusiness.id)
      toast({ title: 'Telegram Personal desconectado' })
      loadConnections()
    } catch (error: any) {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-slate-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">No hay negocio seleccionado</h2>
        <p className="text-slate-300 mb-6">Configura o selecciona un negocio para continuar.</p>
        <Link href="/businesses">
          <Button>Ir a Negocios</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary/80 uppercase tracking-wide">Configuración por negocio</p>
        <h1 className="text-3xl font-bold text-white mt-1">Canales de Mensajería</h1>
        <p className="text-slate-300 mt-2">
          Configura los canales de mensajería disponibles para <span className="font-semibold">{selectedBusiness.name}</span>.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* WhatsApp Business API */}
        <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-green-500" />
              WhatsApp Business API
            </CardTitle>
            <CardDescription>Integración oficial de WhatsApp Business API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {whatsappApiStatus ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-white">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">No configurado</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Configura esta integración en la sección de Configuración → WhatsApp
            </p>
            <Link href="/settings">
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Ir a Configuración
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* WhatsApp Web */}
        <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-green-500" />
              WhatsApp Web
            </CardTitle>
            <CardDescription>Integración manual de WhatsApp Web</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {whatsappWebStatus === 'READY' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-white">Conectado</span>
                  </>
                ) : whatsappWebStatus ? (
                  <>
                    <Wifi className="h-5 w-5 text-yellow-500" />
                    <span className="text-sm font-medium text-white">{whatsappWebStatus}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">No configurado</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Configura esta integración en la sección de Configuración → WhatsApp
            </p>
            <Link href="/settings">
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Ir a Configuración
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Facebook Messenger */}
        <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Facebook Messenger
            </CardTitle>
            <CardDescription>Integración con Facebook Messenger via Graph API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {metaConnection?.messengerConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-white">Conectado</span>
                  </>
                ) : metaConnection?.messengerEnabled ? (
                  <>
                    <Wifi className="h-5 w-5 text-yellow-500" />
                    <span className="text-sm font-medium text-white">Configurado (no conectado)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">No configurado</span>
                  </>
                )}
              </div>
            </div>
            {metaConnection?.messengerEnabled ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Page ID: {metaConnection.messengerPageId || 'No configurado'}
                </p>
                <div className="flex gap-2">
                  <Dialog open={messengerDialogOpen} onOpenChange={setMessengerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Settings className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Configurar Facebook Messenger</DialogTitle>
                        <DialogDescription>
                          Ingresa las credenciales de tu página de Facebook para conectar Messenger.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-1.5 text-xs text-blue-200">
                          <p className="font-bold uppercase tracking-wider text-[10px] text-blue-400">📖 Guía de configuración:</p>
                          <ol className="list-decimal pl-4 space-y-1">
                            <li>Ve a <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline text-blue-300">Facebook Developers</a> y crea una app.</li>
                            <li>Agrega el producto <b>Messenger</b> y asocia tu Página.</li>
                            <li>Genera el <b>Access Token</b> de la página y pégalo abajo.</li>
                            <li>Configura el Webhook apuntando a: <code className="bg-slate-900/60 px-1 py-0.5 rounded text-[10px] font-mono select-all">{webhookUrl}</code></li>
                            <li>Usa tu <b>Verify Token</b> elegido en ambos lados para validar.</li>
                          </ol>
                        </div>
                        <div className="space-y-2">
                          <Label>Page ID</Label>
                          <Input
                            value={messengerForm.pageId}
                            onChange={(e) => setMessengerForm({ ...messengerForm, pageId: e.target.value })}
                            placeholder="123456789012345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Access Token</Label>
                          <Input
                            type="password"
                            value={messengerForm.accessToken}
                            onChange={(e) => setMessengerForm({ ...messengerForm, accessToken: e.target.value })}
                            placeholder="EAA..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Verify Token</Label>
                          <Input
                            value={messengerForm.verifyToken}
                            onChange={(e) => setMessengerForm({ ...messengerForm, verifyToken: e.target.value })}
                            placeholder="mi_token_secreto"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveMessenger} disabled={loading} className="flex-1">
                            Guardar
                          </Button>
                          <Button onClick={handleDisconnectMessenger} variant="destructive" disabled={loading}>
                            Desconectar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <Dialog open={messengerDialogOpen} onOpenChange={setMessengerDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Conectar con Messenger
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Configurar Facebook Messenger</DialogTitle>
                    <DialogDescription>
                      Ingresa las credenciales de tu página de Facebook para conectar Messenger.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-1.5 text-xs text-blue-200">
                      <p className="font-bold uppercase tracking-wider text-[10px] text-blue-400">📖 Guía de configuración:</p>
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Ve a <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline text-blue-300">Facebook Developers</a> y crea una app.</li>
                        <li>Agrega el producto <b>Messenger</b> y asocia tu Página.</li>
                        <li>Genera el <b>Access Token</b> de la página y pégalo abajo.</li>
                        <li>Configura el Webhook apuntando a: <code className="bg-slate-900/60 px-1 py-0.5 rounded text-[10px] font-mono select-all">{webhookUrl}</code></li>
                        <li>Usa tu <b>Verify Token</b> elegido en ambos lados para validar.</li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <Label>Page ID</Label>
                      <Input
                        value={messengerForm.pageId}
                        onChange={(e) => setMessengerForm({ ...messengerForm, pageId: e.target.value })}
                        placeholder="123456789012345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Token</Label>
                      <Input
                        type="password"
                        value={messengerForm.accessToken}
                        onChange={(e) => setMessengerForm({ ...messengerForm, accessToken: e.target.value })}
                        placeholder="EAA..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Verify Token</Label>
                      <Input
                        value={messengerForm.verifyToken}
                        onChange={(e) => setMessengerForm({ ...messengerForm, verifyToken: e.target.value })}
                        placeholder="mi_token_secreto"
                      />
                    </div>
                    <Button onClick={handleSaveMessenger} disabled={loading} className="w-full">
                      Guardar y Conectar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Instagram Direct */}
        <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-pink-500" />
              Instagram Direct
            </CardTitle>
            <CardDescription>Integración con Instagram Direct via Graph API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {metaConnection?.instagramConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-white">Conectado</span>
                  </>
                ) : metaConnection?.instagramEnabled ? (
                  <>
                    <Wifi className="h-5 w-5 text-yellow-500" />
                    <span className="text-sm font-medium text-white">Configurado (no conectado)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">No configurado</span>
                  </>
                )}
              </div>
            </div>
            {metaConnection?.instagramEnabled ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Account ID: {metaConnection.instagramAccountId || 'No configurado'}
                </p>
                <div className="flex gap-2">
                  <Dialog open={instagramDialogOpen} onOpenChange={setInstagramDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Settings className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                      <DialogHeader>
                        <DialogTitle>Configurar Instagram Direct</DialogTitle>
                        <DialogDescription>
                          Ingresa las credenciales de tu cuenta de Instagram Business para conectar Instagram Direct.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Instagram Business Account ID</Label>
                          <Input
                            value={instagramForm.accountId}
                            onChange={(e) => setInstagramForm({ ...instagramForm, accountId: e.target.value })}
                            placeholder="17841405309211844"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Access Token</Label>
                          <Input
                            type="password"
                            value={instagramForm.accessToken}
                            onChange={(e) => setInstagramForm({ ...instagramForm, accessToken: e.target.value })}
                            placeholder="EAA..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveInstagram} disabled={loading} className="flex-1">
                            Guardar
                          </Button>
                          <Button onClick={handleDisconnectInstagram} variant="destructive" disabled={loading}>
                            Desconectar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <Dialog open={instagramDialogOpen} onOpenChange={setInstagramDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Conectar con Instagram
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                  <DialogHeader>
                    <DialogTitle>Configurar Instagram Direct</DialogTitle>
                    <DialogDescription>
                      Ingresa las credenciales de tu cuenta de Instagram Business para conectar Instagram Direct.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Instagram Business Account ID</Label>
                      <Input
                        value={instagramForm.accountId}
                        onChange={(e) => setInstagramForm({ ...instagramForm, accountId: e.target.value })}
                        placeholder="17841405309211844"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Token</Label>
                      <Input
                        type="password"
                        value={instagramForm.accessToken}
                        onChange={(e) => setInstagramForm({ ...instagramForm, accessToken: e.target.value })}
                        placeholder="EAA..."
                      />
                    </div>
                    <Button onClick={handleSaveInstagram} disabled={loading} className="w-full">
                      Guardar y Conectar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Telegram Bot */}
        <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              Telegram Bot
            </CardTitle>
            <CardDescription>Conecta tu bot oficial via BotFather</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {telegramBotStatus ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-white">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">No configurado</span>
                  </>
                )}
              </div>
            </div>
            <Dialog open={telegramBotDialogOpen} onOpenChange={setTelegramBotDialogOpen}>
              <DialogTrigger asChild>
                <Button variant={telegramBotStatus ? "outline" : "default"} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  {telegramBotStatus ? 'Gestionar Bot' : 'Conectar Telegram Bot'}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-lg">
                <DialogHeader>
                  <DialogTitle>Configurar Telegram Bot</DialogTitle>
                  <DialogDescription>Ingresa el Token de tu bot obtenido de @BotFather.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-1.5 text-xs text-blue-200">
                    <p className="font-bold uppercase tracking-wider text-[10px] text-blue-400">📖 Guía de configuración:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Abre Telegram y busca a <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline text-blue-300">@BotFather</a>.</li>
                      <li>Envía <code className="bg-slate-900/60 px-1 py-0.5 rounded text-[10px] font-mono">/newbot</code> y sigue las instrucciones para crear tu bot.</li>
                      <li>Copia el <b>HTTP API Token</b> generado y pégalo abajo.</li>
                      <li>El sistema registrará el webhook de forma automática tras guardar.</li>
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <Label>Bot Token</Label>
                    <Input
                      type="password"
                      value={telegramBotForm.token}
                      onChange={(e) => setTelegramBotForm({ token: e.target.value })}
                      placeholder="123456789:ABCDEF..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveTelegramBot} disabled={loading} className="flex-1">
                      Guardar
                    </Button>
                    {telegramBotStatus && (
                      <Button onClick={handleDisconnectTelegramBot} variant="destructive" disabled={loading}>
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Telegram Personal */}
        <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              Telegram Personal (Userbot)
            </CardTitle>
            <CardDescription>Usa tu cuenta personal como bot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {telegramPersonalStatus ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-white">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">No configurado</span>
                  </>
                )}
              </div>
            </div>
            <Dialog open={telegramPersonalDialogOpen} onOpenChange={setTelegramPersonalDialogOpen}>
              <DialogTrigger asChild>
                <Button variant={telegramPersonalStatus ? "outline" : "default"} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  {telegramPersonalStatus ? 'Gestionar Personal' : 'Conectar Cuenta Personal'}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                <DialogHeader>
                  <DialogTitle>Configurar Telegram Personal</DialogTitle>
                  <DialogDescription>Requiere API ID y API Hash de my.telegram.org</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={telegramPersonalForm.phone}
                      onChange={(e) => setTelegramPersonalForm({ ...telegramPersonalForm, phone: e.target.value })}
                      placeholder="+569..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API ID</Label>
                    <Input
                      value={telegramPersonalForm.apiId}
                      onChange={(e) => setTelegramPersonalForm({ ...telegramPersonalForm, apiId: e.target.value })}
                      placeholder="1234567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Hash</Label>
                    <Input
                      value={telegramPersonalForm.apiHash}
                      onChange={(e) => setTelegramPersonalForm({ ...telegramPersonalForm, apiHash: e.target.value })}
                      placeholder="abcdef123456..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleStartTelegramPersonal} disabled={loading} className="flex-1">
                      Iniciar Conexión
                    </Button>
                    {telegramPersonalStatus && (
                      <Button onClick={handleDisconnectTelegramPersonal} variant="destructive" disabled={loading}>
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={telegramVerifyDialogOpen} onOpenChange={setTelegramVerifyDialogOpen}>
              <DialogContent className="bg-[#0a0b10] border-white/10 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                <DialogHeader>
                  <DialogTitle>Verificación Telegram</DialogTitle>
                  <DialogDescription>Ingresa el código que recibiste en tu aplicación de Telegram.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input
                      value={telegramVerifyCode}
                      onChange={(e) => setTelegramVerifyCode(e.target.value)}
                      placeholder="12345"
                    />
                  </div>
                  <Button onClick={handleVerifyTelegramPersonal} disabled={loading} className="w-full">
                    Verificar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-luxury-glass border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] text-slate-100">
        <CardHeader>
          <CardTitle className="text-base">ℹ️ Información</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <strong>WhatsApp Business API:</strong> Requiere una cuenta oficial de WhatsApp Business API. Configura las credenciales en la sección de Configuración.
            </p>
            <p>
              <strong>WhatsApp Web:</strong> Integración manual que requiere mantener una sesión activa. Configura en la sección de Configuración.
            </p>
            <p>
              <strong>Facebook Messenger:</strong> Requiere una página de Facebook y un token de acceso. Obtén las credenciales desde{' '}
              <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Facebook Developers
              </a>.
            </p>
            <p>
              <strong>Instagram Direct:</strong> Requiere una cuenta de Instagram Business conectada a una página de Facebook. Obtén las credenciales desde{' '}
              <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Facebook Developers
              </a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

