'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { businessApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Building2, Plus, Settings, Trash2, Edit } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const industryTypes = [
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'CLINIC', label: 'Clínica / Salud' },
  { value: 'REAL_ESTATE', label: 'Bienes Raíces' },
  { value: 'ACADEMY', label: 'Academia / Educación' },
  { value: 'RETAIL', label: 'Retail / Comercio' },
  { value: 'SERVICES', label: 'Servicios' },
  { value: 'OTHER', label: 'Otro' },
]

export default function BusinessesPage() {
  const { toast } = useToast()
  const { selectedBusiness, setSelectedBusiness } = useBusinessStore()
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    industryType: 'RETAIL',
    categories: [''],
    description: '',
    phone: '',
    email: '',
    address: '',
  })

  const loadBusinesses = useCallback(async () => {
    try {
      const response = await businessApi.getAll()
      setBusinesses(Array.isArray(response.data) ? response.data : [])
    } catch (error: any) {
      toast({
        title: 'No se pudieron cargar los negocios',
        description: error.response?.data?.message || 'Revisa tu sesión y la conexión con el backend.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Limpiar campos vacíos antes de enviar
    const cleanedData = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0 && value.some(v => v.trim() !== '')
        return value !== undefined && value !== null && value.toString().trim() !== ''
      })
    )
    try {
      if (editingBusiness) {
        await businessApi.update(editingBusiness.id, cleanedData)
        toast({
          title: 'Negocio actualizado',
          description: 'El negocio se actualizó correctamente',
        })
      } else {
        await businessApi.create(cleanedData)
        toast({
          title: 'Negocio creado',
          description: 'El negocio se creó correctamente',
        })
      }

      setDialogOpen(false)
      setEditingBusiness(null)
      setFormData({
        name: '',
        industryType: 'RETAIL',
        categories: [''],
        description: '',
        phone: '',
        email: '',
        address: '',
      })
      void loadBusinesses()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo guardar el negocio',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (business: any) => {
    setEditingBusiness(business)
    setFormData({
      name: business.name,
      industryType: business.industryType,
      categories: business.categories && business.categories.length > 0 ? business.categories : [''],
      description: business.description || '',
      phone: business.phone || '',
      email: business.email || '',
      address: business.address || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este negocio?')) return

    try {
      await businessApi.delete(id)
      toast({
        title: 'Negocio eliminado',
        description: 'El negocio se eliminó correctamente',
      })
      if (selectedBusiness?.id === id) {
        setSelectedBusiness(null)
      }
      void loadBusinesses()
    } catch (error: any) {
      toast({
        title: 'No se pudo eliminar el negocio',
        description: error.response?.data?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      })
    }
  }

  const handleSelect = (business: any) => {
    setSelectedBusiness(business)
    toast({
      title: 'Negocio seleccionado',
      description: `Ahora estás trabajando con ${business.name}`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Negocios</h1>
          <p className="text-gray-600 mt-1">Gestiona tus negocios y configuraciones</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingBusiness(null)
                setFormData({ name: '', industryType: 'RETAIL', categories: [''], description: '', phone: '', email: '', address: '' })
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Negocio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBusiness ? 'Editar Negocio' : 'Crear Nuevo Negocio'}</DialogTitle>
              <DialogDescription>Completa la información del negocio</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Negocio *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industryType">Tipo de Industria *</Label>
                <Select value={formData.industryType} onValueChange={(value) => setFormData({ ...formData, industryType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {industryTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categories">Categorías *</Label>
                <Input
                  id="categories"
                  value={formData.categories.join(', ')}
                  onChange={(e) => {
                    const categories = e.target.value.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0)
                    setFormData({ ...formData, categories: categories.length > 0 ? categories : [''] })
                  }}
                  placeholder="Ej: Pizzas, Pastas, Bebidas"
                  required
                />
                <p className="text-xs text-gray-500">Ingresa las categorías separadas por comas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {editingBusiness ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && businesses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : businesses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay negocios</h3>
            <p className="text-gray-600 mb-4">Crea tu primer negocio para comenzar</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Negocio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <Card
              key={business.id}
              className={`hover:shadow-lg transition-shadow ${selectedBusiness?.id === business.id ? 'ring-2 ring-primary' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="w-5 h-5" />
                      <span>{business.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">{industryTypes.find((t) => t.value === business.industryType)?.label}</CardDescription>
                  </div>
                  {selectedBusiness?.id === business.id && (
                    <span className="px-2 py-1 text-xs font-medium bg-primary text-white rounded">Activo</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {business.description && <p className="text-sm text-gray-600 mb-4">{business.description}</p>}
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  {business.phone && <p>📞 {business.phone}</p>}
                  {business.email && <p>📧 {business.email}</p>}
                  {business.address && <p>📍 {business.address}</p>}
                </div>
                <div className="flex space-x-2">
                  {selectedBusiness?.id !== business.id && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSelect(business)}>
                      <Settings className="w-4 h-4 mr-1" />
                      Seleccionar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleEdit(business)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(business.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
