"use client"

import { useState, useEffect } from "react"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

export default function NotificationsPage() {
    const { toast } = useToast()
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [formData, setFormData] = useState({
        subject: "",
        message: "",
        type: "INFO",
        targetRole: "ALL",
        mediaUrl: "",
        mediaType: "NONE",
    })

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        try {
            const data = await adminApi.getNotifications()
            setHistory(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSend = async () => {
        if (!formData.subject || !formData.message) {
            toast({
                title: "Error",
                description: "Completa todos los campos",
                variant: "destructive",
            })
            return
        }

        try {
            await adminApi.broadcastNotification({
                ...formData,
                targetRole: formData.targetRole === "ALL" ? undefined : formData.targetRole,
                mediaUrl: formData.mediaType !== "NONE" ? formData.mediaUrl : undefined,
                mediaType: formData.mediaType !== "NONE" ? formData.mediaType : undefined,
            })
            toast({
                title: "Éxito",
                description: "Notificación enviada a todos los usuarios seleccionados.",
            })
            setFormData({
                subject: "",
                message: "",
                type: "INFO",
                targetRole: "ALL",
                mediaUrl: "",
                mediaType: "NONE",
            })
            loadHistory()
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo enviar la notificación",
                variant: "destructive",
            })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Notificaciones Globales</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Enviar Notificación Masiva</CardTitle>
                        <CardDescription>Envía mensajes importantes a todos los usuarios o roles específicos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label>Asunto</label>
                            <Input
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="Ej: Mantenimiento Programado"
                            />
                        </div>
                        <div className="space-y-2">
                            <label>Mensaje</label>
                            <Textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                placeholder="Escribe el contenido del mensaje..."
                                rows={5}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label>Tipo</label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INFO">Información</SelectItem>
                                        <SelectItem value="WARNING">Advertencia</SelectItem>
                                        <SelectItem value="CRITICAL">Crítico</SelectItem>
                                        <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label>Destinatarios</label>
                                <Select
                                    value={formData.targetRole}
                                    onValueChange={(val) => setFormData({ ...formData, targetRole: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todos los Usuarios</SelectItem>
                                        <SelectItem value="BUSINESS_OWNER">Dueños de Negocio</SelectItem>
                                        <SelectItem value="ADMIN">Administradores</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                            <label className="text-sm font-medium">Contenido Multimedia (Opcional)</label>
                            <div className="grid grid-cols-3 gap-4">
                                <Select
                                    value={formData.mediaType}
                                    onValueChange={(val) => setFormData({ ...formData, mediaType: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Sin Multimedia</SelectItem>
                                        <SelectItem value="IMAGE">Imagen</SelectItem>
                                        <SelectItem value="VIDEO">Video</SelectItem>
                                        <SelectItem value="AUDIO">Audio</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input
                                    className="col-span-2"
                                    value={formData.mediaUrl}
                                    onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                                    placeholder="URL del archivo (https://...)"
                                    disabled={formData.mediaType === "NONE"}
                                />
                            </div>
                            {formData.mediaType !== "NONE" && (
                                <p className="text-xs text-gray-400">Nota: Asegúrate de que la URL sea pública y accesible directamente.</p>
                            )}
                        </div>
                        <Button className="w-full" onClick={handleSend}>
                            Enviar Notificación
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Envíos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {history.map((notif) => (
                                <div key={notif.id} className="border p-3 rounded-lg flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold">{notif.subject}</h4>
                                        <p className="text-sm text-gray-500 mb-2">{notif.message}</p>
                                        <div className="flex gap-2">
                                            <Badge variant="secondary">{notif.type}</Badge>
                                            <span className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline">{notif.targetRole || "TODOS"}</Badge>
                                </div>
                            ))}
                            {history.length === 0 && <p className="text-center text-gray-500">No hay notificaciones enviadas.</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
