'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useBusinessStore } from '@/store/business'
import { leadsApi, appointmentsApi, crmCallApi, messagesApi, crmApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { 
  Users, 
  TrendingUp, 
  UserCheck, 
  Building2, 
  Phone, 
  Mail, 
  MoreVertical, 
  GripVertical, 
  Calendar, 
  X, 
  Send, 
  Copy, 
  Loader2, 
  MessageSquare,
  Sparkles,
  User,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  PhoneCall,
  Volume2,
  MicOff,
  Mic,
  CalendarCheck,
  Search,
  BadgeAlert,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Database,
  Wifi,
  WifiOff,
  CheckCircle2,
  Settings,
  Bell
} from 'lucide-react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const COLUMNS = [
  { id: 'NEW', title: 'Nuevos', color: 'bg-blue-50/40 border-blue-200/50', headerColor: 'text-blue-750 bg-blue-100/60' },
  { id: 'CONTACTED', title: 'IA Programada', color: 'bg-purple-50/40 border-purple-200/50', headerColor: 'text-purple-750 bg-purple-100/60' },
  { id: 'QUALIFIED', title: 'Reuniones', color: 'bg-blue-50/40 border-blue-200/50', headerColor: 'text-blue-750 bg-blue-100/60' },
  { id: 'CONVERTED', title: 'Convertidos', color: 'bg-green-50/40 border-green-200/50', headerColor: 'text-green-750 bg-green-100/60' },
  { id: 'LOST', title: 'Descartados', color: 'bg-red-50/40 border-red-200/50', headerColor: 'text-red-750 bg-red-100/60' }
]



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

