'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { leadsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Users, TrendingUp, UserCheck, Building2, Phone, Mail, MoreVertical, GripVertical, Calendar } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'

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

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const leadId = draggableId
    const newStatus = destination.droppableId

    // Optimistic UI update
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead))

    try {
      await leadsApi.update(leadId, { status: newStatus })
      toast({
        title: 'Estado actualizado',
        description: 'El lead se ha movido correctamente.',
      })
    } catch (error) {
      // Revert on error
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: source.droppableId } : lead))
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el lead',
        variant: 'destructive',
      })
    }
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
    <div className="space-y-8 p-2 md:p-6 bg-slate-50/50 min-h-screen">
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
              Vista Kanban en tiempo real para {selectedBusiness.name}
            </p>
          </div>

          <div className="flex gap-4">
            <Card className="bg-white/80 border-none shadow-sm min-w-[140px]">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Users className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total</p>
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
                                className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 group relative
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
                                  {lead.source && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                      {lead.source}
                                    </span>
                                  )}
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
    </div>
  )
}
