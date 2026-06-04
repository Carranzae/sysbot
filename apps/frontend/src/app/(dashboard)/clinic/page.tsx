'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { clinicApi, appointmentsApi, filesApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Stethoscope,
  DollarSign,
  Calendar,
  Activity,
  Users,
  Plus,
  Save,
  FileText,
  Download,
  Upload,
  Phone,
  CheckCircle,
  XCircle,
  Search,
  ClipboardList,
  RefreshCw,
  Layers,
  ShieldCheck,
  AlertTriangle,
  FileDown
} from 'lucide-react'
import Link from 'next/link'

export default function ClinicDashboardPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)

  // Loading States
  const [loadingWallets, setLoadingWallets] = useState(false)
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [loadingSupplies, setLoadingSupplies] = useState(false)
  const [submittingInvoice, setSubmittingInvoice] = useState(false)
  const [submittingContract, setSubmittingContract] = useState(false)
  const [submittingAppointment, setSubmittingAppointment] = useState(false)
  const [submittingInventory, setSubmittingInventory] = useState(false)
  const [submittingSupplies, setSubmittingSupplies] = useState(false)

  // Data States
  const [wallets, setWallets] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [supplies, setSupplies] = useState<any[]>([])

  // Search & Simulator States
  const [searchDocPhone, setSearchDocPhone] = useState('')
  const [patientDocuments, setPatientDocuments] = useState<any[]>([])
  const [searchingDocs, setSearchingDocs] = useState(false)

  const [slotDate, setSlotDate] = useState('')
  const [slotSpecialty, setSlotSpecialty] = useState('General')
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [searchingSlots, setSearchingSlots] = useState(false)

  const [uploadingLab, setUploadingLab] = useState(false)
  const [labPhone, setLabPhone] = useState('')
  const [labName, setLabName] = useState('')
  const [labDescription, setLabDescription] = useState('')

  // Form States
  const [invoiceForm, setInvoiceForm] = useState({
    medicoId: '',
    amount: '',
    invoiceNumber: ''
  })

  const [contractForm, setContractForm] = useState({
    medicoId: '',
    porcentajeComision: '30',
    montoFijo: '0'
  })

  const [appointmentForm, setAppointmentForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    appointmentDate: '',
    duration: '30',
    specialty: 'General',
    specialist: '',
    notes: 'Agendada desde el HIS simulado'
  })

  const [inventoryForm, setInventoryForm] = useState({
    name: '',
    sku: '',
    stock: '50',
    minStock: '10'
  })

  const [suppliesForm, setSuppliesForm] = useState({
    procedureName: 'Sutura',
    itemSku: '',
    quantity: '1'
  })

  const [procedureDeductName, setProcedureDeductName] = useState('Sutura')
  const [deductingInventory, setDeductingInventory] = useState(false)

  // Fetch Loaders
  const loadWallets = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingWallets(true)
    try {
      const res = await clinicApi.getDoctorsWallet(selectedBusiness.id)
      setWallets(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingWallets(false)
    }
  }, [selectedBusiness])

  const loadContracts = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingContracts(true)
    try {
      const res = await clinicApi.getContracts(selectedBusiness.id)
      setContracts(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingContracts(false)
    }
  }, [selectedBusiness])

  const loadAppointments = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingAppointments(true)
    try {
      const res = await appointmentsApi.getAll(selectedBusiness.id)
      setAppointments(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAppointments(false)
    }
  }, [selectedBusiness])

  const loadInventory = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingInventory(true)
    try {
      const res = await clinicApi.getInventory(selectedBusiness.id)
      setInventory(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingInventory(false)
    }
  }, [selectedBusiness])

  const loadSupplies = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingSupplies(true)
    try {
      const res = await clinicApi.getSupplies(selectedBusiness.id)
      setSupplies(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSupplies(false)
    }
  }, [selectedBusiness])

  // Reload everything clinical
  const reloadAll = useCallback(() => {
    if (!selectedBusiness) return
    loadWallets()
    loadContracts()
    loadAppointments()
    loadInventory()
    loadSupplies()
  }, [selectedBusiness, loadWallets, loadContracts, loadAppointments, loadInventory, loadSupplies])

  useEffect(() => {
    if (selectedBusiness && selectedBusiness.industryType === 'CLINIC') {
      reloadAll()
    }
  }, [selectedBusiness, reloadAll])

  // Submit Handlers
  const handleConfigureContract = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusiness) return
    if (!contractForm.medicoId) {
      toast({ title: 'Error', description: 'Por favor ingresa el ID del médico', variant: 'destructive' })
      return
    }
    setSubmittingContract(true)
    try {
      await clinicApi.configureContract(selectedBusiness.id, {
        medicoId: contractForm.medicoId,
        porcentajeComision: Number(contractForm.porcentajeComision),
        montoFijo: Number(contractForm.montoFijo)
      })
      toast({ title: 'Contrato guardado', description: 'La regla de comisión ha sido configurada.' })
      setContractForm({ medicoId: '', porcentajeComision: '30', montoFijo: '0' })
      loadContracts()
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar el contrato', variant: 'destructive' })
    } finally {
      setSubmittingContract(false)
    }
  }

  const handleRegisterInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusiness) return
    if (!invoiceForm.medicoId || !invoiceForm.amount || !invoiceForm.invoiceNumber) {
      toast({ title: 'Error', description: 'Completa todos los campos requeridos', variant: 'destructive' })
      return
    }
    setSubmittingInvoice(true)
    try {
      const res = await clinicApi.registerInvoice(selectedBusiness.id, {
        medicoId: invoiceForm.medicoId,
        amount: invoiceForm.amount,
        invoiceNumber: invoiceForm.invoiceNumber
      })
      toast({
        title: 'Factura Procesada',
        description: `Comisión liquidada: S/ ${res.data.commission.toFixed(2)}. Nuevo balance: S/ ${res.data.walletBalance.toFixed(2)}`
      })
      setInvoiceForm({ medicoId: '', amount: '', invoiceNumber: '' })
      loadWallets()
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo liquidar la factura', variant: 'destructive' })
    } finally {
      setSubmittingInvoice(false)
    }
  }

  const handleRegisterAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusiness) return
    if (!appointmentForm.customerName || !appointmentForm.customerPhone || !appointmentForm.appointmentDate) {
      toast({ title: 'Error', description: 'Nombre, teléfono y fecha son obligatorios', variant: 'destructive' })
      return
    }
    setSubmittingAppointment(true)
    try {
      await clinicApi.registerAppointmentFromIntegration(selectedBusiness.id, {
        customerName: appointmentForm.customerName,
        customerPhone: appointmentForm.customerPhone,
        customerEmail: appointmentForm.customerEmail || undefined,
        appointmentDate: new Date(appointmentForm.appointmentDate).toISOString(),
        duration: Number(appointmentForm.duration),
        specialty: appointmentForm.specialty,
        specialist: appointmentForm.specialist || undefined,
        notes: appointmentForm.notes
      })
      toast({ title: 'Cita Agendada (Webhook)', description: 'La cita ha sido insertada por el endpoint de integración.' })
      setAppointmentForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        appointmentDate: '',
        duration: '30',
        specialty: 'General',
        specialist: '',
        notes: 'Agendada desde el HIS simulado'
      })
      loadAppointments()
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo agendar la cita', variant: 'destructive' })
    } finally {
      setSubmittingAppointment(false)
    }
  }

  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusiness) return
    if (!inventoryForm.name || !inventoryForm.sku || !inventoryForm.stock) {
      toast({ title: 'Error', description: 'Nombre, SKU y Stock inicial son obligatorios', variant: 'destructive' })
      return
    }
    setSubmittingInventory(true)
    try {
      await clinicApi.configureInventoryItem(selectedBusiness.id, {
        name: inventoryForm.name,
        sku: inventoryForm.sku,
        stock: Number(inventoryForm.stock),
        minStock: Number(inventoryForm.minStock)
      })
      toast({ title: 'Insumo Guardado', description: 'El stock de insumo médico ha sido actualizado.' })
      setInventoryForm({ name: '', sku: '', stock: '50', minStock: '10' })
      loadInventory()
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar el insumo', variant: 'destructive' })
    } finally {
      setSubmittingInventory(false)
    }
  }

  const handleConfigureSupplies = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusiness) return
    if (!suppliesForm.procedureName || !suppliesForm.itemSku || !suppliesForm.quantity) {
      toast({ title: 'Error', description: 'Completa todos los campos obligatorios', variant: 'destructive' })
      return
    }
    setSubmittingSupplies(true)
    try {
      await clinicApi.configureProcedureSupplies(selectedBusiness.id, {
        procedureName: suppliesForm.procedureName,
        itemSku: suppliesForm.itemSku,
        quantity: Number(suppliesForm.quantity)
      })
      toast({ title: 'Receta configurada', description: 'La receta de insumos del procedimiento ha sido guardada.' })
      setSuppliesForm({ procedureName: 'Sutura', itemSku: '', quantity: '1' })
      loadSupplies()
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo configurar la receta', variant: 'destructive' })
    } finally {
      setSubmittingSupplies(false)
    }
  }

  const handleDeductInventory = async () => {
    if (!selectedBusiness || !procedureDeductName) return
    setDeductingInventory(true)
    try {
      const res = await clinicApi.deductInventory(selectedBusiness.id, procedureDeductName)
      if (res.data.success) {
        toast({
          title: 'Stock Descontado',
          description: `Se descontaron los insumos para "${procedureDeductName}". Alertas emitidas: ${res.data.alertsCount}`
        })
      } else {
        toast({
          title: 'Aviso',
          description: `No se descontaron insumos. Razón: ${res.data.reason}`,
          variant: 'destructive'
        })
      }
      loadInventory()
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al descontar inventario', variant: 'destructive' })
    } finally {
      setDeductingInventory(false)
    }
  }

  // Patient Document Searcher
  const handleSearchPatientDocs = async () => {
    if (!selectedBusiness || !searchDocPhone) return
    setSearchingDocs(true)
    try {
      const res = await clinicApi.getPatientDocuments(selectedBusiness.id, searchDocPhone)
      setPatientDocuments(res.data || [])
      toast({ title: 'Documentos encontrados', description: `Se encontraron ${res.data.length} documentos para el paciente.` })
    } catch (err: any) {
      toast({ title: 'Error', description: 'No se pudieron buscar los documentos', variant: 'destructive' })
    } finally {
      setSearchingDocs(false)
    }
  }

  // Lab Upload Simulator
  const handleSimulateLabUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusiness) return
    if (!labPhone || !labName) {
      toast({ title: 'Error', description: 'Teléfono y Nombre del resultado son obligatorios', variant: 'destructive' })
      return
    }
    setUploadingLab(true)
    try {
      // Registrar un archivo mock en la base de datos que contenga el teléfono del paciente en su nombre/descripción
      // Usaremos filesApi.upload simulado o directo vía backend.
      // Dado que queremos registrarlo, subiremos un pequeño archivo virtual de texto mock a filesApi.upload.
      // O alternativamente creamos un blob en el cliente.
      const blob = new Blob([`Resultado de Laboratorio Clínico para paciente ${labPhone}.`], { type: 'text/plain' })
      const simulatedFile = new File([blob], `${labPhone}_${labName.replace(/\s+/g, '_')}.txt`, { type: 'text/plain' })
      
      const res = await filesApi.upload(selectedBusiness.id, simulatedFile, labDescription || `Resultado de laboratorio clínico para paciente ${labPhone}`)
      const uploadedFile = res.data
      
      toast({ title: 'Resultado cargado a la BD', description: `Archivo registrado en la BD. Enviando notificación automática por WhatsApp...` })
      
      // Llamar al endpoint de notificación de laboratorio
      await clinicApi.notifyLabResult(selectedBusiness.id, uploadedFile.id)
      
      toast({ title: 'Paciente notificado', description: `El paciente ${labPhone} ha recibido una alerta por WhatsApp con su enlace seguro.` })
      setLabPhone('')
      setLabName('')
      setLabDescription('')
    } catch (err: any) {
      console.error(err)
      toast({ title: 'Error', description: 'No se pudo simular la carga y notificación', variant: 'destructive' })
    } finally {
      setUploadingLab(false)
    }
  }

  // Available Slots Searcher
  const handleSearchSlots = async () => {
    if (!selectedBusiness || !slotDate) {
      toast({ title: 'Error', description: 'Selecciona una fecha para consultar disponibilidad', variant: 'destructive' })
      return
    }
    setSearchingSlots(true)
    try {
      const res = await clinicApi.getAvailableSlots(selectedBusiness.id, slotDate, slotSpecialty)
      setAvailableSlots(res.data || [])
      toast({ title: 'Slots consultados', description: `Se encontraron ${res.data.length} horas disponibles para ${slotSpecialty}.` })
    } catch (err: any) {
      toast({ title: 'Error', description: 'Error al consultar disponibilidad', variant: 'destructive' })
    } finally {
      setSearchingSlots(false)
    }
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Stethoscope className="w-16 h-16 text-slate-600 mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-white mb-2">No hay negocio seleccionado</h2>
        <p className="text-slate-400 mb-6">Selecciona o crea un negocio clínico para comenzar</p>
        <Link href="/businesses">
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2 rounded-xl shadow-lg transition-colors">
            Ir a Negocios
          </Button>
        </Link>
      </div>
    )
  }

  if (selectedBusiness.industryType !== 'CLINIC') {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-luxury-glass border border-white/5 shadow-premium rounded-2xl p-8 text-center animate-blur-in">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Acceso No Autorizado al Panel Clínico</h2>
        <p className="text-slate-400 mb-6">
          Este panel de control contiene integraciones exclusivas para clínicas y centros de salud (recordatorios automatizados de ausentismo, liquidación a médicos, recetas de insumos del EHR). El negocio seleccionado actual (<strong>{selectedBusiness.name}</strong>) es del rubro <strong>{selectedBusiness.industryType}</strong>.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/businesses">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              Cambiar de Negocio
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 text-slate-300 rounded-xl">
              Ir al Dashboard General
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-blur-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-8 h-8 text-indigo-400 bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20" />
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Control Center Clínico
            </h1>
          </div>
          <p className="text-slate-400 mt-1">
            Gestión y automatización especializada para <strong>{selectedBusiness.name}</strong>
          </p>
        </div>
        <Button
          onClick={reloadAll}
          variant="outline"
          className="border-white/10 hover:border-indigo-500/50 bg-white/5 text-slate-300 hover:text-white transition-all duration-300 rounded-xl"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Sincronizar Datos
        </Button>
      </div>

      {/* Main clinical tabs */}
      <Tabs defaultValue="commission" className="space-y-6">
        <TabsList className="bg-luxury-glass border border-white/5 p-1 rounded-xl flex flex-wrap gap-1">
          <TabsTrigger value="commission" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all duration-200">
            <DollarSign className="w-4 h-4 mr-2" />
            Comisiones y Liquidación
          </TabsTrigger>
          <TabsTrigger value="appointments" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all duration-200">
            <Calendar className="w-4 h-4 mr-2" />
            Agenda y Ausentismo (HIS)
          </TabsTrigger>
          <TabsTrigger value="selfservice" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all duration-200">
            <Users className="w-4 h-4 mr-2" />
            Portal de Pacientes
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all duration-200">
            <Layers className="w-4 h-4 mr-2" />
            Inventario e Insumos EHR
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Payouts and commission configurations */}
        <TabsContent value="commission" className="space-y-6 animate-blur-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Wallet list card */}
            <Card className="lg:col-span-2 bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white font-bold text-lg">Billetera Virtual de Médicos</CardTitle>
                    <CardDescription className="text-slate-400">Comisiones acumuladas netas por cada médico en el sistema</CardDescription>
                  </div>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Cierre de Caja Rápido</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingWallets ? (
                  <p className="text-sm text-slate-400 text-center py-8">Cargando balances de billeteras...</p>
                ) : wallets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs uppercase bg-white/5 text-slate-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="px-4 py-3">ID Médico</th>
                          <th className="px-4 py-3">Última Actualización</th>
                          <th className="px-4 py-3 text-right">Balance Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {wallets.map((wallet) => (
                          <tr key={wallet.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3.5 font-semibold text-white">{wallet.medicoId}</td>
                            <td className="px-4 py-3.5 text-slate-400">{new Date(wallet.updatedAt).toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-emerald-400 text-base">S/ {wallet.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No se han registrado pagos ni billeteras aún para este negocio.</p>
                )}
              </CardContent>
            </Card>

            {/* Configure Contract Card */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Configurar Comisión Médica</CardTitle>
                <CardDescription className="text-slate-400">Reglas de negocio por médico (porcentaje o monto fijo)</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfigureContract} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="medId" className="text-slate-300">ID del Médico *</Label>
                    <Input
                      id="medId"
                      value={contractForm.medicoId}
                      onChange={(e) => setContractForm({...contractForm, medicoId: e.target.value})}
                      placeholder="Ej. DrCarlosRodríguez"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pctCom" className="text-slate-300">Comisión (%) *</Label>
                      <Input
                        id="pctCom"
                        type="number"
                        min="0"
                        max="100"
                        value={contractForm.porcentajeComision}
                        onChange={(e) => setContractForm({...contractForm, porcentajeComision: e.target.value})}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fjoCom" className="text-slate-300">Monto Fijo (S/) *</Label>
                      <Input
                        id="fjoCom"
                        type="number"
                        min="0"
                        value={contractForm.montoFijo}
                        onChange={(e) => setContractForm({...contractForm, montoFijo: e.target.value})}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingContract}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl mt-2"
                  >
                    {submittingContract ? 'Guardando...' : 'Guardar Regla de Contrato'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invoice Register Simulator */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Simulador de Facturación / Caja</CardTitle>
                <CardDescription className="text-slate-400">Recibe una factura cobrada por la clínica para liquidar comisiones</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegisterInvoice} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invNumber" className="text-slate-300">Número de Factura *</Label>
                    <Input
                      id="invNumber"
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})}
                      placeholder="Ej. F-00234"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invMedId" className="text-slate-300">Médico Atendiente *</Label>
                    <Input
                      id="invMedId"
                      value={invoiceForm.medicoId}
                      onChange={(e) => setInvoiceForm({...invoiceForm, medicoId: e.target.value})}
                      placeholder="Ej. DrCarlosRodríguez"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invAmt" className="text-slate-300">Monto Total Recaudado (S/) *</Label>
                    <Input
                      id="invAmt"
                      type="number"
                      min="1"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                      placeholder="Ej. 150.00"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="text-xs text-slate-400 bg-white/5 p-3 rounded-lg border border-white/5 space-y-1">
                    <p className="font-semibold text-slate-300">Cálculo de deducciones automáticas:</p>
                    <p>- Deducción de Impuestos estándar (IGV): 18%</p>
                    <p>- Deducción por insumos médicos y administrativos: 10%</p>
                    <p>- Monto neto para aplicar porcentaje: 72% de la factura</p>
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingInvoice}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                  >
                    {submittingInvoice ? 'Procesando...' : 'Registrar Pago y Sumar a Wallet'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* List Contracts Card */}
            <Card className="lg:col-span-2 bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Reglas de Contratos Activas</CardTitle>
                <CardDescription className="text-slate-400">Contratos vigentes para el cálculo de comisiones automáticas</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingContracts ? (
                  <p className="text-sm text-slate-400 text-center py-8">Cargando contratos...</p>
                ) : contracts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs uppercase bg-white/5 text-slate-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="px-4 py-3">ID Médico</th>
                          <th className="px-4 py-3 text-center">Comisión (%)</th>
                          <th className="px-4 py-3 text-right">Flat Fee (S/)</th>
                          <th className="px-4 py-3 text-right">Creado en</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {contracts.map((c) => (
                          <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-semibold text-white">{c.medicoId}</td>
                            <td className="px-4 py-3 text-center text-indigo-400 font-semibold">{c.porcentajeComision}%</td>
                            <td className="px-4 py-3 text-right text-emerald-400">S/ {c.montoFijo.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No hay contratos registrados. Los médicos sin contrato recibirán 50% por defecto.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Appointment Webhook HIS & Reminders */}
        <TabsContent value="appointments" className="space-y-6 animate-blur-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* HIS Simulator Webhook POST */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Simulador de Webhook HIS</CardTitle>
                <CardDescription className="text-slate-400">Simula el agendamiento desde el software de la clínica (POST /integrations/appointments)</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegisterAppointment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="patName" className="text-slate-300">Paciente (Nombre Completo) *</Label>
                    <Input
                      id="patName"
                      value={appointmentForm.customerName}
                      onChange={(e) => setAppointmentForm({...appointmentForm, customerName: e.target.value})}
                      placeholder="Ej. Juan Pérez"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patPhone" className="text-slate-300">Teléfono (WhatsApp) *</Label>
                    <Input
                      id="patPhone"
                      value={appointmentForm.customerPhone}
                      onChange={(e) => setAppointmentForm({...appointmentForm, customerPhone: e.target.value})}
                      placeholder="Ej. +51999999999"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patEmail" className="text-slate-300">Correo Electrónico (opcional)</Label>
                    <Input
                      id="patEmail"
                      type="email"
                      value={appointmentForm.customerEmail}
                      onChange={(e) => setAppointmentForm({...appointmentForm, customerEmail: e.target.value})}
                      placeholder="juan@correo.com"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="aptDte" className="text-slate-300">Fecha y Hora *</Label>
                      <Input
                        id="aptDte"
                        type="datetime-local"
                        value={appointmentForm.appointmentDate}
                        onChange={(e) => setAppointmentForm({...appointmentForm, appointmentDate: e.target.value})}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aptDur" className="text-slate-300">Duración (min)</Label>
                      <Input
                        id="aptDur"
                        type="number"
                        min="15"
                        step="5"
                        value={appointmentForm.duration}
                        onChange={(e) => setAppointmentForm({...appointmentForm, duration: e.target.value})}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="aptSpec" className="text-slate-300">Especialidad</Label>
                      <Input
                        id="aptSpec"
                        value={appointmentForm.specialty}
                        onChange={(e) => setAppointmentForm({...appointmentForm, specialty: e.target.value})}
                        placeholder="Ej. Cardiología"
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aptDoc" className="text-slate-300">Médico</Label>
                      <Input
                        id="aptDoc"
                        value={appointmentForm.specialist}
                        onChange={(e) => setAppointmentForm({...appointmentForm, specialist: e.target.value})}
                        placeholder="Dr. Carlos Rodríguez"
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingAppointment}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl mt-2"
                  >
                    {submittingAppointment ? 'Insertando...' : 'Enviar Cita a Webhook'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Appointments list & reminders check */}
            <Card className="lg:col-span-2 bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white font-bold text-lg">Citas Médicas e Historial EHR</CardTitle>
                    <CardDescription className="text-slate-400">Verificación de citas registradas y estado de recordatorios (24 horas antes)</CardDescription>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Postgres Sincronizado</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAppointments ? (
                  <p className="text-sm text-slate-400 text-center py-8">Cargando citas del negocio...</p>
                ) : appointments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs uppercase bg-white/5 text-slate-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="px-4 py-3">Paciente</th>
                          <th className="px-4 py-3">Fecha y Hora</th>
                          <th className="px-4 py-3">Especialista</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3 text-center">Recordatorio 24h</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {appointments.map((apt) => (
                          <tr key={apt.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{apt.customerName}</p>
                              <p className="text-xs text-slate-400">{apt.customerPhone}</p>
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {new Date(apt.appointmentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white text-xs">{apt.specialist}</p>
                              <p className="text-slate-400 text-[10px]">{apt.specialty}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                apt.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                apt.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {apt.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {apt.reminderSent ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                                  <CheckCircle className="w-3 h-3 mr-1" /> Enviado
                                </Badge>
                              ) : (
                                <Badge className="bg-zinc-800 text-slate-400 border border-white/5 text-[10px]">
                                  Pendiente
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No hay citas registradas para este negocio. Usa el simulador de la izquierda.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Patient Self-Service Portal */}
        <TabsContent value="selfservice" className="space-y-6 animate-blur-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Slot query panel */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Consulta de Slots de Médicos (HIS)</CardTitle>
                <CardDescription className="text-slate-400">GET /v1/slots/disponibles - Conecta al sistema HIS para ver horas libres</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slotSpec" className="text-slate-300">Especialidad</Label>
                    <Select value={slotSpecialty} onValueChange={setSlotSpecialty}>
                      <SelectTrigger className="bg-black/20 border-white/10 text-white rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">Medicina General</SelectItem>
                        <SelectItem value="Cardiología">Cardiología</SelectItem>
                        <SelectItem value="Pediatría">Pediatría</SelectItem>
                        <SelectItem value="Odontología">Odontología</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slotDte" className="text-slate-300">Fecha de Consulta</Label>
                    <Input
                      id="slotDte"
                      type="date"
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSearchSlots}
                  disabled={searchingSlots}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                >
                  {searchingSlots ? 'Consultando HIS...' : 'Buscar Horarios Libres'}
                </Button>

                {availableSlots.length > 0 ? (
                  <div className="pt-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Horas Disponibles Retornadas:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold text-center py-2 rounded-lg"
                        >
                          {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No se han cargado horas. Selecciona una fecha del futuro.</p>
                )}
              </CardContent>
            </Card>

            {/* Recetas y Resultados de Laboratorio query */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Descarga Segura de Recetas y Laboratorios</CardTitle>
                <CardDescription className="text-slate-400">GET /v1/patients/documents - Descarga segura de PDFs para el paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      value={searchDocPhone}
                      onChange={(e) => setSearchDocPhone(e.target.value)}
                      placeholder="Teléfono del Paciente (+51999...)"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={handleSearchPatientDocs}
                    disabled={searchingDocs}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </Button>
                </div>

                {searchingDocs ? (
                  <p className="text-sm text-slate-400 text-center py-4">Buscando expedientes...</p>
                ) : patientDocuments.length > 0 ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {patientDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <a href={`http://localhost:3003/${doc.url}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="border-white/10 text-indigo-400 hover:text-white rounded-lg">
                            <FileDown className="w-3.5 h-3.5 mr-1" />
                            Descargar
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Ingresa el teléfono del paciente para listar sus recetas y PDF médicos.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Laboratory upload notification simulator */}
          <Card className="max-w-2xl bg-luxury-glass border border-white/5 shadow-premium">
            <CardHeader>
              <CardTitle className="text-white font-bold text-lg">Carga de Laboratorios & Alerta de WhatsApp</CardTitle>
              <CardDescription className="text-slate-400">Sube un resultado médico de forma segura, el sistema detecta el teléfono y le avisa inmediatamente al paciente por SMS/WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSimulateLabUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="labPh" className="text-slate-300">Teléfono Paciente (9 dígitos sin espacios) *</Label>
                    <Input
                      id="labPh"
                      value={labPhone}
                      onChange={(e) => setLabPhone(e.target.value)}
                      placeholder="Ej. 987654321"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="labNm" className="text-slate-300">Nombre del Examen / Resultado *</Label>
                    <Input
                      id="labNm"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      placeholder="Ej. Hemograma Completo"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labDesc" className="text-slate-300">Detalles o Diagnóstico</Label>
                  <Textarea
                    id="labDesc"
                    value={labDescription}
                    onChange={(e) => setLabDescription(e.target.value)}
                    placeholder="Resultados clínicos de colesterol y glucosa normales."
                    className="bg-black/20 border-white/10 text-white rounded-xl"
                    rows={2}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={uploadingLab}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingLab ? 'Cargando y Notificando...' : 'Cargar Resultado Clínico y Notificar Paciente'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: EHR Inventory & Procedure Supplies config */}
        <TabsContent value="inventory" className="space-y-6 animate-blur-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Inventory table */}
            <Card className="lg:col-span-2 bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white font-bold text-lg">Insumos y Medicamentos en Almacén</CardTitle>
                    <CardDescription className="text-slate-400">Actualización en tiempo real basada en procedimientos clínicos cerrados en el expediente</CardDescription>
                  </div>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Control de Existencias</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInventory ? (
                  <p className="text-sm text-slate-400 text-center py-8">Cargando inventario clínico...</p>
                ) : inventory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="text-xs uppercase bg-white/5 text-slate-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="px-4 py-3">Insumo</th>
                          <th className="px-4 py-3 text-center">SKU</th>
                          <th className="px-4 py-3 text-center">Stock Actual</th>
                          <th className="px-4 py-3 text-center">Stock Mínimo</th>
                          <th className="px-4 py-3 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {inventory.map((item) => {
                          const isLow = item.stock <= item.minStock
                          return (
                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3.5 font-semibold text-white">{item.name}</td>
                              <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400">{item.sku}</td>
                              <td className="px-4 py-3.5 text-center font-bold text-slate-200">{item.stock}</td>
                              <td className="px-4 py-3.5 text-center text-slate-400">{item.minStock}</td>
                              <td className="px-4 py-3.5 text-right">
                                {isLow ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                    ¡Stock Crítico!
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                                    Estable
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No hay insumos registrados en el almacén clínico.</p>
                )}
              </CardContent>
            </Card>

            {/* Configure inventory item form */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Carga de Insumo / Reabastecer</CardTitle>
                <CardDescription className="text-slate-400">Registra un nuevo insumo médico o actualiza existencias</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateInventory} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invNm" className="text-slate-300">Nombre del Insumo *</Label>
                    <Input
                      id="invNm"
                      value={inventoryForm.name}
                      onChange={(e) => setInventoryForm({...inventoryForm, name: e.target.value})}
                      placeholder="Ej. Gasas Esterilizadas"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invSku" className="text-slate-300">SKU Único *</Label>
                    <Input
                      id="invSku"
                      value={inventoryForm.sku}
                      onChange={(e) => setInventoryForm({...inventoryForm, sku: e.target.value})}
                      placeholder="Ej. GAS-12"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invSt" className="text-slate-300">Stock Inicial *</Label>
                      <Input
                        id="invSt"
                        type="number"
                        min="0"
                        value={inventoryForm.stock}
                        onChange={(e) => setInventoryForm({...inventoryForm, stock: e.target.value})}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invMin" className="text-slate-300">Stock Mínimo *</Label>
                      <Input
                        id="invMin"
                        type="number"
                        min="1"
                        value={inventoryForm.minStock}
                        onChange={(e) => setInventoryForm({...inventoryForm, minStock: e.target.value})}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingInventory}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl mt-2"
                  >
                    {submittingInventory ? 'Guardando...' : 'Guardar en Almacén'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* EHR Closing Procedure Simulator */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Simulador de EHR (Expediente Clínico)</CardTitle>
                <CardDescription className="text-slate-400">Cuando el médico cierra el expediente clínico en el EHR, tu backend deduce insumos según el procedimiento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="procedureSel" className="text-slate-300">Procedimiento Quirúrgico / Clínico *</Label>
                  <Select value={procedureDeductName} onValueChange={setProcedureDeductName}>
                    <SelectTrigger className="bg-black/20 border-white/10 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sutura">Sutura de Herida</SelectItem>
                      <SelectItem value="Odontología">Consulta de Endodoncia</SelectItem>
                      <SelectItem value="Vacunación">Aplicación de Vacuna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-slate-400 bg-white/5 p-3 rounded-lg border border-white/5">
                  <p className="font-semibold text-slate-300 mb-1">Deducción de Inventario en Tiempo Real:</p>
                  <p>Al simular el procedimiento, el backend leerá la receta estándar mapeada y descargará automáticamente el stock de insumos en Postgres.</p>
                </div>
                <Button
                  onClick={handleDeductInventory}
                  disabled={deductingInventory}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                >
                  {deductingInventory ? 'Procesando descarga...' : 'Cerrar Expediente y Descargar Insumos'}
                </Button>
              </CardContent>
            </Card>

            {/* Configure procedure supplies list / recipe */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Configurar Receta Insumos</CardTitle>
                <CardDescription className="text-slate-400">Vincula insumos necesarios para cada procedimiento médico</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfigureSupplies} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recProc" className="text-slate-300">Procedimiento (EHR) *</Label>
                    <Input
                      id="recProc"
                      value={suppliesForm.procedureName}
                      onChange={(e) => setSuppliesForm({...suppliesForm, procedureName: e.target.value})}
                      placeholder="Ej. Sutura"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recSku" className="text-slate-300">SKU del Insumo *</Label>
                    <Input
                      id="recSku"
                      value={suppliesForm.itemSku}
                      onChange={(e) => setSuppliesForm({...suppliesForm, itemSku: e.target.value})}
                      placeholder="Ej. GAS-12"
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recQty" className="text-slate-300">Cantidad por Procedimiento *</Label>
                    <Input
                      id="recQty"
                      type="number"
                      min="1"
                      value={suppliesForm.quantity}
                      onChange={(e) => setSuppliesForm({...suppliesForm, quantity: e.target.value})}
                      className="bg-black/20 border-white/10 text-white rounded-xl"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingSupplies}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl mt-1"
                  >
                    {submittingSupplies ? 'Configurando...' : 'Vincular Insumo a Receta'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* List mapped procedure supplies configurations */}
            <Card className="bg-luxury-glass border border-white/5 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white font-bold text-lg">Recetas Mapeadas</CardTitle>
                <CardDescription className="text-slate-400">Listado de insumos vinculados a procedimientos</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSupplies ? (
                  <p className="text-sm text-slate-400 text-center py-8">Cargando recetas...</p>
                ) : supplies.length > 0 ? (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {supplies.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                        <div>
                          <p className="text-xs font-bold text-white uppercase">{s.procedureName}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">SKU: <span className="font-mono text-slate-300">{s.itemSku}</span></p>
                        </div>
                        <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                          {s.quantity} u
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No hay recetas de procedimientos mapeadas aún.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