export default function CRMUnifiedPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  
  // Tabs: 'kanban' | 'calendar' | 'integration'
  const [activeTab, setActiveTab] = useState<'kanban' | 'calendar' | 'integration'>('kanban')

  // Kanban state
  const [leads, setLeads] = useState<any[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  
  // Selected lead drawer state
  const [selectedLead, setSelectedLead] = useState<any | null>(null)
  const [notes, setNotes] = useState('')
  const [savingLead, setSavingLead] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' })
  
  // Lead attributes
  const [temperature, setTemperature] = useState('Frío')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [tasks, setTasks] = useState<any[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')

  // VoIP Click-to-Call State
  const [activeCall, setActiveCall] = useState<{
    isOpen: boolean
    leadName: string
    phone: string
    status: 'calling' | 'connected' | 'ended'
    duration: number
    isMuted: boolean
  }>({
    isOpen: false,
    leadName: '',
    phone: '',
    status: 'calling',
    duration: 0,
    isMuted: false
  })
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Appointments state
  const [appointments, setAppointments] = useState<any[]>([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  const [appointmentForm, setAppointmentForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    appointmentDate: '',
    duration: '60',
    specialty: '',
    specialist: '',
    notes: '',
  })

  // CRM Connection integration state
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmTesting, setCrmTesting] = useState(false)
  const [crmConnection, setCrmConnection] = useState<any | null>(null)
  const [selectedCrmProvider, setSelectedCrmProvider] = useState('NONE')
  const [crmFormData, setCrmFormData] = useState({
    accessToken: '',
    refreshToken: '',
    apiKey: '',
    apiSecret: '',
    baseUrl: '',
    pageId: '',
    spreadsheetId: '',
    syncEnabled: true,
    syncDirection: 'BIDIRECTIONAL',
  })
  const [crmChannelOptions, setCrmChannelOptions] = useState<any[]>([])
  const [selectedCrmChannels, setSelectedCrmChannels] = useState<string[]>([])
  const [crmChannelLoading, setCrmChannelLoading] = useState(false)
  const [savingCrmChannels, setSavingCrmChannels] = useState(false)
  const [configCrmDialogOpen, setConfigCrmDialogOpen] = useState(false)

  // Load leads
  const loadLeads = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingLeads(true)
    try {
      const response = await leadsApi.getAll(selectedBusiness.id)
      const fetched = response.data || []
      setLeads(fetched)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los leads',
        variant: 'destructive',
      })
    } finally {
      setLoadingLeads(false)
    }
  }, [selectedBusiness, toast])

  // Load appointments
  const loadAppointments = useCallback(async () => {
    if (!selectedBusiness) return
    setLoadingAppointments(true)
    try {
      const response = await appointmentsApi.getAll(selectedBusiness.id)
      setAppointments(response.data || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las citas',
        variant: 'destructive',
      })
    } finally {
      setLoadingAppointments(false)
    }
  }, [selectedBusiness, toast])

  // Load CRM connection status
  const loadCrmConnection = useCallback(async () => {
    if (!selectedBusiness) return
    try {
      const response = await crmApi.getConnection(selectedBusiness.id)
      setCrmConnection(response.data)
      setSelectedCrmProvider(response.data.provider || 'NONE')
    } catch (error) {
      console.error('Error loading CRM connection:', error)
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

  // Load CRM channel mapping options
  const loadCrmChannelMappings = useCallback(async () => {
    if (!selectedBusiness) return
    setCrmChannelLoading(true)
    try {
      const response = await crmApi.getChannelMappings(selectedBusiness.id)
      setCrmChannelOptions(response.data?.options || [])
      setSelectedCrmChannels(response.data?.enabledKeys || [])
    } catch (error: any) {
      console.error('Error loading CRM channels:', error)
    } finally {
      setCrmChannelLoading(false)
    }
  }, [selectedBusiness])

  // Save CRM integration credentials
  const handleSaveCrmConnection = async () => {
    if (!selectedBusiness) return
    setCrmLoading(true)
    try {
      const connectionData: any = {
        provider: selectedCrmProvider,
        syncEnabled: crmFormData.syncEnabled,
        syncDirection: crmFormData.syncDirection,
      }

      if (selectedCrmProvider === 'META_CRM') {
        connectionData.accessToken = crmFormData.accessToken
        connectionData.config = { pageId: crmFormData.pageId }
      } else if (selectedCrmProvider === 'GOOGLE_SHEETS') {
        connectionData.accessToken = crmFormData.accessToken
        connectionData.config = { spreadsheetId: crmFormData.spreadsheetId }
      } else if (selectedCrmProvider === 'HUBSPOT' || selectedCrmProvider === 'SALESFORCE' || selectedCrmProvider === 'ZOHO' || selectedCrmProvider === 'PIPEDRIVE' || selectedCrmProvider === 'MONDAY') {
        connectionData.accessToken = crmFormData.accessToken
        connectionData.refreshToken = crmFormData.refreshToken
        connectionData.apiKey = crmFormData.apiKey
      } else if (selectedCrmProvider === 'CUSTOM') {
        connectionData.apiKey = crmFormData.apiKey
        connectionData.apiSecret = crmFormData.apiSecret
        connectionData.baseUrl = crmFormData.baseUrl
      }

      await crmApi.createConnection(selectedBusiness.id, connectionData)
      toast({
        title: 'CRM Configurado',
        description: 'La vinculación del CRM externo se ha guardado correctamente.',
      })
      setConfigCrmDialogOpen(false)
      loadCrmConnection()
    } catch (error: any) {
      toast({
        title: 'Error al configurar CRM',
        description: error.response?.data?.message || 'No se pudo guardar la configuración.',
        variant: 'destructive',
      })
    } finally {
      setCrmLoading(false)
    }
  }

  // Test connection to CRM
  const handleTestCrmConnection = async () => {
    if (!selectedBusiness) return
    setCrmTesting(true)
    try {
      const response = await crmApi.testConnection(selectedBusiness.id)
      if (response.data.success) {
        toast({
          title: '✅ Conexión exitosa',
          description: response.data.message || 'El CRM externo responde correctamente.',
        })
      } else {
        toast({
          title: '❌ Error de conexión',
          description: response.data.message || 'No se pudo verificar el CRM. Revisa las credenciales.',
          variant: 'destructive',
        })
      }
      loadCrmConnection()
    } catch (error: any) {
      toast({
        title: 'Error en prueba',
        description: error.response?.data?.message || 'No se pudo completar la prueba de conexión.',
        variant: 'destructive',
      })
    } finally {
      setCrmTesting(false)
    }
  }

  // Disconnect CRM integration
  const handleDisconnectCrm = async () => {
    if (!selectedBusiness) return
    setCrmLoading(true)
    try {
      await crmApi.updateConnection(selectedBusiness.id, {
        provider: 'NONE',
        isActive: false,
      })
      toast({
        title: 'CRM Desvinculado',
        description: 'El CRM externo ha sido desconectado de este negocio.',
      })
      loadCrmConnection()
    } catch (error: any) {
      toast({
        title: 'Error al desvincular',
        description: error.response?.data?.message || 'No se pudo desvincular el CRM.',
        variant: 'destructive',
      })
    } finally {
      setCrmLoading(false)
    }
  }

  // Trigger manual sync
  const handleTriggerCrmSync = async () => {
    if (!selectedBusiness) return
    setCrmLoading(true)
    try {
      await crmApi.triggerSync(selectedBusiness.id)
      toast({
        title: 'Sincronización Iniciada',
        description: 'La sincronización manual con el CRM externo ha comenzado.',
      })
    } catch (error: any) {
      toast({
        title: 'Error de sincronización',
        description: error.response?.data?.message || 'No se pudo iniciar la sincronización.',
        variant: 'destructive',
      })
    } finally {
      setCrmLoading(false)
    }
  }

  // Save selected channels for sync
  const handleSaveCrmChannels = async () => {
    if (!selectedBusiness) return
    setSavingCrmChannels(true)
    try {
      await crmApi.saveChannelMappings(selectedBusiness.id, selectedCrmChannels)
      toast({
        title: 'Canales Guardados',
        description: 'Se actualizó la lista de canales que se sincronizan con tu CRM.',
      })
      loadCrmChannelMappings()
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.response?.data?.message || 'Inténtalo nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingCrmChannels(false)
    }
  }

  useEffect(() => {
    if (selectedBusiness) {
      loadLeads()
      loadAppointments()
      loadCrmConnection()
      loadCrmChannelMappings()
    }
  }, [selectedBusiness, loadLeads, loadAppointments, loadCrmConnection, loadCrmChannelMappings])

  useEffect(() => {
    if (crmConnection && configCrmDialogOpen) {
      setSelectedCrmProvider(crmConnection.provider || 'NONE')
      setCrmFormData({
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
  }, [crmConnection, configCrmDialogOpen])

  // Drag and drop handler
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const leadId = draggableId
    const newStatus = destination.droppableId

    // Optimistic UI update
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead))
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev: any) => prev ? { ...prev, status: newStatus } : null)
    }

    try {
      await leadsApi.update(leadId, { status: newStatus })
      toast({
        title: 'Estado de lead actualizado',
        description: `Lead movido a ${COLUMNS.find(c => c.id === newStatus)?.title}`,
      })
    } catch (error) {
      // Revert UI on error
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: source.droppableId } : lead))
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead((prev: any) => prev ? { ...prev, status: source.droppableId } : null)
      }
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado en el servidor',
        variant: 'destructive',
      })
    }
  }

  // Open lead details drawer
  const handleLeadClick = (lead: any) => {
    setSelectedLead(lead)
    setNotes(lead.notes || '')
    setEditForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
    })

    // Parse metadata
    let metadataObj: any = {}
    try {
      metadataObj = lead.metadata 
        ? (typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata) 
        : {}
    } catch (e) {
      metadataObj = {}
    }
    
    setTemperature(metadataObj.temperature || 'Frío')
    setTags(metadataObj.tags || [])
    setTasks(metadataObj.tasks || [])
    setNewTag('')
    setNewTaskTitle('')
    setNewTaskDueDate('')
  }

  // Save all lead details from drawer
  const handleSaveLead = async () => {
    if (!selectedLead) return
    setSavingLead(true)
    try {
      const updatedMetadata = {
        temperature,
        tags,
        tasks,
      }
      const updatedData = {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        notes: notes,
        metadata: updatedMetadata,
      }
      await leadsApi.update(selectedLead.id, updatedData)
      
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...updatedData } : l))
      setSelectedLead((prev: any) => prev ? { ...prev, ...updatedData } : null)
      
      toast({
        title: 'Lead actualizado',
        description: 'La información del lead se guardó correctamente.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la información del lead',
        variant: 'destructive',
      })
    } finally {
      setSavingLead(false)
    }
  }

  // VoIP call controls (simulation)
  const startCall = (leadName: string, phone: string) => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    setActiveCall({
      isOpen: true,
      leadName,
      phone,
      status: 'calling',
      duration: 0,
      isMuted: false
    })

    // Simulate connection after 2 seconds
    setTimeout(() => {
      setActiveCall(prev => {
        if (prev.isOpen && prev.status === 'calling') {
          // Connect call and start timer
          callTimerRef.current = setInterval(() => {
            setActiveCall(t => ({ ...t, duration: t.duration + 1 }))
          }, 1000)
          return { ...prev, status: 'connected' }
        }
        return prev
      })
    }, 2000)

    toast({
      title: 'Llamando...',
      description: `Iniciando llamada VoIP WebRTC a ${leadName}`,
    })
  }

  const endCall = async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    setActiveCall(prev => ({ ...prev, status: 'ended' }))
    
    const callDuration = activeCall.duration
    
    // Guardar registro de llamada real
    try {
      let contactId = undefined
      if (selectedLead) {
        try {
          const meta = selectedLead.metadata 
            ? (typeof selectedLead.metadata === 'string' ? JSON.parse(selectedLead.metadata) : selectedLead.metadata) 
            : {}
          contactId = meta.contactId || undefined
        } catch (e) {
          // ignore
        }
      }
      
      await crmCallApi.createLog({
        contactId,
        contactPhone: activeCall.phone,
        contactName: activeCall.leadName,
        duration: callDuration,
        status: callDuration > 0 ? 'COMPLETED' : 'MISSED',
        recordingUrl: 'https://sysbot-recordings.s3.amazonaws.com/rec_' + Date.now() + '.mp3',
        transcription: 'Llamada telefónica realizada desde el panel CRM WebRTC de Sysbot.',
        sentiment: 'NEUTRAL',
        queryResolved: true
      })
      
      toast({
        title: 'Llamada finalizada',
        description: `Llamada de ${callDuration}s registrada en el historial.`,
      })
    } catch (error) {
      console.error('Error recording call log:', error)
      toast({
        title: 'Llamada finalizada',
        description: `Duración: ${callDuration} segundos. (No se pudo guardar en el historial)`,
      })
    }

    // Close modal after 1.5 seconds
    setTimeout(() => {
      setActiveCall(prev => ({ ...prev, isOpen: false }))
    }, 1500)
  }

  const toggleMute = () => {
    setActiveCall(prev => ({ ...prev, isMuted: !prev.isMuted }))
  }

  // Calendar slot booking
  const handleScheduleAppointment = async () => {
    if (!selectedBusiness) return
    if (!appointmentForm.customerName || !appointmentForm.customerPhone || !appointmentForm.appointmentDate) {
      toast({
        title: 'Campos requeridos vacíos',
        description: 'El nombre, teléfono y fecha/hora son obligatorios.',
        variant: 'destructive',
      })
      return
    }

    setScheduling(true)
    try {
      await appointmentsApi.create(selectedBusiness.id, {
        customerName: appointmentForm.customerName,
        customerPhone: appointmentForm.customerPhone,
        customerEmail: appointmentForm.customerEmail || undefined,
        appointmentDate: new Date(appointmentForm.appointmentDate).toISOString(),
        duration: Number(appointmentForm.duration) || 60,
        specialty: appointmentForm.specialty || undefined,
        specialist: appointmentForm.specialist || undefined,
        notes: appointmentForm.notes || undefined,
        status: 'CONFIRMED',
        origin: 'MANUAL',
      })
      toast({
        title: 'Cita programada',
        description: 'La cita ha sido registrada exitosamente.',
      })
      setIsScheduleOpen(false)
      loadAppointments()
      // Reset form
      setAppointmentForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        appointmentDate: '',
        duration: '60',
        specialty: '',
        specialist: '',
        notes: '',
      })
    } catch (err) {
      toast({
        title: 'Error al programar cita',
        description: 'Por favor verifica los campos e inténtalo de nuevo.',
        variant: 'destructive',
      })
    } finally {
      setScheduling(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await appointmentsApi.update(id, { status })
      toast({
        title: 'Cita actualizada',
        description: 'El estado se actualizó correctamente',
      })
      loadAppointments()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de la cita',
        variant: 'destructive',
      })
    }
  }

  // Tags and task handlers for lead drawer
  const handleAddTag = () => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setNewTag('')
      return
    }
    setTags(prev => [...prev, trimmed])
    setNewTag('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove))
  }

  const handleAddTask = () => {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return
    const task = {
      title: trimmed,
      dueDate: newTaskDueDate || null,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, task])
    setNewTaskTitle('')
    setNewTaskDueDate('')
  }

  const handleToggleTask = (index: number) => {
    setTasks(prev => prev.map((t, idx) => idx === index ? { ...t, completed: !t.completed } : t))
  }

  const handleRemoveTask = (index: number) => {
    setTasks(prev => prev.filter((_, idx) => idx !== index))
  }

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status)

  // Calculations
  const totalLeads = leads.length
  const convertedLeads = getLeadsByStatus('CONVERTED').length
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0
  const activeNegotiations = getLeadsByStatus('QUALIFIED').length

  // Calendar calculations (generate days for the current week / month view)
  const getDaysInMonthView = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    const days: Date[] = []
    
    // Fill previous month trailing days
    const firstDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday, 1 = Monday etc.
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i))
    }
    
    // Fill current month days
    const totalDays = lastDayOfMonth.getDate()
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i))
    }
    
    // Fill next month leading days
    const remainingSlots = 42 - days.length // 6 rows of 7 days
    for (let i = 1; i <= remainingSlots; i++) {
      days.push(new Date(year, month + 1, i))
    }
    
    return days
  }

  const monthDays = getDaysInMonthView(selectedDate)
  const monthName = selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
  }

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate)
      return aptDate.getDate() === day.getDate() &&
             aptDate.getMonth() === day.getMonth() &&
             aptDate.getFullYear() === day.getFullYear()
    })
  }

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Building2 className="w-16 h-16 text-slate-400 mb-4 animate-bounce" />
        <h2 className="text-2xl font-black text-slate-800 mb-2 font-syst">CRM Exclusivo de Negocio</h2>
        <p className="text-slate-500 mb-6 max-w-sm">Por favor selecciona un negocio en el panel para visualizar el CRM, embudo de ventas y agenda.</p>
        <Link href="/businesses">
          <Button className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all duration-300">
            Ir a Negocios
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 bg-slate-50/30 rounded-3xl min-h-screen font-sans">
      
      {/* Premium Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-slate-800 font-syst">CRM Enterprise</h1>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Conectado: Google Cloud
          </span>
        </div>
        
        <div className="flex-1 max-w-md">
          <div className="relative bg-slate-50 border border-slate-200 rounded-xl flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar prospectos..."
              className="bg-transparent border-none focus:ring-0 text-xs w-full py-0 text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={() => {
              setAppointmentForm({
                customerName: '',
                customerPhone: '',
                customerEmail: '',
                appointmentDate: '',
                duration: '60',
                specialty: '',
                specialist: '',
                notes: '',
              })
              setIsScheduleOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-750 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 h-10 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Lead
          </Button>
          
          <button className="p-2.5 bg-slate-50 hover:bg-slate-105 border border-slate-205 text-slate-600 rounded-xl transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-xs shadow-xs">
            US
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-3xl border border-slate-200/60 shadow-xs">
        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-55 text-blue-600 rounded-xl border border-blue-100 shadow-xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leads Totales</p>
            <p className="text-xl font-black text-slate-800 font-mono leading-none mt-1">{totalLeads}</p>
          </div>
        </div>

        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En Negocio</p>
            <p className="text-xl font-black text-slate-800 font-mono leading-none mt-1">{activeNegotiations}</p>
          </div>
        </div>

        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-xl border border-green-100 shadow-xs">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversión</p>
            <p className="text-xl font-black text-green-600 font-mono leading-none mt-1">{conversionRate}%</p>
          </div>
        </div>

        <div className="bg-slate-50/50 border border-slate-200/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-xs">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sincronizaciones</p>
            <p className="text-xs font-black text-blue-650 uppercase tracking-wide leading-none mt-1">Activas</p>
          </div>
        </div>
      </div>

      {/* Tabs Menu & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200/60 shadow-xs">
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab('kanban')}
            className={`rounded-xl px-5 font-bold text-xs h-10 border transition-all duration-300 ${
              activeTab === 'kanban' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Embudo de Leads (Kanban)
          </Button>
          <Button
            onClick={() => setActiveTab('calendar')}
            className={`rounded-xl px-5 font-bold text-xs h-10 border transition-all duration-300 ${
              activeTab === 'calendar' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CalendarCheck className="w-4 h-4 mr-2" />
            Agenda y Reservas
          </Button>
          <Button
            onClick={() => setActiveTab('integration')}
            className={`rounded-xl px-5 font-bold text-xs h-10 border transition-all duration-300 ${
              activeTab === 'integration' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Vincular CRM
          </Button>
        </div>

        <div className="flex gap-2">
          {activeTab === 'kanban' && (
            <Button 
              onClick={loadLeads} 
              variant="outline" 
              className="border-slate-200 hover:border-blue-600 text-slate-600 hover:text-blue-600 transition-all rounded-xl h-10 text-xs font-bold bg-white"
            >
              Recargar Leads
            </Button>
          )}
          {activeTab === 'calendar' && (
            <>
              <Button 
                onClick={() => setIsScheduleOpen(true)}
                className="bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl h-10 text-xs shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Agendar Cita
              </Button>
              <Button 
                onClick={loadAppointments} 
                variant="outline" 
                className="border-slate-200 hover:border-blue-600 text-slate-600 hover:text-blue-600 transition-all rounded-xl h-10 text-xs font-bold bg-white"
              >
                Recargar Citas
              </Button>
            </>
          )}
          {activeTab === 'integration' && (
            <Button 
              onClick={loadCrmConnection} 
              variant="outline" 
              className="border-slate-200 hover:border-blue-600 text-slate-600 hover:text-blue-600 transition-all rounded-xl h-10 text-xs font-bold bg-white"
            >
              Recargar Estado
            </Button>
          )}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === 'kanban' ? (
            <motion.div
              key="kanban-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {loadingLeads ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-wider animate-pulse font-syst">Cargando tablero...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="bg-white border border-slate-200/70 rounded-3xl p-16 text-center max-w-lg mx-auto shadow-xs my-6">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-extrabold text-slate-800 font-syst">Embudo sin Prospectos</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">No tienes leads registrados para este negocio en este momento. Los leads creados mediante conversaciones de WhatsApp aparecerán aquí de forma automática.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-6 overflow-x-auto pb-8 snap-x luxury-scrollbar">
                    {COLUMNS.map((column) => {
                      const columnLeads = getLeadsByStatus(column.id)
                      return (
                        <div key={column.id} className="min-w-[300px] max-w-[300px] shrink-0 snap-start flex flex-col h-[700px]">
                          {/* Column Header */}
                          <div className={`rounded-2xl p-4 mb-3 border border-slate-200/50 backdrop-blur-md flex items-center justify-between shadow-xs bg-white`}>
                            <span className="font-extrabold text-xs uppercase tracking-wider font-syst text-slate-700">{column.title}</span>
                            <span className="bg-slate-105 px-2.5 py-0.5 rounded-full text-[10px] font-black text-slate-600 border border-slate-200 font-mono">
                              {columnLeads.length}
                            </span>
                          </div>
                          
                          {/* Droppable Area */}
                          <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className={`flex-1 p-3 rounded-2xl border transition-all duration-300 overflow-y-auto luxury-scrollbar flex flex-col gap-3 ${
                                  column.color
                                } ${
                                  snapshot.isDraggingOver 
                                    ? 'ring-2 ring-blue-600/40 ring-inset bg-white/70 shadow-inner' 
                                    : 'bg-slate-100/50 border-slate-200/40'
                                }`}
                              >
                                <AnimatePresence>
                                  {columnLeads.map((lead, index) => {
                                    let meta: any = {}
                                    try {
                                      meta = lead.metadata 
                                        ? (typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata) 
                                        : {}
                                    } catch (e) {}
                                    
                                    const tempColor = 
                                      meta.temperature === 'Caliente' ? 'bg-red-50 text-red-600 border-red-100' :
                                      meta.temperature === 'Tibio' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                      'bg-blue-50 text-blue-600 border-blue-100'

                                    return (
                                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            style={{ ...provided.draggableProps.style }}
                                            className="focus:outline-none"
                                          >
                                            <motion.div
                                              initial={{ opacity: 0, y: 10 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0, scale: 0.95 }}
                                              onClick={() => handleLeadClick(lead)}
                                              className={`bg-white rounded-2xl p-5 shadow-xs border border-slate-200/60 group relative cursor-pointer select-none transition-all duration-200 ${
                                                snapshot.isDragging 
                                                  ? 'shadow-xl ring-2 ring-blue-600 rotate-2 scale-[1.03]' 
                                                  : 'hover:shadow-md hover:border-blue-600/20 bg-white'
                                              }`}
                                            >
                                              <div className="flex justify-between items-start gap-2">
                                                <div>
                                                  <h4 className="font-extrabold text-slate-800 text-xs truncate font-syst">{lead.name || 'Sin Nombre'}</h4>
                                                  <span className="text-[10px] text-slate-400 font-medium font-mono">{lead.phone}</span>
                                                </div>
                                                <span className="bg-slate-50 text-slate-650 border border-slate-200 text-[9px] font-black px-1.5 py-0.5 rounded-md font-mono shrink-0">
                                                  Score: {meta.leadScore || 80}
                                                </span>
                                              </div>

                                              {/* Custom widget based on column type */}
                                              {column.id === 'NEW' && (
                                                <div className="mt-3.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-medium text-slate-500">
                                                  <p className="font-bold text-slate-700">Acción Programada:</p>
                                                  <p className="mt-0.5">Llamar a las 4:00 PM</p>
                                                </div>
                                              )}

                                              {column.id === 'CONTACTED' && (
                                                <div className="mt-3.5 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="bg-violet-100 text-violet-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-violet-205">AUTO-BOT</span>
                                                    <span className="text-[9px] font-bold text-slate-450 font-mono">Progreso: {meta.progress || 65}%</span>
                                                  </div>
                                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${meta.progress || 65}%` }} />
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toast({
                                                        title: 'Script de IA Studio',
                                                        description: 'Regla: "Conversación de Calificación". Tono: "Empático". Prompt RAG activo.',
                                                      });
                                                    }}
                                                    className="w-full mt-1.5 py-2 text-[10px] font-black uppercase bg-violet-50 hover:bg-violet-100 text-violet-750 rounded-xl transition-all text-center tracking-wider border border-violet-200/80 shadow-xs"
                                                  >
                                                    Ver Script de IA
                                                  </button>
                                                </div>
                                              )}

                                              {column.id === 'QUALIFIED' && (
                                                <div className="mt-3.5 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-black px-2 py-0.5 rounded-full">Prioridad Alta</span>
                                                    <span className="text-[9px] font-bold text-slate-500 font-mono">Mañana, 10:00 AM</span>
                                                  </div>
                                                  <a
                                                    href={meta.googleMeetUrl || 'https://meet.google.com'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full block py-2 text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-center tracking-wider shadow-sm mt-1.5"
                                                  >
                                                    Join Google Meet
                                                  </a>
                                                </div>
                                              )}

                                              {/* Action Buttons in bottom */}
                                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                                                {column.id === 'NEW' && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        startCall(lead.name, lead.phone);
                                                      }}
                                                      className="flex-1 py-1.5 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-lg transition-all font-syst"
                                                    >
                                                      Llamar
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLead(lead);
                                                        setIsScheduleOpen(true);
                                                      }}
                                                      className="flex-1 py-1.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-all font-syst"
                                                    >
                                                      Agendar
                                                    </button>
                                                  </>
                                                )}
                                                
                                                {column.id === 'CONTACTED' && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toast({
                                                          title: 'IA Pausada',
                                                          description: 'Se pausó el bot para este prospecto. Responde manualmente en la bandeja de entrada.',
                                                        });
                                                      }}
                                                      className="flex-1 py-1.5 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-650 border border-red-100 rounded-lg transition-all font-syst"
                                                    >
                                                      Intervenir
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toast({
                                                          title: 'Acción Pospuesta',
                                                          description: 'Se pospuso el bot por 24 horas.',
                                                        });
                                                      }}
                                                      className="flex-1 py-1.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-105 text-slate-650 border border-slate-200 rounded-lg transition-all font-syst"
                                                    >
                                                      Posponer
                                                    </button>
                                                  </>
                                                )}

                                                {column.id === 'QUALIFIED' && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toast({
                                                          title: 'Reprogramar Reunión',
                                                          description: 'Abre panel para reprogramar cita Google Meet.',
                                                        });
                                                      }}
                                                      className="flex-1 py-1.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-105 text-slate-650 border border-slate-200 rounded-lg transition-all font-syst"
                                                    >
                                                      Reprogramar
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLeadClick(lead);
                                                      }}
                                                      className="flex-1 py-1.5 text-[10px] font-bold bg-slate-55 hover:bg-slate-100 text-slate-650 border border-slate-200 rounded-lg transition-all font-syst"
                                                    >
                                                      Notas
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </motion.div>
                                          </div>
                                        )}
                                      </Draggable>
                                    )
                                  })}
                                </AnimatePresence>
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )
                    })}
                  </div>
                </DragDropContext>
              )}
            </motion.div>
          ) : activeTab === 'calendar' ? (
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 xl:grid-cols-3 gap-6"
            >
              {/* Calendario Grid (Izquierda / Centro) */}
              <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 font-syst">
                      {monthName}
                    </h3>
                    <div className="flex gap-1.5">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        onClick={prevMonth} 
                        className="w-8 h-8 rounded-lg border-slate-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        onClick={nextMonth} 
                        className="w-8 h-8 rounded-lg border-slate-200"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Calendar grid headers */}
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    <span>Dom</span>
                    <span>Lun</span>
                    <span>Mar</span>
                    <span>Mié</span>
                    <span>Jue</span>
                    <span>Vie</span>
                    <span>Sáb</span>
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {monthDays.map((day, idx) => {
                      const dayAppointments = getAppointmentsForDay(day)
                      const isToday = new Date().toDateString() === day.toDateString()
                      const isCurrentMonth = day.getMonth() === selectedDate.getMonth()

                      return (
                        <div
                          key={idx}
                          className={`min-h-[75px] rounded-xl border p-2 flex flex-col justify-between transition-all relative group ${
                            isToday 
                              ? 'border-primary bg-primary/5 text-primary' 
                              : isCurrentMonth 
                                ? 'border-slate-100 bg-slate-50/50 hover:bg-slate-50' 
                                : 'border-slate-50 bg-white opacity-40'
                          }`}
                        >
                          <span className={`text-[10px] font-bold ${isToday ? 'font-black' : 'text-slate-500'}`}>
                            {day.getDate()}
                          </span>
                          
                          <div className="space-y-1 mt-1">
                            {dayAppointments.slice(0, 2).map((apt) => (
                              <div
                                key={apt.id}
                                className={`text-[8px] font-black px-1 py-0.5 rounded truncate border ${
                                  apt.status === 'CONFIRMED' 
                                    ? 'bg-green-500/10 text-green-700 border-green-500/20' 
                                    : apt.status === 'PENDING' 
                                      ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' 
                                      : 'bg-red-500/10 text-red-700 border-red-500/20'
                                }`}
                                title={`${apt.customerName} - ${apt.specialty || 'General'}`}
                              >
                                {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {apt.customerName}
                              </div>
                            ))}
                            {dayAppointments.length > 2 && (
                              <div className="text-[7px] font-bold text-slate-400 text-right">
                                +{dayAppointments.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Lista de citas y slots de reserva (Derecha) */}
              <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm flex flex-col justify-between h-full">
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-4 font-syst">
                    Próximas Citas Agendadas
                  </h3>

                  {loadingAppointments ? (
                    <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                      Cargando Citas...
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Calendar className="w-10 h-10 opacity-30 mx-auto mb-2" />
                      <p className="text-xs">No hay citas programadas para este mes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[500px] overflow-y-auto luxury-scrollbar pr-1">
                      {appointments.slice(0, 10).map((apt) => {
                        const aptDate = new Date(apt.appointmentDate)
                        return (
                          <div 
                            key={apt.id} 
                            className="p-3.5 rounded-2xl border border-slate-200/60 bg-slate-50/50 hover:bg-slate-50 transition-colors flex justify-between items-start gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  apt.status === 'CONFIRMED' ? 'bg-green-50 text-green-600 border-green-100' :
                                  apt.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                  'bg-red-50 text-red-600 border-red-100'
                                }`}>
                                  {apt.status === 'CONFIRMED' ? 'Confirmada' : apt.status === 'PENDING' ? 'Pendiente' : 'Cancelada'}
                                </span>
                                {apt.origin === 'BOT' && (
                                  <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center gap-0.5">
                                    <Sparkles className="w-2 h-2 text-purple-500 animate-pulse" />
                                    IA Bot
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-xs font-extrabold text-slate-800 font-syst truncate">{apt.customerName}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{apt.customerPhone}</p>
                              
                              {apt.specialty && (
                                <p className="text-[9px] text-primary font-bold uppercase tracking-wide mt-2">
                                  {apt.specialty}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 flex flex-col items-end text-right">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                {aptDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-xs font-black text-slate-700 mt-0.5">
                                {aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              
                              <div className="flex gap-1.5 mt-3">
                                {apt.status === 'PENDING' && (
                                  <>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="w-6 h-6 rounded-lg text-green-600 hover:bg-green-50 shrink-0 border border-transparent hover:border-green-100"
                                      onClick={() => handleStatusChange(apt.id, 'CONFIRMED')}
                                      title="Confirmar Cita"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="w-6 h-6 rounded-lg text-red-600 hover:bg-red-50 shrink-0 border border-transparent hover:border-red-100"
                                      onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                                      title="Cancelar Cita"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="integration-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Header Card */}
              <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-syst">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl text-white shadow-md shadow-primary/10">
                    <Database className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 font-syst">
                      Vincular CRM de Terceros
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Sincroniza tus prospectos, contactos y actividades de conversación omnicanal con tu CRM actual.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-syst">
                  {crmConnection?.isConnected ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Activo & Conectado
                    </span>
                  ) : (
                    <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Sin Conexión Activa
                    </span>
                  )}
                </div>
              </div>

              {/* Main Grid: Status & Sync Settings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-syst">
                
                {/* Column 1: Connection Details */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-6">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 font-syst">
                      Estado de la Integración
                    </h4>

                    {crmConnection?.provider && crmConnection.provider !== 'NONE' ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/50 p-4 rounded-2xl">
                          <div className="p-3 bg-white border border-slate-200/60 rounded-xl font-bold text-slate-800 shadow-2xs font-mono text-xs shrink-0">
                            {crmProviders.find(p => p.value === crmConnection.provider)?.label || crmConnection.provider}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-700 font-syst">Proveedor CRM Seleccionado</p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                              {crmConnection.provider === 'GOOGLE_SHEETS' 
                                ? `Google Sheets - ID: ${crmConnection.config?.spreadsheetId || 'No configurado'}`
                                : crmConnection.provider === 'META_CRM'
                                  ? `Meta Graph CRM - ID Página: ${crmConnection.config?.pageId || 'No configurado'}`
                                  : `Autenticado vía API Key / OAuth Token`}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Dirección de Sincronización</span>
                            <span className="text-xs font-extrabold text-slate-700 mt-1 block font-syst">
                              {crmConnection.syncDirection === 'BIDIRECTIONAL' ? 'Bidireccional (Dos Vías)' : 
                               crmConnection.syncDirection === 'TO_CRM' ? 'Solo Exportar a CRM' : 'Solo Importar desde CRM'}
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sincronización Automática</span>
                            <span className="text-xs font-extrabold text-slate-700 mt-1 block font-syst">
                              {crmConnection.syncEnabled ? 'Habilitado (Tiempo Real)' : 'Deshabilitado (Manual)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-600 font-syst">No hay ningún CRM configurado</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed font-medium">
                          Conecta Sybot con tus herramientas de ventas favoritas para sincronizar prospectos y automatizar flujos.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-2.5">
                    {crmConnection?.provider && crmConnection.provider !== 'NONE' ? (
                      <>
                        <Button
                          onClick={() => {
                            setSelectedCrmProvider(crmConnection.provider)
                            setCrmFormData({
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
                            setConfigCrmDialogOpen(true)
                          }}
                          className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 text-xs px-4 shadow-sm"
                        >
                          <Settings className="w-4 h-4 mr-1.5" />
                          Configurar Credenciales
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleTestCrmConnection}
                          disabled={crmTesting}
                          className="border-slate-200 hover:border-emerald-500 text-slate-600 hover:text-emerald-600 font-bold rounded-xl h-10 text-xs px-4"
                        >
                          {crmTesting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Probando...
                            </>
                          ) : (
                            <>
                              <Wifi className="w-4 h-4 mr-1.5" />
                              Probar Conexión
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleTriggerCrmSync}
                          disabled={crmLoading}
                          className="border-slate-200 hover:border-primary text-slate-600 hover:text-primary font-bold rounded-xl h-10 text-xs px-4"
                        >
                          {crmLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                              Sincronizar Ahora
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={handleDisconnectCrm}
                          disabled={crmLoading}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-100 border border-transparent font-bold rounded-xl h-10 text-xs px-4 ml-auto"
                        >
                          Desvincular
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => {
                          setSelectedCrmProvider('HUBSPOT')
                          setCrmFormData({
                            accessToken: '',
                            refreshToken: '',
                            apiKey: '',
                            apiSecret: '',
                            baseUrl: '',
                            pageId: '',
                            spreadsheetId: '',
                            syncEnabled: true,
                            syncDirection: 'BIDIRECTIONAL',
                          })
                          setConfigCrmDialogOpen(true)
                        }}
                        className="bg-primary hover:bg-primary/90 text-white font-extrabold rounded-xl h-10 text-xs px-5 shadow-md shadow-primary/10"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Configurar CRM de Terceros
                      </Button>
                    )}
                  </div>
                </div>

                {/* Column 2: Channel mappings & Switch toggles */}
                <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm flex flex-col justify-between font-syst">
                  <div className="space-y-6">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 font-syst">
                      Sincronización por Canales
                    </h4>
                    
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Selecciona qué canales de chat omnicanal se enviarán y registrarán automáticamente en tu CRM externo al interactuar con clientes.
                    </p>

                    {crmChannelLoading ? (
                      <div className="flex justify-center py-6 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {crmChannelOptions.map((opt) => {
                          const isEnabled = selectedCrmChannels.includes(opt.key)
                          return (
                            <div 
                              key={opt.key}
                              onClick={() => {
                                setSelectedCrmChannels(prev => 
                                  prev.includes(opt.key) 
                                    ? prev.filter(k => k !== opt.key) 
                                    : [...prev, opt.key]
                                )
                              }}
                              className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer select-none transition-all duration-200 ${
                                isEnabled 
                                  ? 'bg-primary/5 border-primary/20 text-primary' 
                                  : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold font-syst`}>{opt.label}</span>
                              </div>
                              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${isEnabled ? 'bg-primary' : 'bg-slate-200'}`}>
                                <div className={`w-3 h-3 rounded-full bg-white shadow-xs transform transition-transform duration-200 ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100">
                    <Button
                      onClick={handleSaveCrmChannels}
                      disabled={savingCrmChannels || crmChannelLoading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl h-10 text-xs shadow-xs"
                    >
                      {savingCrmChannels ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Guardando Canales...
                        </>
                      ) : (
                        'Guardar Canales de Sync'
                      )}
                    </Button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sincronizaciones Activas Footer */}
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 font-syst">Sincronizaciones Activas</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Integración automatizada en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-650">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Google Cloud</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-655">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>HubSpot</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-450 border-dashed">
              <span className="w-2 h-2 bg-slate-300 rounded-full" />
              <span>Salesforce</span>
            </div>
          </div>
          <Button
            onClick={() => setActiveTab('integration')}
            className="bg-blue-600 hover:bg-blue-750 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs h-10"
          >
            Gestionar Syncs
          </Button>
        </div>
      </div>

      {/* Slide-out Drawer para Detalles de Lead */}
      <AnimatePresence>
        {selectedLead && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLead(null)}
              className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs"
            />

            {/* Sidebar drawer content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white border-l border-slate-200 shadow-[0_0_50px_rgba(0,0,0,0.08)] flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-primary/15">
                    {editForm.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base text-slate-800 font-syst">{editForm.name || 'Detalles de Lead'}</h2>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Lead Omnicanal Activo
                    </span>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedLead(null)}
                  className="rounded-full w-8 h-8 hover:bg-slate-100"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </Button>
              </div>

              {/* Scrollable drawer body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 luxury-scrollbar">
                
                {/* VoIP Direct Action Button */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between text-white">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-primary">Conectividad VoIP WebRTC</p>
                    <p className="text-xs text-slate-300 font-bold">Llamada telefónica interactiva directa</p>
                  </div>
                  <Button
                    onClick={() => startCall(editForm.name || 'Cliente', editForm.phone)}
                    className="bg-primary hover:bg-primary/90 text-white rounded-xl px-4 text-xs font-black uppercase tracking-wide h-10 shadow-lg shadow-primary/20"
                  >
                    <PhoneCall className="w-3.5 h-3.5 mr-2" />
                    Llamar
                  </Button>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2 font-syst">
                    <User className="w-3.5 h-3.5" />
                    Detalles del Contacto
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-name" className="text-xs font-bold text-slate-500">Nombre Completo</Label>
                      <Input
                        id="lead-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-white border-slate-200 text-xs focus-visible:ring-primary h-9 rounded-xl font-medium"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-phone" className="text-xs font-bold text-slate-500">Teléfono (WhatsApp)</Label>
                      <div className="flex gap-1.5">
                        <Input
                          id="lead-phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="bg-white border-slate-200 text-xs focus-visible:ring-primary h-9 rounded-xl font-medium"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          onClick={() => {
                            navigator.clipboard.writeText(editForm.phone)
                            toast({ title: 'Copiado', description: 'Número copiado al portapapeles' })
                          }}
                          className="shrink-0 border-slate-200 hover:bg-slate-100 w-9 h-9 rounded-xl"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="lead-email" className="text-xs font-bold text-slate-500">Correo Electrónico</Label>
                      <Input
                        id="lead-email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Sin correo registrado"
                        className="bg-white border-slate-200 text-xs focus-visible:ring-primary h-9 rounded-xl font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500">Temperatura comercial</Label>
                      <Select value={temperature} onValueChange={setTemperature}>
                        <SelectTrigger className="bg-white border-slate-200 text-xs h-9 rounded-xl focus:ring-primary font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Frío">🔵 Frío (Prospecto)</SelectItem>
                          <SelectItem value="Tibio">🟡 Tibio (Contacto)</SelectItem>
                          <SelectItem value="Caliente">🔴 Caliente (En Cierre)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lead-notes" className="text-xs font-bold text-slate-500">Notas de Venta</Label>
                    <Textarea
                      id="lead-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Agrega comentarios sobre el prospecto, acuerdos de llamada, etc..."
                      className="bg-white border-slate-200 text-xs focus-visible:ring-primary rounded-xl"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={handleSaveLead} 
                      disabled={savingLead}
                      className="bg-primary hover:bg-primary/90 text-white rounded-xl px-5 text-xs font-extrabold h-9 shadow-sm"
                    >
                      {savingLead ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar Cambios'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2 font-syst">
                    <Sparkles className="w-3.5 h-3.5" />
                    Etiquetas de Clasificación
                  </h3>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Nueva etiqueta..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-primary flex-1 font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddTag()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      className="h-9 px-4 text-xs bg-white hover:bg-slate-100 border-slate-200 rounded-xl font-bold text-slate-600"
                    >
                      Añadir
                    </Button>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] px-3 py-1 rounded-full font-black border border-primary/20 uppercase tracking-wide"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-primary/50 hover:text-primary focus:outline-none font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scheduling / Schedule Appointment inside Lead Details */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2 font-syst">
                    <Calendar className="w-3.5 h-3.5" />
                    Agendar Reunión o Cita
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">Programa una cita en la agenda directamente asociada a este prospecto.</p>

                  <Button 
                    onClick={() => {
                      setAppointmentForm({
                        customerName: editForm.name || '',
                        customerPhone: editForm.phone || '',
                        customerEmail: editForm.email || '',
                        appointmentDate: '',
                        duration: '60',
                        specialty: '',
                        specialist: '',
                        notes: '',
                      })
                      setIsScheduleOpen(true)
                    }}
                    variant="outline"
                    className="w-full bg-white hover:bg-slate-100 border-slate-200 rounded-xl font-extrabold text-xs h-10 text-slate-600 hover:text-primary transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-2 text-primary" />
                    Agendar Cita Rápida
                  </Button>
                </div>

                {/* Tasks / Checklist */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2 font-syst">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Recordatorios y Tareas
                  </h3>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      <Input
                        placeholder="Título de la tarea..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-primary font-medium"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="datetime-local"
                          value={newTaskDueDate}
                          onChange={(e) => setNewTaskDueDate(e.target.value)}
                          className="bg-white border-slate-200 text-xs h-9 rounded-xl focus-visible:ring-primary font-medium flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handleAddTask}
                          className="h-9 px-4 text-xs bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shrink-0"
                        >
                          Añadir
                        </Button>
                      </div>
                    </div>

                    {tasks.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-bold uppercase italic py-2">Sin tareas programadas.</p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto luxury-scrollbar pr-1">
                        {tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white border border-slate-200/60 p-3 rounded-xl shadow-xs"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => handleToggleTask(idx)}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className={`text-xs font-bold truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {task.title}
                                </span>
                                {task.dueDate && (
                                  <span className="text-[8px] text-slate-400 font-mono mt-0.5">
                                    Vence: {new Date(task.dueDate).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(idx)}
                              className="text-slate-300 hover:text-red-500 text-xs transition-colors font-bold pl-2"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* VoIP Click-to-Call Simulated Overlay Dialog */}
      <Dialog 
        open={activeCall.isOpen} 
        onOpenChange={(open) => {
          if (!open) endCall()
        }}
      >
        <DialogContent className="max-w-xs bg-slate-950 border border-white/10 text-white rounded-3xl p-6 text-center focus-visible:outline-none">
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-sm mb-4 animate-pulse">
                📞 VoIP WebRTC Active
              </span>
              
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20 relative">
                {activeCall.status === 'connected' && (
                  <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                )}
                {activeCall.leadName?.charAt(0).toUpperCase() || '?'}
              </div>
              
              <h3 className="font-extrabold text-base text-white mt-4 font-syst">{activeCall.leadName}</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{activeCall.phone}</p>
            </div>

            {/* Audio Waveform Animation */}
            <div className="h-12 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-center gap-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-violet-500/5 to-primary/5 animate-pulse" />
              {activeCall.status === 'calling' ? (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse font-mono">Llamando...</p>
              ) : activeCall.status === 'connected' ? (
                // Waves bounce
                [...Array(14)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-gradient-to-t from-primary to-purple-400 rounded-full animate-bounce" 
                    style={{ 
                      height: `${Math.floor(20 + Math.random() * 70)}%`,
                      animationDuration: `${0.3 + Math.random() * 0.7}s`
                    }} 
                  />
                ))
              ) : (
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest font-mono">Llamada Terminada</p>
              )}
            </div>

            {/* Call Timer / Status */}
            <div className="text-center font-mono">
              {activeCall.status === 'calling' ? (
                <span className="text-xs text-slate-400 animate-pulse uppercase tracking-wider font-bold">Conectando WebRTC...</span>
              ) : activeCall.status === 'connected' ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-white">
                    {Math.floor(activeCall.duration / 60).toString().padStart(2, '0')}:
                    {(activeCall.duration % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-green-400 animate-ping" />
                    En línea - Grabando canal
                  </span>
                </div>
              ) : (
                <span className="text-xs text-red-400 uppercase tracking-wider font-bold">Colgando...</span>
              )}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4 border-t border-white/5 pt-5">
              <Button
                size="icon"
                onClick={toggleMute}
                disabled={activeCall.status === 'ended'}
                className={`w-10 h-10 rounded-full border ${
                  activeCall.isMuted 
                    ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30' 
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {activeCall.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Button
                size="icon"
                onClick={endCall}
                className="w-10 h-10 rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Scheduler Dialog */}
      <Dialog 
        open={isScheduleOpen} 
        onOpenChange={(open) => {
          setIsScheduleOpen(open)
          if (!open) {
            setAppointmentForm({
              customerName: '',
              customerPhone: '',
              customerEmail: '',
              appointmentDate: '',
              duration: '60',
              specialty: '',
              specialist: '',
              notes: '',
            })
          }
        }}
      >
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-3xl p-6 focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-slate-800 font-syst">Agendar Cita Comercial</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra una cita o reunión para el negocio actual de forma manual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">Nombre del Cliente</Label>
                <Input
                  value={appointmentForm.customerName}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Ej. Pedro Picapiedra"
                  className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">Teléfono (WhatsApp)</Label>
                <Input
                  value={appointmentForm.customerPhone}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Ej. +51 987654321"
                  className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">Correo Electrónico</Label>
                <Input
                  type="email"
                  value={appointmentForm.customerEmail}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="cliente@correo.com"
                  className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">Duración (minutos)</Label>
                <Input
                  type="number"
                  min={15}
                  step={5}
                  value={appointmentForm.duration}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, duration: e.target.value }))}
                  className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Fecha y Hora de Cita</Label>
              <Input
                type="datetime-local"
                value={appointmentForm.appointmentDate}
                onChange={(e) => setAppointmentForm(prev => ({ ...prev, appointmentDate: e.target.value }))}
                className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">Especialidad / Ramo</Label>
                <Input
                  value={appointmentForm.specialty}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, specialty: e.target.value }))}
                  placeholder="Ej. Odontología / Consulta"
                  className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-500">Especialista / Asesor</Label>
                <Input
                  value={appointmentForm.specialist}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, specialist: e.target.value }))}
                  placeholder="Ej. Dra. Ana Soto"
                  className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500">Notas de Reserva</Label>
              <Textarea
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Comentarios o indicaciones para la cita..."
                rows={2}
                className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsScheduleOpen(false)}
              disabled={scheduling}
              className="text-xs font-bold rounded-xl h-10 border border-slate-200 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleScheduleAppointment} 
              disabled={scheduling}
              className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs h-10 rounded-xl px-5 shadow-sm"
            >
              {scheduling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Programar Cita'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de Configuración de CRM */}
      <Dialog 
        open={configCrmDialogOpen} 
        onOpenChange={(open) => {
          setConfigCrmDialogOpen(open)
          if (!open) {
            setSelectedCrmProvider(crmConnection?.provider || 'NONE')
          }
        }}
      >
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-3xl p-6 focus-visible:outline-none font-syst">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-slate-800 font-syst">Configurar Integración CRM</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ingresa las credenciales y parámetros de conexión para el CRM seleccionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 font-syst">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500 font-syst">Proveedor CRM</Label>
              <Select 
                value={selectedCrmProvider} 
                onValueChange={(val) => setSelectedCrmProvider(val)}
              >
                <SelectTrigger className="w-full bg-white border-slate-200 text-xs rounded-xl focus:ring-primary h-9 font-medium font-syst">
                  <SelectValue placeholder="Selecciona un CRM" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-100 rounded-xl shadow-md font-syst">
                  {crmProviders.map((prov) => (
                    <SelectItem key={prov.value} value={prov.value} className="text-xs font-medium focus:bg-slate-50 font-syst">
                      {prov.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCrmProvider !== 'NONE' && (
              <>
                {/* Access Token for Meta / Google Sheets / OAuth CRMs */}
                {['META_CRM', 'GOOGLE_SHEETS', 'HUBSPOT', 'SALESFORCE', 'ZOHO', 'PIPEDRIVE', 'MONDAY'].includes(selectedCrmProvider) && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">
                      {['HUBSPOT', 'SALESFORCE', 'ZOHO', 'PIPEDRIVE', 'MONDAY'].includes(selectedCrmProvider) ? 'Token de Acceso / OAuth' : 'Access Token'}
                    </Label>
                    <Input
                      type="password"
                      value={crmFormData.accessToken}
                      onChange={(e) => setCrmFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Ingrese el token de acceso..."
                      className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                    />
                  </div>
                )}

                {/* Refresh Token for OAuth CRMs (optional) */}
                {['HUBSPOT', 'SALESFORCE', 'ZOHO', 'PIPEDRIVE', 'MONDAY'].includes(selectedCrmProvider) && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">Refresh Token (Opcional)</Label>
                    <Input
                      type="password"
                      value={crmFormData.refreshToken}
                      onChange={(e) => setCrmFormData(prev => ({ ...prev, refreshToken: e.target.value }))}
                      placeholder="Ingrese el refresh token..."
                      className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                    />
                  </div>
                )}

                {/* API Key / Client Secret (HubSpot, Monday, Pipedrive, Zoho, Custom) */}
                {['HUBSPOT', 'MONDAY', 'PIPEDRIVE', 'CUSTOM'].includes(selectedCrmProvider) && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">API Key</Label>
                    <Input
                      type="password"
                      value={crmFormData.apiKey}
                      onChange={(e) => setCrmFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Ingrese la clave API..."
                      className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                    />
                  </div>
                )}

                {/* Config Page ID for Meta CRM */}
                {selectedCrmProvider === 'META_CRM' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">ID de Página de Facebook</Label>
                    <Input
                      value={crmFormData.pageId}
                      onChange={(e) => setCrmFormData(prev => ({ ...prev, pageId: e.target.value }))}
                      placeholder="Ej. 1029384756"
                      className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                    />
                  </div>
                )}

                {/* Spreadsheet ID for Google Sheets */}
                {selectedCrmProvider === 'GOOGLE_SHEETS' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">ID de Google Spreadsheet</Label>
                    <Input
                      value={crmFormData.spreadsheetId}
                      onChange={(e) => setCrmFormData(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                      placeholder="Ej. 1a2b3c4d5e6f7g8h9i..."
                      className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                    />
                  </div>
                )}

                {/* Custom API parameters */}
                {selectedCrmProvider === 'CUSTOM' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-500 font-syst">API Secret</Label>
                      <Input
                        type="password"
                        value={crmFormData.apiSecret}
                        onChange={(e) => setCrmFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
                        placeholder="Ingrese la firma secreta API..."
                        className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-500 font-syst">URL Base</Label>
                      <Input
                        value={crmFormData.baseUrl}
                        onChange={(e) => setCrmFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                        placeholder="https://mi-api.com/v1 font-syst"
                        className="bg-white border-slate-200 text-xs rounded-xl focus-visible:ring-primary h-9 font-medium font-syst"
                      />
                    </div>
                  </>
                )}

                {/* Sync Direction & Active Toggle */}
                <div className="grid grid-cols-2 gap-4 font-syst">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">Dirección</Label>
                    <Select
                      value={crmFormData.syncDirection}
                      onValueChange={(val) => setCrmFormData(prev => ({ ...prev, syncDirection: val }))}
                    >
                      <SelectTrigger className="bg-white border-slate-200 text-xs rounded-xl focus:ring-primary h-9 font-medium font-syst">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-100 rounded-xl shadow-md font-syst">
                        <SelectItem value="BIDIRECTIONAL" className="text-xs font-medium font-syst">Bidireccional</SelectItem>
                        <SelectItem value="TO_CRM" className="text-xs font-medium font-syst">Exportar a CRM</SelectItem>
                        <SelectItem value="FROM_CRM" className="text-xs font-medium font-syst">Importar de CRM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-500 font-syst">Sincronización</Label>
                    <div className="flex items-center gap-2 h-9 border border-slate-200 rounded-xl px-3 bg-white font-syst">
                      <input
                        type="checkbox"
                        id="syncEnabledCheck"
                        checked={crmFormData.syncEnabled}
                        onChange={(e) => setCrmFormData(prev => ({ ...prev, syncEnabled: e.target.checked }))}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="syncEnabledCheck" className="text-xs text-slate-600 font-bold cursor-pointer font-syst">
                        Activa
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 mt-2 font-syst">
            <Button
              variant="ghost"
              onClick={() => setConfigCrmDialogOpen(false)}
              disabled={crmLoading}
              className="text-xs font-bold rounded-xl h-10 border border-slate-200 hover:bg-slate-50 font-syst"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveCrmConnection} 
              disabled={crmLoading || selectedCrmProvider === 'NONE'}
              className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs h-10 rounded-xl px-5 shadow-sm font-syst"
            >
              {crmLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin font-syst" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuración'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
