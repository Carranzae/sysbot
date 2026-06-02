'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { appointmentsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Clock, User, Phone, Building2, CheckCircle, XCircle, RefreshCw, Stethoscope, UserCircle, Trash2 } from 'lucide-react'
import Link from 'next/link'


const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
}

const statusLabels = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

const originLabels: Record<string, { label: string; color: string }> = {
  BOT: { label: 'Bot', color: 'bg-purple-100 text-purple-700' },
  MANUAL: { label: 'Manual', color: 'bg-blue-100 text-blue-800' },
  ADMIN: { label: 'Admin', color: 'bg-slate-200 text-slate-800' },
}

export default function AppointmentsPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const buildEmptyForm = () => ({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    appointmentDate: '',
    duration: '60',
    specialty: '',
    specialist: '',
    notes: '',
    status: 'PENDING',
  })

  const [createForm, setCreateForm] = useState(buildEmptyForm)

  const resetCreateForm = () => setCreateForm(buildEmptyForm())

  const loadAppointments = useCallback(async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      console.log(`[AppointmentsPage] Loading appointments for businessId: ${selectedBusiness.id}`)
      const response = await appointmentsApi.getAll(selectedBusiness.id)
      console.log(`[AppointmentsPage] Received ${response.data?.length || 0} appointments:`, response.data)
      setAppointments(response.data || [])
    } catch (error) {
      console.error('[AppointmentsPage] Error loading appointments:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las citas',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness, toast])

  useEffect(() => {
    if (selectedBusiness) {
      loadAppointments()
      // Actualizar automáticamente cada 30 segundos para ver nuevas citas
      const interval = setInterval(() => {
        loadAppointments()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [selectedBusiness, loadAppointments])

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await appointmentsApi.update(id, { status })
      toast({
        title: 'Cita actualizada',
        description: 'El estado de la cita se actualizó correctamente',
      })
      loadAppointments()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la cita',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string, customerName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la cita de ${customerName}? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await appointmentsApi.delete(id)
      toast({
        title: 'Cita eliminada',
        description: 'La cita se eliminó correctamente',
      })
      loadAppointments()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita',
        variant: 'destructive',
      })
    }
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'all') return true
    return apt.status === filter
  })

  const upcomingAppointments = appointments.filter(
    (apt) => apt.status === 'CONFIRMED' && new Date(apt.appointmentDate) > new Date()
  )

  const handleCreateAppointment = async () => {
    if (!selectedBusiness) return

    if (!createForm.customerName || !createForm.customerPhone || !createForm.appointmentDate) {
      toast({
        title: 'Completa los campos requeridos',
        description: 'Nombre del cliente, teléfono y fecha/hora son obligatorios.',
        variant: 'destructive',
      })
      return
    }

    const appointmentDate = new Date(createForm.appointmentDate)
    if (Number.isNaN(appointmentDate.getTime())) {
      toast({
        title: 'Fecha inválida',
        description: 'Ingresa una fecha y hora válidas.',
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)
    try {
      await appointmentsApi.create(selectedBusiness.id, {
        customerName: createForm.customerName,
        customerPhone: createForm.customerPhone,
        customerEmail: createForm.customerEmail || undefined,
        appointmentDate: appointmentDate.toISOString(),
        duration: Number(createForm.duration) || 60,
        specialty: createForm.specialty || undefined,
        specialist: createForm.specialist || undefined,
        notes: createForm.notes || undefined,
        status: createForm.status,
        origin: 'MANUAL',
      })
      toast({
        title: 'Cita creada',
        description: 'Registramos la cita manualmente.',
      })
      resetCreateForm()
      setIsCreateOpen(false)
      loadAppointments()
    } catch (error) {
      toast({
        title: 'Error al crear cita',
        description: 'Revisa los datos o intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay negocio seleccionado</h2>
        <p className="text-gray-600 mb-6">Selecciona un negocio para ver citas</p>
        <Link href="/businesses">
          <Button>Ir a Negocios</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Citas</h1>
        <p className="text-gray-600 mt-1">Gestiona las citas de tus clientes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Próximas Citas</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {upcomingAppointments.length}
                </p>
              </div>
              <Calendar className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {appointments.filter((a) => a.status === 'PENDING').length}
                </p>
              </div>
              <Clock className="w-10 h-10 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completadas</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {appointments.filter((a) => a.status === 'COMPLETED').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Todas las Citas</CardTitle>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setIsCreateOpen(true)} size="sm">
                Nueva cita
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAppointments}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <div className="flex space-x-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  Todas
                </Button>
                <Button
                  variant={filter === 'PENDING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('PENDING')}
                >
                  Pendientes
                </Button>
                <Button
                  variant={filter === 'CONFIRMED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('CONFIRMED')}
                >
                  Confirmadas
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando citas...</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay citas</h3>
              <p className="text-gray-600">Las citas aparecerán aquí cuando los clientes las agenden</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            statusColors[apt.status as keyof typeof statusColors]
                          }`}
                        >
                          {statusLabels[apt.status as keyof typeof statusLabels]}
                        </span>
                        {apt.origin && originLabels[apt.origin] && (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${originLabels[apt.origin].color}`}
                          >
                            {originLabels[apt.origin].label}
                          </span>
                        )}
                      </div>
                      
                      {/* Fecha y Hora de Atención - Destacado */}
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                        <div className="flex items-center space-x-2 text-sm font-semibold text-blue-900 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span>Fecha y Hora de Atención</span>
                        </div>
                        <div className="text-base font-bold text-blue-800">
                          {new Intl.DateTimeFormat('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }).format(new Date(apt.appointmentDate))}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-700">
                            {new Intl.DateTimeFormat('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            }).format(new Date(apt.appointmentDate))}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {/* Información del Cliente */}
                        <div className="border-b border-gray-100 pb-2">
                          <div className="flex items-center space-x-2 text-sm mb-1.5">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-gray-700">Cliente:</span>
                            <span className="font-medium text-gray-900">{apt.customerName}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{apt.customerPhone}</span>
                          </div>
                        </div>

                        {/* Especialidad */}
                        {apt.specialty && (
                          <div className="flex items-center space-x-2 text-sm">
                            <Stethoscope className="w-4 h-4 text-purple-500" />
                            <span className="font-semibold text-gray-700">Especialidad:</span>
                            <span className="font-medium text-purple-700">{apt.specialty}</span>
                          </div>
                        )}

                        {/* Especialista */}
                        {apt.specialist && (
                          <div className="flex items-center space-x-2 text-sm">
                            <UserCircle className="w-4 h-4 text-indigo-500" />
                            <span className="font-semibold text-gray-700">Especialista:</span>
                            <span className="font-medium text-indigo-700">{apt.specialist}</span>
                          </div>
                        )}

                        {/* Duración */}
                        {apt.duration && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Duración estimada: <span className="font-medium">{apt.duration} minutos</span></span>
                          </div>
                        )}

                        {/* Notas */}
                        {apt.notes && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-sm text-gray-600 italic">{apt.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      {apt.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(apt.id, 'CONFIRMED')}
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {apt.status === 'CONFIRMED' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                          title="Marcar como completada"
                        >
                          Completar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(apt.id, apt.customerName)}
                        title="Eliminar cita"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            resetCreateForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear cita manual</DialogTitle>
            <DialogDescription>Registra una cita para el negocio seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del cliente</Label>
                <Input
                  value={createForm.customerName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Ej. Juan Pérez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={createForm.customerPhone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Ej. +51 999 999 999"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Correo (opcional)</Label>
                <Input
                  type="email"
                  value={createForm.customerEmail}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="cliente@correo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={createForm.status}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                    <SelectItem value="COMPLETED">Completada</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha y hora</Label>
                <Input
                  type="datetime-local"
                  value={createForm.appointmentDate}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Duración (min)</Label>
                <Input
                  type="number"
                  min={15}
                  step={5}
                  value={createForm.duration}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, duration: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Especialidad (opcional)</Label>
                <Input
                  value={createForm.specialty}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, specialty: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Especialista (opcional)</Label>
                <Input
                  value={createForm.specialist}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, specialist: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Comentarios adicionales para la cita"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateAppointment} disabled={isCreating}>
              {isCreating ? 'Guardando…' : 'Crear cita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
