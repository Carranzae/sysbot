'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { businessApi } from '@/lib/api'
import { useBusinessStore } from '@/store/business'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowRight, ArrowLeft, Building2, UtensilsCrossed, Stethoscope, Home, GraduationCap, ShoppingBag, Wrench, Sparkles, Plus, Trash2 } from 'lucide-react'

interface IndustryPreset {
  defaultCategories: string[]
  welcomeTemplate: string
  fallbackTemplate: string
  promptTemplate: string
}

const industryTypes = [
  { value: 'RESTAURANT', label: 'Restaurante', icon: UtensilsCrossed, description: 'Menús, pedidos, reservas de mesa' },
  { value: 'CLINIC', label: 'Clínica / Salud', icon: Stethoscope, description: 'Citas médicas, consultas, pacientes' },
  { value: 'REAL_ESTATE', label: 'Bienes Raíces', icon: Home, description: 'Propiedades, visitas, asesoría' },
  { value: 'ACADEMY', label: 'Academia / Educación', icon: GraduationCap, description: 'Cursos, inscripciones, clases' },
  { value: 'RETAIL', label: 'Retail / Comercio', icon: ShoppingBag, description: 'Productos, ventas, catálogos' },
  { value: 'SERVICES', label: 'Servicios', icon: Wrench, description: 'Servicios profesionales, citas' },
  { value: 'OTHER', label: 'Otro', icon: Building2, description: 'Personaliza según tu negocio' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { setSelectedBusiness } = useBusinessStore()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    industryType: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    categories: [] as string[],
  })
  const [botConfigPreview, setBotConfigPreview] = useState({
    welcomeMessage: '',
    fallbackMessage: '',
    customPrompt: '',
  })
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [industryPresets, setIndustryPresets] = useState<Record<string, IndustryPreset> | null>(null)

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const response = await businessApi.getIndustryPresets()
        setIndustryPresets(response.data?.presets || null)
      } catch (error) {
        console.error('Error fetching industry presets:', error)
      } finally {
        setPresetsLoading(false)
      }
    }

    fetchPresets()
  }, [])

  const selectedPreset: IndustryPreset | null = useMemo(() => {
    if (!industryPresets || !formData.industryType) return null
    return industryPresets[formData.industryType]
  }, [industryPresets, formData.industryType])

  const applyPresetToState = (preset?: IndustryPreset | null, businessName?: string) => {
    if (!preset) return
    const safeName = businessName?.trim() || 'tu negocio'
    setFormData(prev => ({
      ...prev,
      categories: preset.defaultCategories,
    }))
    setBotConfigPreview({
      welcomeMessage: preset.welcomeTemplate.replace('{businessName}', safeName),
      fallbackMessage: preset.fallbackTemplate.replace('{businessName}', safeName),
      customPrompt: preset.promptTemplate.replace('{businessName}', safeName),
    })
  }

  useEffect(() => {
    if (selectedPreset) {
      applyPresetToState(selectedPreset, formData.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset])

  useEffect(() => {
    if (selectedPreset) {
      setBotConfigPreview(prev => ({
        welcomeMessage: prev.welcomeMessage || selectedPreset.welcomeTemplate.replace('{businessName}', formData.name || 'tu negocio'),
        fallbackMessage: prev.fallbackMessage || selectedPreset.fallbackTemplate.replace('{businessName}', formData.name || 'tu negocio'),
        customPrompt: prev.customPrompt || selectedPreset.promptTemplate.replace('{businessName}', formData.name || 'tu negocio'),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.name])

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        toast({
          title: 'Campo requerido',
          description: 'Por favor ingresa el nombre de tu negocio',
          variant: 'destructive',
        })
        return
      }
    } else if (step === 2) {
      if (!formData.industryType) {
        toast({
          title: 'Campo requerido',
          description: 'Por favor selecciona el rubro de tu negocio',
          variant: 'destructive',
        })
        return
      }
    }
    setStep(step + 1)
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.industryType) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const filteredCategories = formData.categories
        .map(c => c.trim())
        .filter(Boolean)
      const categories = filteredCategories.length > 0
        ? filteredCategories
        : selectedPreset?.defaultCategories || [selectedIndustry?.label || 'General']

      const response = await businessApi.createOnboarding({
        name: formData.name,
        industryType: formData.industryType,
        description: formData.description || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        categories: categories,
        welcomeMessage: botConfigPreview.welcomeMessage || undefined,
        fallbackMessage: botConfigPreview.fallbackMessage || undefined,
        customPrompt: botConfigPreview.customPrompt || undefined,
      })

      const business = response.data
      setSelectedBusiness(business)

      toast({
        title: '¡Bienvenido!',
        description: 'Tu negocio ha sido configurado exitosamente',
      })

      router.push('/dashboard')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear el negocio',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedIndustry = industryTypes.find(i => i.value === formData.industryType)

  const handleIndustrySelect = (industryValue: string) => {
    setFormData(prev => ({
      ...prev,
      industryType: industryValue,
      categories: industryPresets?.[industryValue]?.defaultCategories || prev.categories,
    }))
    applyPresetToState(industryPresets?.[industryValue], formData.name)
  }

  const handleCategoryChange = (index: number, value: string) => {
    setFormData(prev => {
      const updated = [...prev.categories]
      updated[index] = value
      return { ...prev, categories: updated }
    })
  }

  const handleAddCategory = () => {
    setFormData(prev => ({ ...prev, categories: [...prev.categories, ''] }))
  }

  const handleRemoveCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-100 p-3">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Configura tu Negocio</CardTitle>
          <CardDescription>
            Paso {step} de 3 - Configuraremos todo según tu rubro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Paso 1: Información Básica */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Negocio *</Label>
                <Input
                  id="name"
                  placeholder="Nombre oficial de tu negocio"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <Input
                  id="description"
                  placeholder="Breve descripción de tu negocio"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Teléfono (Opcional)</Label>
                  <Input
                    id="phone"
                    placeholder="+51 900 000 000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email (Opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ejemplo@tuempresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Dirección (Opcional)</Label>
                <Input
                  id="address"
                  placeholder="Dirección del negocio"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Paso 2: Selección de Rubro */}
          {step === 2 && (
            <div className="space-y-4">
              <Label>Selecciona el Rubro de tu Negocio *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {industryTypes.map((industry) => {
                  const Icon = industry.icon
                  const isSelected = formData.industryType === industry.value
                  return (
                    <button
                      key={industry.value}
                      type="button"
                      onClick={() => handleIndustrySelect(industry.value)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-6 w-6 mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div>
                          <div className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {industry.label}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">{industry.description}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedIndustry && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold mb-2">
                    <Sparkles className="h-4 w-4" />
                    El sistema se adaptará a: {selectedIndustry.label}
                  </div>
                  <p className="text-sm text-blue-700">
                    {selectedIndustry.description}
                  </p>
                  {presetsLoading ? (
                    <p className="text-sm text-blue-900 mt-3">Cargando configuraciones del rubro...</p>
                  ) : (
                    <div className="mt-4 space-y-2 text-sm text-blue-900">
                      <p className="font-semibold">Categorías sugeridas:</p>
                      <p>{selectedPreset?.defaultCategories?.join(', ') || 'Sin categorías disponibles'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Resumen */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-900 font-semibold mb-2">
                  <Sparkles className="h-4 w-4" />
                  ¡Casi listo!
                </div>
                <p className="text-sm text-green-700">
                  Revisa la información y confirma para crear tu negocio
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-gray-500">Nombre del Negocio</Label>
                  <p className="font-semibold">{formData.name}</p>
                </div>
                {formData.description && (
                  <div>
                    <Label className="text-gray-500">Descripción</Label>
                    <p>{formData.description}</p>
                  </div>
                )}
                <div>
                  <Label className="text-gray-500">Rubro</Label>
                  <p className="font-semibold">
                    {selectedIndustry?.label || formData.industryType}
                  </p>
                </div>
                {(formData.phone || formData.email || formData.address) && (
                  <div className="grid grid-cols-2 gap-3">
                    {formData.phone && (
                      <div>
                        <Label className="text-gray-500">Teléfono</Label>
                        <p>{formData.phone}</p>
                      </div>
                    )}
                    {formData.email && (
                      <div>
                        <Label className="text-gray-500">Email</Label>
                        <p>{formData.email}</p>
                      </div>
                    )}
                    {formData.address && (
                      <div className="col-span-2">
                        <Label className="text-gray-500">Dirección</Label>
                        <p>{formData.address}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-gray-500">Categorías del Bot</Label>
                  {formData.categories.map((category, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={category}
                        onChange={(e) => handleCategoryChange(index, e.target.value)}
                        placeholder={`Categoría ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCategory(index)}
                        disabled={formData.categories.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCategory}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar categoría
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-gray-500">Mensaje de bienvenida</Label>
                    <Textarea
                      value={botConfigPreview.welcomeMessage}
                      onChange={(e) => setBotConfigPreview(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                      rows={4}
                      placeholder="Mensaje inicial que recibirá el cliente"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-500">Mensaje de fallback</Label>
                    <Textarea
                      value={botConfigPreview.fallbackMessage}
                      onChange={(e) => setBotConfigPreview(prev => ({ ...prev, fallbackMessage: e.target.value }))}
                      rows={3}
                      placeholder="Mensaje cuando nadie atiende"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-500">Prompt personalizado (opcional)</Label>
                    <Textarea
                      value={botConfigPreview.customPrompt}
                      onChange={(e) => setBotConfigPreview(prev => ({ ...prev, customPrompt: e.target.value }))}
                      rows={4}
                      placeholder="Describe cómo debe responder la IA en este negocio"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de Navegación */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext} disabled={loading}>
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Crear Negocio
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

