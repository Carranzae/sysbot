'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { filesApi, notificationsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Bell, CheckCircle, Clock, Download, Eye, Paperclip, Trash2, Plus } from 'lucide-react'
import { formatDateTime, formatFileSize } from '@/lib/utils'

type NotificationAttachment = {
  fileId: string
  fileName: string
  mimeType: string | null
  size: number
  fileType: string | null
  downloadPath: string
}

type Notification = {
  id: string
  businessId: string
  title: string
  message: string
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'PUSH'
  recipientId?: string | null
  recipientPhone?: string | null
  recipientEmail?: string | null
  scheduledAt?: string | null
  isSent: boolean
  sentAt?: string | null
  createdAt: string
  updatedAt: string
  attachment?: NotificationAttachment | null
}

const channelLabels = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
  PUSH: 'Push',
}

const channelColors = {
  WHATSAPP: 'bg-green-100 text-green-800',
  EMAIL: 'bg-blue-100 text-blue-800',
  SMS: 'bg-purple-100 text-purple-800',
  PUSH: 'bg-orange-100 text-orange-800',
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      const response = await notificationsApi.getAll(selectedBusiness.id)
      setNotifications(response.data || [])
    } catch (error) {
      console.error('[NotificationsPage] Error loading notifications:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las notificaciones',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness, toast])

  useEffect(() => {
    if (selectedBusiness) {
      loadNotifications()
    }
  }, [selectedBusiness, loadNotifications])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la notificación "${title}"?`)) {
      return
    }

    try {
      await notificationsApi.delete(id)
      toast({
        title: 'Notificación eliminada',
        description: 'La notificación se eliminó correctamente',
      })
      loadNotifications()
    } catch (error) {
      console.error('[NotificationsPage] Error deleting notification:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la notificación',
        variant: 'destructive',
      })
    }
  }

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'pending') return !notification.isSent
    if (filter === 'sent') return notification.isSent
    return true
  })

  const handleDownloadAttachment = async (notification: Notification) => {
    if (!notification.attachment) return

    try {
      setDownloadingId(notification.id)
      const response = await filesApi.download(notification.attachment.fileId)
      const blob = new Blob([response.data], {
        type: notification.attachment.mimeType || response.headers['content-type'] || 'application/octet-stream',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = notification.attachment.fileName || 'archivo'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast({
        title: 'Descarga iniciada',
        description: `Descargando ${notification.attachment.fileName}`,
      })
    } catch (error) {
      console.error('[NotificationsPage] Error downloading attachment:', error)
      toast({
        title: 'Error al descargar',
        description: 'No se pudo descargar el adjunto. Inténtalo nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const renderAttachmentPreview = (notification: Notification) => {
    const attachment = notification.attachment
    if (!attachment) return null

    const isImage = attachment.mimeType?.startsWith('image/')
    const isVideo = attachment.mimeType?.startsWith('video/')
    const isPreviewable = isImage || isVideo

    return (
      <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-white shadow-sm">
            <Paperclip className="h-5 w-5 text-gray-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{attachment.fileName}</p>
            <p className="text-xs text-gray-500">
              {attachment.mimeType || 'Tipo desconocido'} · {formatFileSize(attachment.size)}
            </p>
          </div>
          <div className="flex gap-2">
            {isPreviewable && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownloadAttachment(notification)}
                disabled={downloadingId === notification.id}
                className="gap-1"
              >
                <Eye className="h-4 w-4" />
                Ver
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => handleDownloadAttachment(notification)}
              disabled={downloadingId === notification.id}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              {downloadingId === notification.id ? 'Descargando...' : 'Descargar'}
            </Button>
          </div>
        </div>

        {isImage && (
          <div className="mt-4 overflow-hidden rounded-lg border bg-white">
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}${attachment.downloadPath}`}
              alt={attachment.fileName}
              className="max-h-64 w-full object-contain bg-gray-100"
            />
          </div>
        )}

        {isVideo && (
          <div className="mt-4 overflow-hidden rounded-lg border bg-black">
            <video
              controls
              className="max-h-72 w-full"
              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}${attachment.downloadPath}`}
            />
          </div>
        )}
      </div>
    )
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Bell className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay negocio seleccionado</h2>
        <p className="text-gray-600 mb-6">Selecciona o crea un negocio para ver las notificaciones</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-600 mt-1">Gestiona las notificaciones programadas y enviadas</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Notificación
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Todas ({notifications.length})
        </Button>
        <Button
          variant={filter === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilter('pending')}
        >
          Pendientes ({notifications.filter(n => !n.isSent).length})
        </Button>
        <Button
          variant={filter === 'sent' ? 'default' : 'outline'}
          onClick={() => setFilter('sent')}
        >
          Enviadas ({notifications.filter(n => n.isSent).length})
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay notificaciones</h3>
            <p className="text-gray-600 text-center">
              {filter === 'all'
                ? 'Aún no has creado ninguna notificación'
                : filter === 'pending'
                ? 'No hay notificaciones pendientes'
                : 'No hay notificaciones enviadas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNotifications.map((notification) => (
            <Card key={notification.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${channelColors[notification.channel]}`}
                      >
                        {channelLabels[notification.channel]}
                      </span>
                      {notification.isSent ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Enviada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-600 text-sm">
                          <Clock className="w-4 h-4" />
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(notification.id, notification.title)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">{notification.message}</p>
                {renderAttachmentPreview(notification)}
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  {notification.recipientPhone && (
                    <div>
                      <span className="font-medium">Teléfono:</span> {notification.recipientPhone}
                    </div>
                  )}
                  {notification.recipientEmail && (
                    <div>
                      <span className="font-medium">Email:</span> {notification.recipientEmail}
                    </div>
                  )}
                  {notification.scheduledAt && (
                    <div>
                      <span className="font-medium">Programada para:</span>{' '}
                      {formatDateTime(notification.scheduledAt)}
                    </div>
                  )}
                  {notification.sentAt && (
                    <div>
                      <span className="font-medium">Enviada el:</span>{' '}
                      {formatDateTime(notification.sentAt)}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Creada:</span>{' '}
                    {formatDateTime(notification.createdAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}










