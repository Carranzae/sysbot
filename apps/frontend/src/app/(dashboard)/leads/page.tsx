'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useBusinessStore } from '@/store/business'
import { leadsApi, messagesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  User
} from 'lucide-react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COLUMNS = [
  { id: 'NEW', title: 'Nuevos Prospectos', color: 'bg-blue-50/50 border-blue-200', headerColor: 'text-blue-700 bg-blue-100/50' },
  { id: 'CONTACTED', title: 'Contactados', color: 'bg-yellow-50/50 border-yellow-200', headerColor: 'text-yellow-700 bg-yellow-100/50' },
  { id: 'QUALIFIED', title: 'En Negociación', color: 'bg-purple-50/50 border-purple-200', headerColor: 'text-purple-700 bg-purple-100/50' },
  { id: 'CONVERTED', title: 'Convertidos (Ganados)', color: 'bg-green-50/50 border-green-200', headerColor: 'text-green-700 bg-green-100/50' },
  { id: 'LOST', title: 'Descartados', color: 'bg-red-50/50 border-red-200', headerColor: 'text-red-700 bg-red-100/50' }
]

export default function LeadsKanbanPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Drawer / Side Panel States
  const [selectedLead, setSelectedLead] = useState<any | null>(null)
  const [notes, setNotes] = useState('')
  const [savingLead, setSavingLead] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
  })

  // CRM metadata states
  const [temperature, setTemperature] = useState('Frío')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [tasks, setTasks] = useState<any[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadLeads = useCallback(async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      const response = await leadsApi.getAll(selectedBusiness.id)
      setLeads(response.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los leads',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness, toast])

  useEffect(() => {
    if (selectedBusiness) {
      loadLeads()
    }
  }, [selectedBusiness, loadLeads])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const leadId = draggableId
    const newStatus = destination.droppableId

    // Optimistic UI update
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead))
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null)
    }

    try {
      await leadsApi.update(leadId, { status: newStatus })
      toast({
        title: 'Estado actualizado',
        description: 'El lead se ha movido correctamente.',
      })
    } catch (error) {
      // Revert on error
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: source.droppableId } : lead))
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, status: source.droppableId } : null)
      }
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el lead',
        variant: 'destructive',
      })
    }
  }

  const loadMessages = async (phone: string) => {
    if (!selectedBusiness) return
    setLoadingMessages(true)
    try {
      const response = await messagesApi.getConversation(selectedBusiness.id, phone)
      // Reverse messages so they read chronologically
      const sorted = [...response.data].reverse()
      setMessages(sorted)
    } catch (error) {
      console.error('Error fetching conversation:', error)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }

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
      console.error('Error parsing metadata:', e)
    }
    
    setTemperature(metadataObj.temperature || 'Frío')
    setTags(metadataObj.tags || [])
    setTasks(metadataObj.tasks || [])
    setNewTag('')
    setNewTaskTitle('')
    setNewTaskDueDate('')

    loadMessages(lead.phone)
  }

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

  const handleSaveAll = async () => {
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
      
      // Update local Kanban list
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...updatedData } : l))
      setSelectedLead(prev => prev ? { ...prev, ...updatedData } : null)
      
      toast({
        title: 'Lead actualizado',
        description: 'La información se ha guardado correctamente.',
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !newMessage.trim() || !selectedBusiness) return
    
    setSendingMessage(true)
    try {
      await messagesApi.sendWebMessage({
        businessId: selectedBusiness.id,
        to: selectedLead.phone,
        message: newMessage,
      })

      // Append local message immediately
      const localMsg = {
        id: new Date().getTime().toString(),
        direction: 'OUTBOUND',
        content: newMessage,
        createdAt: new Date().toISOString(),
        aiResponse: false,
      }
      setMessages(prev => [...prev, localMsg])
      setNewMessage('')
    } catch (error: any) {
      toast({
        title: 'Error al enviar',
        description: error.response?.data?.message || 'No se pudo enviar el mensaje por WhatsApp. Asegúrate de tener una sesión activa.',
        variant: 'destructive',
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const handleCopyPhone = () => {
    if (!selectedLead) return
    navigator.clipboard.writeText(selectedLead.phone)
    toast({
      title: 'Copiado',
      description: 'Número de teléfono copiado al portapapeles.',
    })
  }

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status)

  const newLeads = getLeadsByStatus('NEW').length
  const convertedLeads = getLeadsByStatus('CONVERTED').length
  const conversionRate = leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) : 0

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 mx-4 my-8">
        <Building2 className="w-16 h-16 text-slate-400 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Vista Exclusiva de CRM</h2>
        <p className="text-slate-600 mb-6">Por favor selecciona un negocio para acceder al tablero Kanban interactivo.</p>
        <Link href="/businesses">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-6 text-lg shadow-lg shadow-indigo-200">
            Ir a Negocios
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-2 md:p-6 bg-slate-50/50 min-h-screen relative overflow-hidden">
      {/* Header section with glassmorphism */}
      <div className="relative overflow-hidden rounded-3xl bg-white/60 backdrop-blur-xl border border-white/80 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-gradient-to-tr from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
              CRM Interactivo
            </h1>
            <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Tablero Kanban conectado a WhatsApp en tiempo real para {selectedBusiness.name}
            </p>
          </div>

          <div className="flex gap-4">
            <Card className="bg-white/80 border-none shadow-sm min-w-[140px]">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Users className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total Leads</p>
                  <p className="text-2xl font-bold text-slate-900">{leads.length}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 border-none shadow-sm min-w-[140px]">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <UserCheck className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Conversión</p>
                  <p className="text-2xl font-bold text-slate-900">{conversionRate}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
          {COLUMNS.map((column) => (
            <div key={column.id} className="min-w-[320px] max-w-[320px] shrink-0 snap-start">
              <div className={`rounded-t-2xl p-4 ${column.headerColor} border-b border-white/20 backdrop-blur-md`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm uppercase tracking-wider">{column.title}</h3>
                  <span className="bg-white/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {getLeadsByStatus(column.id).length}
                  </span>
                </div>
              </div>
              
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`p-3 min-h-[500px] rounded-b-2xl transition-colors duration-200 ${column.color} ${snapshot.isDraggingOver ? 'ring-2 ring-indigo-400 ring-inset bg-white/40' : 'bg-white/20 backdrop-blur-sm'}`}
                  >
                    <AnimatePresence>
                      {getLeadsByStatus(column.id).map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ ...provided.draggableProps.style }}
                              className="mb-3 focus:outline-none"
                            >
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => handleLeadClick(lead)}
                                className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 group relative cursor-pointer
                                  ${snapshot.isDragging ? 'shadow-xl ring-2 ring-indigo-500 rotate-2 scale-105' : 'hover:shadow-md hover:border-indigo-100'} transition-all duration-200`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-bold text-indigo-700">
                                        {lead.name?.charAt(0).toUpperCase() || '?'}
                                      </span>
                                    </div>
                                    <h4 className="font-semibold text-slate-800 text-sm truncate max-w-[180px]">{lead.name}</h4>
                                  </div>
                                  <GripVertical className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab" />
                                </div>

                                <div className="space-y-2 mt-4">
                                  <div className="flex items-center text-xs text-slate-500 gap-2">
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>{lead.phone}</span>
                                  </div>
                                  {lead.email && (
                                    <div className="flex items-center text-xs text-slate-500 gap-2">
                                      <Mail className="w-3.5 h-3.5" />
                                      <span className="truncate">{lead.email}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(lead.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {(() => {
                                      let metadataObj: any = {}
                                      try {
                                        metadataObj = lead.metadata 
                                          ? (typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata) 
                                          : {}
                                      } catch (e) {}
                                      const temp = metadataObj.temperature
                                      if (temp === 'Caliente') {
                                        return <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-bold">🔴 Caliente</span>
                                      } else if (temp === 'Tibio') {
                                        return <span className="text-[9px] bg-yellow-50 text-yellow-600 border border-yellow-100 px-2 py-0.5 rounded-full font-bold">🟡 Tibio</span>
                                      } else if (temp === 'Frío') {
                                        return <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-bold">🔵 Frío</span>
                                      }
                                      return null
                                    })()}
                                    {lead.source && (
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                        {lead.source}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </AnimatePresence>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Slide-out Drawer Panel */}
      <AnimatePresence>
        {selectedLead && (
          <>
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLead(null)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Sidebar drawer content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 z-50 h-full w-full max-w-lg md:max-w-xl bg-white/95 backdrop-blur-md border-l border-slate-200/60 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-100">
                    {selectedLead.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-slate-800">{selectedLead.name}</h2>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-medium mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      Creado el {new Date(selectedLead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedLead(null)}
                  className="rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </Button>
              </div>

              {/* Scrollable Form & Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Lead Profile Fields */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Detalles del Contacto
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="lead-name" className="text-xs text-slate-500">Nombre Completo</Label>
                      <Input
                        id="lead-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-white border-slate-200 text-sm focus-visible:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="lead-phone" className="text-xs text-slate-500">Teléfono (WhatsApp)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="lead-phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="bg-white border-slate-200 text-sm focus-visible:ring-indigo-500"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          onClick={handleCopyPhone}
                          className="shrink-0 border-slate-200 hover:bg-slate-100"
                        >
                          <Copy className="w-4 h-4 text-slate-500" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="lead-email" className="text-xs text-slate-500">Correo Electrónico</Label>
                      <Input
                        id="lead-email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="sin correo electrónico"
                        className="bg-white border-slate-200 text-sm focus-visible:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Estado / Columna</Label>
                      <Select 
                        value={selectedLead.status} 
                        onValueChange={(val) => onDragEnd({
                          draggableId: selectedLead.id,
                          source: { droppableId: selectedLead.status, index: 0 },
                          destination: { droppableId: val, index: 0 }
                        } as any)}
                      >
                        <SelectTrigger className="bg-white border-slate-200 text-sm focus:ring-indigo-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map(col => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lead-notes" className="text-xs text-slate-500">Notas Internas de Venta</Label>
                    <textarea
                      id="lead-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Agrega comentarios sobre el prospecto, acuerdos de llamada, etc..."
                      className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 font-sans"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={handleSaveAll} 
                      disabled={savingLead}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 text-xs font-semibold h-8"
                    >
                      {savingLead ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar Información'
                      )}
                    </Button>
                  </div>
                </div>

                {/* CRM Attributes */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Clasificación y Seguimiento
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Temperatura del Lead</Label>
                      <Select value={temperature} onValueChange={setTemperature}>
                        <SelectTrigger className="bg-white border-slate-200 text-sm focus:ring-indigo-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Frío">🔵 Frío (Prospecto Nuevo)</SelectItem>
                          <SelectItem value="Tibio">🟡 Tibio (Contacto / Interés)</SelectItem>
                          <SelectItem value="Caliente">🔴 Caliente (En Cierre / Negociación)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Etiquetas (Tags)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nueva etiqueta..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          className="bg-white border-slate-200 text-xs h-9 focus-visible:ring-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddTag}
                          className="h-9 px-3 text-xs bg-white hover:bg-slate-100"
                        >
                          Añadir
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Render Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-semibold border border-indigo-100"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-indigo-400 hover:text-indigo-600 focus:outline-none ml-1 font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tasks & Reminders */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Tareas y Recordatorios
                  </h3>

                  <div className="space-y-3">
                    {/* Add Task Form */}
                    <div className="flex flex-col md:flex-row gap-2">
                      <Input
                        placeholder="Título de la tarea..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="bg-white border-slate-200 text-xs h-9 flex-1 focus-visible:ring-indigo-500"
                      />
                      <Input
                        type="datetime-local"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="bg-white border-slate-200 text-xs h-9 w-full md:w-[180px] focus-visible:ring-indigo-500"
                      />
                      <Button
                        type="button"
                        onClick={handleAddTask}
                        className="h-9 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                      >
                        Agregar
                      </Button>
                    </div>

                    {/* Task List */}
                    {tasks.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No hay tareas pendientes para este lead.</p>
                    ) : (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                        {tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white border border-slate-100 p-2.5 rounded-xl shadow-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => handleToggleTask(idx)}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex flex-col">
                                <span className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {task.title}
                                </span>
                                {task.dueDate && (
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    Límite: {new Date(task.dueDate).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(idx)}
                              className="text-slate-300 hover:text-red-500 text-xs transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Omnichannel Chat Window */}
                <div className="space-y-3 flex flex-col h-[320px] bg-slate-50 rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Historial de Conversación
                    </h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                      Bot Inteligente Activo
                    </span>
                  </div>

                  {/* Messages Bubble Container */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {loadingMessages ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                        <MessageSquare className="w-8 h-8 opacity-40 mb-2" />
                        <p className="text-xs">No hay mensajes anteriores en este chat.</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isCustomer = msg.direction === 'INBOUND'
                        const isAI = msg.aiResponse === true
                        return (
                          <div 
                            key={msg.id} 
                            className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                          >
                            <div 
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                isCustomer 
                                  ? 'bg-white border border-slate-100 text-slate-800' 
                                  : isAI 
                                    ? 'bg-indigo-50 border border-indigo-100 text-indigo-900 font-medium' 
                                    : 'bg-indigo-600 text-white'
                              }`}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                              {isAI && <span className="text-indigo-600 font-bold mr-1">🤖 AI Bot</span>}
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* WhatsApp Message Quick Send Composer */}
                  <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-slate-200">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe un mensaje de WhatsApp directo..."
                      className="bg-white border-slate-200 text-sm focus-visible:ring-indigo-500 h-9"
                    />
                    <Button 
                      type="submit" 
                      disabled={sendingMessage || !newMessage.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 shrink-0 h-9"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

