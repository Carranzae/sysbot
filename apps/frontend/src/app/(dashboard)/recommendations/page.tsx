'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Upload,
  CalendarClock,
  Filter,
  Users,
  History,
  Download,
  PlayCircle,
  Sparkles,
  Mail,
  Smartphone,
  Tablet,
  RefreshCw,
  Copy,
  Send,
  Trash,
  Paperclip,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBusinessStore } from '@/store/business'
import { getRecommendationConfig, RecommendationChannel, type RecommendationTemplate } from '@/lib/recommendations'
import { cn, formatFileSize } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { contactsApi, campaignsApi, whatsappApi, businessApi, filesApi } from '@/lib/api'

const contactFilters = [
  { id: 'all', label: 'Todos' },
  { id: 'asked', label: 'Solo preguntaron' },
  { id: 'clients', label: 'Clientes activos' },
  { id: 'leads', label: 'Leads nuevos' },
]

const channelMeta: Record<RecommendationChannel, { label: string; helper: string }> = {
  whatsapp: {
    label: 'WhatsApp',
    helper: 'Requiere número con WhatsApp activo',
  },
  email: {
    label: 'Email',
    helper: 'Usa correo válido del contacto',
  },
  sms: {
    label: 'SMS',
    helper: 'Necesita celular apto para SMS',
  },
  push: {
    label: 'Push',
    helper: 'Solo contactos con token de app',
  },
  facebook: {
    label: 'Facebook',
    helper: 'Publicación en Feed o Reels',
  },
  instagram: {
    label: 'Instagram',
    helper: 'Publicación en Feed o Reels',
  },
  tiktok: {
    label: 'TikTok',
    helper: 'Publicación de video',
  },
  youtube: {
    label: 'YouTube',
    helper: 'YouTube Shorts o Video',
  },
  linkedin: {
    label: 'LinkedIn',
    helper: 'Publicación profesional',
  },
  messenger: {
    label: 'Messenger (DM)',
    helper: 'Mensaje Directo de Facebook',
  },
  instagram_dm: {
    label: 'Instagram (DM)',
    helper: 'Mensaje Directo de Instagram',
  },
}

type ContactTag = {
  label: string
}

type Contact = {
  id: string
  name?: string | null
  phone: string
  email?: string | null
  source?: string | null
  lastIncomingAt?: string | null
  lastOutgoingAt?: string | null
  createdAt?: string
  updatedAt?: string
  tags?: ContactTag[]
}

type CampaignRecipient = {
  id: string
  contactId: string
  contact: {
    id: string
    name?: string | null
    email?: string | null
  }
}

type Campaign = {
  id: string
  name: string
  subject?: string | null
  channel: string
  status: string
  scheduledAt?: string | null
  createdAt: string
  message: string
  recipients: CampaignRecipient[]
}

type AttachmentFile = {
  id: string
  originalName: string
  mimeType: string
  size: number
  fileType?: string
}

export default function RecommendationsPage() {
  const { toast } = useToast()
  const { selectedBusiness } = useBusinessStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filter, setFilter] = useState('all')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [botConfig, setBotConfig] = useState<any>({})
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)

  const config = useMemo(
    () => getRecommendationConfig(selectedBusiness?.industryType),
    [selectedBusiness?.industryType]
  )

  const [campaignName, setCampaignName] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<RecommendationChannel>(config.allowedChannels[0])
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [campaignSubject, setCampaignSubject] = useState('')

  const isSocialMedia = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'].includes(selectedChannel);

  const normalizedContacts = useMemo(() => {
    return contacts.map((contact) => {
      const tagLabels = (contact.tags || []).map((tag) => tag.label)
      const channel = (contact.source || 'WHATSAPP').toLowerCase()
      const lastInteraction =
        contact.lastIncomingAt || contact.lastOutgoingAt || contact.updatedAt || contact.createdAt || ''
      return {
        ...contact,
        tagLabels,
        channel,
        lastInteraction,
      }
    })
  }, [contacts])

  const getInvalidContacts = useCallback(
    (channel: RecommendationChannel) => {
      const requiredField = channel === 'email' ? 'email' : 'phone'
      const requiredChannel = channel === 'whatsapp' ? 'whatsapp' : channel === 'sms' ? 'sms' : undefined

      return selectedContacts
        .map((contactId) => normalizedContacts.find((contact) => contact.id === contactId))
        .filter((contact): contact is typeof normalizedContacts[number] => Boolean(contact))
        .filter((contact) => {
          if (requiredField === 'email' && !contact.email) return true
          if (requiredField === 'phone' && !contact.phone) return true
          if (requiredChannel && contact.channel !== requiredChannel) return true
          return false
        })
    },
    [normalizedContacts, selectedContacts]
  )

  const incompatibleContacts = useMemo(() => getInvalidContacts(selectedChannel), [getInvalidContacts, selectedChannel])

  const describeChannelRequirement = (channel: RecommendationChannel) => {
    switch (channel) {
      case 'email':
        return 'correo electrónico válido'
      case 'whatsapp':
        return 'número con WhatsApp activo'
      case 'sms':
        return 'número de celular válido (SMS)'
      case 'push':
        return 'token de notificaciones push registrado'
      default:
        return 'datos obligatorios del canal seleccionado'
    }
  }

  const handleApplyTemplate = (template: RecommendationTemplate) => {
    const preferredChannel = template.channelHint.find((channel) => config.allowedChannels.includes(channel))
    if (preferredChannel) {
      setSelectedChannel(preferredChannel)
    }
    if (!campaignName.trim()) {
      setCampaignName(template.title)
    }
    setMessage((prev) => {
      const snippet = `Hola {{nombre}}, ${template.description}`
      if (!prev.trim()) return snippet
      return `${prev.trim()}\n\n${snippet}`
    })
    toast({
      title: 'Plantilla aplicada',
      description: `Cargamos el copy base de "${template.title}". Ajusta los datos antes de enviar.`,
    })
  }

  useEffect(() => {
    setSelectedChannel((prev) => (config.allowedChannels.includes(prev) ? prev : config.allowedChannels[0]))
  }, [config.allowedChannels])

  const filteredContacts = useMemo(() => {
    switch (filter) {
      case 'asked':
        return normalizedContacts.filter((contact) =>
          contact.tagLabels.some((tag) => tag.toLowerCase().includes('pregunt'))
        )
      case 'clients':
        return normalizedContacts.filter((contact) =>
          contact.tagLabels.some((tag) => tag.toLowerCase().includes('client'))
        )
      case 'leads':
        return normalizedContacts.filter((contact) => contact.tagLabels.some((tag) => tag.toLowerCase().includes('lead')))
      default:
        return normalizedContacts
    }
  }, [normalizedContacts, filter])

  const loadContacts = useCallback(async () => {
    if (!selectedBusiness) return
    setContactsLoading(true)
    try {
      const { data } = await contactsApi.getAll(selectedBusiness.id)
      setContacts(data)
    } catch (error: any) {
      toast({
        title: 'No se pudieron cargar los contactos',
        description: error.response?.data?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setContactsLoading(false)
    }
  }, [selectedBusiness, toast])

  const loadCampaigns = useCallback(async () => {
    if (!selectedBusiness) return
    setCampaignsLoading(true)
    try {
      const { data } = await campaignsApi.getAll(selectedBusiness.id)
      setCampaigns(data)
    } catch (error: any) {
      toast({
        title: 'No se pudieron cargar las campañas',
        description: error.response?.data?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setCampaignsLoading(false)
    }
  }, [selectedBusiness, toast])

  const loadConfig = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const { data } = await businessApi.getBotConfig(selectedBusiness.id)
      setBotConfig(data)
    } catch (error: any) {
      // ignore
    }
  }, [selectedBusiness])

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedBusiness || !event.target.files?.length) return
    const file = event.target.files[0]
    setUploadingAttachment(true)
    try {
      const response = await filesApi.upload(selectedBusiness.id, file)
      const uploaded = response.data
      setAttachments((prev) => [uploaded, ...prev])
      toast({
        title: 'Archivo agregado',
        description: `${uploaded.originalName} está listo para enviarse.`,
      })
    } catch (error: any) {
      toast({
        title: 'No se pudo adjuntar',
        description: error.response?.data?.message || 'Revisa el formato o tamaño del archivo.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAttachment(false)
      event.target.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== id))
  }

  const openAttachmentDialog = () => {
    if (!selectedBusiness || uploadingAttachment) {
      if (!selectedBusiness) {
        toast({
          title: 'Selecciona un negocio',
          description: 'Necesitas un negocio activo para adjuntar archivos.',
          variant: 'destructive',
        })
      }
      return
    }
    attachmentInputRef.current?.click()
  }

  useEffect(() => {
    if (!selectedBusiness) {
      setContacts([])
      setCampaigns([])
      setSelectedContacts([])
      return
    }
    loadContacts()
    loadCampaigns()
    loadConfig()
  }, [selectedBusiness, loadContacts, loadCampaigns, loadConfig])

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString()
  }

  const handleExport = () => {
    const exported = contacts.filter((contact) => selectedContacts.includes(contact.id))

    if (!exported.length) {
      toast({
        title: 'Selecciona contactos',
        description: 'Elige al menos un contacto antes de exportar.',
        variant: 'destructive',
      })
      return
    }

    const header = ['Nombre', 'Teléfono', 'Correo', 'Canal', 'Etiquetas', 'Última interacción']
    const rows = exported.map((contact) => {
      const normalized = normalizedContacts.find((nc) => nc.id === contact.id)
      const tags = (contact.tags || []).map((tag: any) => tag.label).join(' | ')
      return [
        contact.name ?? '',
        contact.phone ?? '',
        contact.email ?? '',
        (normalized?.channel || contact.source || '').toUpperCase(),
        tags,
        normalized?.lastInteraction ? new Date(normalized.lastInteraction).toLocaleString() : '',
      ]
    })

    const csvContent = [header, ...rows]
      .map((row) => row.map((value) => `"${(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `contactos-${selectedBusiness?.name || 'negocio'}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    toast({
      title: 'Exportación lista',
      description: `Descargaste ${exported.length} contacto(s) en CSV (compatible con Excel).`,
    })
  }

  const handleSend = async () => {
    if (!selectedBusiness) {
      toast({
        title: 'Selecciona un negocio',
        description: 'Necesitas elegir un negocio antes de enviar recomendaciones.',
        variant: 'destructive',
      })
      return
    }
    if (!selectedChannel) {
      toast({
        title: 'Selecciona un canal',
        description: 'Define un canal de envío antes de continuar.',
        variant: 'destructive',
      })
      return
    }

    if (isSocialMedia) {
      // Redirigir a la página de Redes con los datos pre-cargados (vía localStorage o estado global)
      // Para simplificar, guardaremos el texto en sessionStorage y redirigimos
      sessionStorage.setItem('botSaaS_draftPost_caption', message);
      sessionStorage.setItem('botSaaS_draftPost_platforms', JSON.stringify([selectedChannel]));
      
      toast({
        title: 'Preparando publicación',
        description: 'Redirigiendo al orquestador de redes sociales...',
      })
      
      setTimeout(() => {
        window.location.href = `/redes?create=true`;
      }, 1000);
      return;
    }

    if (!selectedContacts.length) {
      toast({
        title: 'Selecciona al menos un contacto',
        description: 'Elige los destinatarios antes de enviar la campaña.',
        variant: 'destructive',
      })
      return
    }

    const invalidContacts = getInvalidContacts(selectedChannel)
    if (invalidContacts.length) {
      const sampleNames = invalidContacts
        .slice(0, 3)
        .map((contact) => contact.name || contact.phone || 'Contacto')
        .join(', ')
      toast({
        title: 'Revisa los datos de contacto',
        description: `Necesitas ${describeChannelRequirement(selectedChannel)} para ${invalidContacts.length} contacto(s): ${sampleNames}${invalidContacts.length > 3 ? '…' : ''}`,
        variant: 'destructive',
      })
      return
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
    const attachmentLinks = attachments
      .map((file, index) => `• ${file.originalName} (${file.mimeType}) → ${apiBaseUrl}/files/${file.id}/download`)
      .join('\n')

    const messageWithAttachments =
      attachments.length && selectedChannel !== 'whatsapp'
        ? `${message}\n\nArchivos adjuntos:\n${attachmentLinks}`
        : message

    const payload = {
      name: campaignName || 'Campaña sin título',
      subject: campaignSubject || campaignName,
      channel: selectedChannel,
      message: messageWithAttachments,
      scheduledAt: scheduledAt || undefined,
      recipients: selectedContacts.map((contactId) => ({ contactId })),
    }

    setIsSubmitting(true)
    try {
      if (selectedChannel === 'whatsapp') {
        if (attachments.length && botConfig.whatsappMode === 'WHATSAPP_API') {
          toast({
            title: 'Adjuntos no soportados en WhatsApp API',
            description: 'Conecta WhatsApp Web para enviar imágenes, videos o documentos.',
            variant: 'destructive',
          })
          return
        }

        if (botConfig.whatsappMode === 'WHATSAPP_API') {
          const phoneNumberId = botConfig.whatsappPhoneNumberId
          if (!phoneNumberId) {
            toast({
              title: 'Configuración incompleta',
              description: 'Falta configurar el Phone Number ID para WhatsApp.',
              variant: 'destructive',
            })
            return
          }
          for (const contactId of selectedContacts) {
            const contact = contacts.find(c => c.id === contactId)
            if (contact && normalizedContacts.find(nc => nc.id === contactId)?.channel === 'whatsapp') {
              await whatsappApi.sendMessage({
                phoneNumberId,
                to: contact.phone,
                message,
              })
            }
          }
        } else if (botConfig.whatsappMode === 'WHATSAPP_WEB') {
          for (const contactId of selectedContacts) {
            const contact = contacts.find(c => c.id === contactId)
            if (contact && normalizedContacts.find(nc => nc.id === contactId)?.channel === 'whatsapp') {
              await whatsappApi.sendWebMessage(selectedBusiness.id, contact.phone, message)
              if (attachments.length) {
                for (const file of attachments) {
                  const basePayload = {
                    businessId: selectedBusiness.id,
                    to: contact.phone,
                    fileId: file.id,
                    caption: message,
                  }
                  if (file.mimeType?.startsWith('image/')) {
                    await whatsappApi.sendWebImage(basePayload.businessId, basePayload.to, basePayload.fileId, undefined, basePayload.caption)
                  } else if (file.mimeType?.startsWith('video/')) {
                    await whatsappApi.sendWebVideo(basePayload.businessId, basePayload.to, basePayload.fileId, undefined, basePayload.caption)
                  } else if (file.mimeType?.startsWith('audio/')) {
                    await whatsappApi.sendWebAudio(basePayload.businessId, basePayload.to, basePayload.fileId, undefined, false)
                  } else {
                    await whatsappApi.sendWebDocument(basePayload.businessId, basePayload.to, basePayload.fileId, undefined, basePayload.caption)
                  }
                }
              }
            }
          }
        }
      }
      await campaignsApi.create(selectedBusiness.id, payload)
      toast({
        title: scheduledAt ? 'Campaña programada' : 'Campaña enviada',
        description: `Registramos "${payload.name}" con ${selectedContacts.length} destinatario(s).`,
      })
      setCampaignName('')
      setCampaignSubject('')
      setMessage('')
      setScheduledAt('')
      setSelectedContacts([])
      loadCampaigns()
    } catch (error: any) {
      toast({
        title: 'Error al enviar campaña',
        description: error.response?.data?.message || 'Revisa los datos e intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const { data } = await campaignsApi.duplicate(id)
      toast({
        title: 'Campaña duplicada',
        description: `"${data.name}" quedó en borrador.`,
      })
      loadCampaigns()
    } catch (error: any) {
      toast({
        title: 'No se pudo duplicar',
        description: error.response?.data?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      })
    }
  }

  const handleResend = async (id: string) => {
    try {
      const { data } = await campaignsApi.resend(id)
      toast({
        title: 'Reenvío programado',
        description: `"${data.name}" volverá a salir en ${data.channel}.`,
      })
      loadCampaigns()
    } catch (error: any) {
      toast({
        title: 'No se pudo reenviar',
        description: error.response?.data?.message || 'Verifica la campaña.',
        variant: 'destructive',
      })
    }
  }

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((contactId) => contactId !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => setSelectedContacts(normalizedContacts.map((contact) => contact.id))
  const clearSelectedContacts = () => setSelectedContacts([])

  return (
    <div className="space-y-6">
      <section
        className={cn(
          'rounded-3xl border bg-gradient-to-r p-8 text-white shadow-xl',
          config.brandAccent || 'from-indigo-500 via-purple-500 to-pink-500'
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]">Sesión de recomendaciones</p>
            <h1 className="mt-2 text-3xl font-semibold">
              {selectedBusiness?.name || 'Selecciona un negocio'} ·{' '}
              {selectedBusiness?.industryType?.replace('_', ' ') || 'Sin rubro'}
            </h1>
            <p className="mt-2 text-sm text-white/80 max-w-xl">
              Crea campañas adaptadas al rubro. Cada template se ajusta automáticamente al negocio seleccionado,
              incluyendo canales, copy y filtros sugeridos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" className="gap-2">
              <Upload className="h-4 w-4" />
              Subir material
            </Button>
            <Button className="gap-2" onClick={handleSend}>
              <Sparkles className="h-4 w-4" />
              {isSocialMedia ? 'Lanzar a Redes Sociales' : 'Nueva recomendación'}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contenido y programación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="campaign-name">Título de la campaña</Label>
                <Input
                  id="campaign-name"
                  placeholder="Ej. Relanzamiento menú premium"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                />
              </div>
              <div>
                <Label>Canal principal</Label>
                <Select value={selectedChannel} onValueChange={(value) => setSelectedChannel(value as RecommendationChannel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {config.allowedChannels.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {channel.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedChannel === 'whatsapp' && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <Smartphone className="h-3.5 w-3.5" />
                    Motor de envío:
                    {botConfig?.whatsappMode === 'WHATSAPP_API' || botConfig?.whatsappApiEnabled ? (
                      <span className="text-blue-600">API Oficial (Meta)</span>
                    ) : botConfig?.whatsappMode === 'WHATSAPP_WEB' || botConfig?.whatsappWebEnabled ? (
                      <span className="text-emerald-600">Modo Web (Ilimitado)</span>
                    ) : (
                      <span className="text-red-500">No configurado</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Basado en {selectedBusiness?.industryType || 'DEFAULT'} se requerirán:{' '}
              {config.requiredFields.length ? config.requiredFields.join(', ') : 'sin requisitos extra'}
            </p>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Historial reciente</h4>
              {campaignsLoading ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">Cargando campañas...</div>
              ) : campaigns.slice(0, 3).length ? (
                campaigns.slice(0, 3).map((campaign) => (
                  <div key={campaign.id} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{campaign.name}</p>
                        <p className="text-xs text-gray-500">{formatDate(campaign.scheduledAt || campaign.createdAt)}</p>
                        <p className="text-xs text-gray-500">
                          {campaign.recipients?.length || 0} contacto(s){campaign.subject ? ` · ${campaign.subject}` : ''}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          campaign.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-600'
                            : campaign.status === 'SCHEDULED'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {campaign.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">
                  Aún no registras campañas. Crea tu primera recomendación para ver el historial aquí.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      <Card>
        <CardHeader>
          <CardTitle>Plantillas sugeridas ({config.industry})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.defaultTemplates.map((template) => {
            const Icon = template.icon
            return (
              <div
                key={template.id}
                className="rounded-2xl border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{template.title}</p>
                    <p className="text-xs text-gray-500">{template.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {template.channelHint.map((channel) => (
                        <span
                          key={channel}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-600"
                        >
                          {channelMeta[channel as RecommendationChannel]?.label || channel}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>

    {!isSocialMedia && (
    <section className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gestor de contactos</CardTitle>
            <p className="text-sm text-gray-500">
              Filtra y selecciona contactos. Más adelante podrás sincronizar desde CRM / Excel.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSelectAll} disabled={!contacts.length}>
              <Users className="h-4 w-4" />
              Seleccionar todos
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={clearSelectedContacts} disabled={!selectedContacts.length}>
              <RefreshCw className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {contactFilters.map((filterOption) => (
              <Button
                key={filterOption.id}
                size="sm"
                variant={filter === filterOption.id ? 'default' : 'ghost'}
                className={filter === filterOption.id ? 'bg-primary text-white' : 'text-gray-600'}
                onClick={() => setFilter(filterOption.id)}
              >
                <Filter className="mr-1 h-3 w-3" />
                {filterOption.label}
              </Button>
            ))}
          </div>
          <div className="rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">Selección</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Última interacción</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {contactsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                      Cargando contactos...
                    </td>
                  </tr>
                ) : filteredContacts.length ? (
                  filteredContacts.map((contact) => (
                    <tr key={contact.id} className="border-t text-gray-700">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold">{contact.name || contact.phone}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(contact.lastInteraction)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] uppercase text-gray-600">
                          {contact.channel === 'whatsapp' && <Smartphone className="h-3 w-3" />}
                          {contact.channel === 'email' && <Mail className="h-3 w-3" />}
                          {contact.channel === 'push' && <Tablet className="h-3 w-3" />}
                          {contact.channel === 'sms' && <Send className="h-3 w-3" />}
                          {contact.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 text-[11px] uppercase text-gray-500">
                          {contact.tagLabels.map((tag) => (
                            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                      No encontramos contactos con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={handleSend}>
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Procesando...' : `Enviar a ${selectedContacts.length || '...'} contactos`}
            </Button>
            {incompatibleContacts.length > 0 && (
              <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                {incompatibleContacts.length} contacto(s) no cumplen con {describeChannelRequirement(selectedChannel)}. Ajusta su
                información o cambia de canal.
              </div>
            )}
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="ghost" className="gap-2" asChild>
              <Link href="/contacts/importar">
                <Upload className="h-4 w-4" />
                Importar/Actualizar contactos
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial y automatizaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-dashed p-4">
            <p className="text-xs uppercase text-gray-500">Automatizaciones sugeridas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {config.automationPresets.map((preset) => (
                <span key={preset} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {preset.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {campaignsLoading ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">Cargando campañas...</div>
            ) : campaigns.length ? (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{campaign.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(campaign.scheduledAt || campaign.createdAt)}</p>
                      <p className="text-xs text-gray-500">
                        {campaign.recipients?.length || 0} contacto(s){campaign.subject ? ` · ${campaign.subject}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        campaign.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-600'
                          : campaign.status === 'SCHEDULED'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <History className="h-4 w-4" />
                      Ver detalles
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-primary"
                      onClick={() => handleResend(campaign.id)}
                    >
                      <Send className="h-4 w-4" />
                      Reenviar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-primary"
                      onClick={() => handleDuplicate(campaign.id)}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicar
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">
                Aún no registras campañas. Crea tu primera recomendación para ver el historial aquí.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )}
</div>
)
}
