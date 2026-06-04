"use client";

import { useState, useEffect } from 'react';
import { Phone, BarChart2, Calendar, Star, Clock, Play, List, AlertCircle, FileText, ChevronRight, Activity, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBusinessStore } from '@/store/business';
import { crmCallApi } from '@/lib/api';

export default function CallCenterPage() {
  const { toast } = useToast();
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);

  // States
  const [selectedCall, setSelectedCall] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    totalCalls: 0,
    completedCalls: 0,
    resolvedCalls: 0,
    resolutionRate: '0%',
    avgDurationSeconds: 0,
    avgSurveyScore: '5.0',
  });

  const loadData = async () => {
    if (!selectedBusiness) return;
    setLoading(true);
    try {
      const [logsRes, analyticsRes] = await Promise.all([
        crmCallApi.getLogs(),
        crmCallApi.getAnalytics(),
      ]);
      const logs = logsRes.data || [];
      setCallLogs(logs);
      setAnalytics(analyticsRes.data || {
        totalCalls: 0,
        completedCalls: 0,
        resolvedCalls: 0,
        resolutionRate: '0%',
        avgDurationSeconds: 0,
        avgSurveyScore: '5.0',
      });
      if (logs.length > 0) {
        setSelectedCall(logs[0]);
      } else {
        setSelectedCall(null);
      }
    } catch (err: any) {
      toast({
        title: 'Error al cargar Call Center',
        description: 'No se pudieron cargar los registros de llamadas del backend.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBusiness]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      toast({
        title: 'Escucha Activa',
        description: `Reproduciendo grabación de llamada ID: ${selectedCall?.id.substring(0,6)}`,
      });
    }
  };

  if (!selectedBusiness) {
    return (
      <div className="p-8 text-center bg-[#0d0f14] min-h-screen text-slate-400">
        <p className="text-lg">Selecciona un negocio para ver la consola del Call Center.</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#0b0c10] text-slate-100 min-h-screen space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Escucha Activa & CRM Center</h1>
            <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono">
              📞 VoIP Live Hub
            </Badge>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase mt-1 tracking-wider">
            Audita las llamadas telefónicas del bot, visualiza la tasa de resolución y supervisa las encuestas de clientes
          </p>
        </div>
      </div>

      {/* Indicadores Clave de Desempeño (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Llamadas Totales</div>
            <div className="text-3xl font-black text-white">{analytics.totalCalls}</div>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
            <Phone className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tasa de Resolución</div>
            <div className="text-3xl font-black text-emerald-400">{analytics.resolutionRate}</div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <BarChart2 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Duración Promedio</div>
            <div className="text-3xl font-black text-white">{analytics.avgDurationSeconds}s</div>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Calificación Bot</div>
            <div className="text-3xl font-black text-amber-400 flex items-center gap-1">
              {analytics.avgSurveyScore} <Star className="h-6 w-6 fill-current" />
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <Smile className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Historial de Llamadas */}
        <div className="space-y-6">
          <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <List className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-black uppercase tracking-wider">Historial de Auditoría</h2>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {loading ? (
                <div className="text-center text-xs font-bold text-slate-500 py-8 uppercase tracking-widest animate-pulse">Cargando llamadas...</div>
              ) : callLogs.length === 0 ? (
                <div className="text-center text-xs font-bold text-slate-500 py-8 uppercase tracking-widest">Sin llamadas registradas</div>
              ) : (
                callLogs.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`w-full text-left p-4 rounded-2xl border transition flex flex-col gap-2 ${
                      selectedCall?.id === call.id
                        ? 'border-purple-500 bg-purple-500/5'
                        : 'border-white/5 bg-slate-900/40 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-white">{(call.contact?.firstName ? `${call.contact.firstName} ${call.contact.lastName || ''}` : null) || call.customerPhone || 'Cliente de VoIP'}</span>
                      <Badge className={
                        call.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }>
                        {call.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {call.duration}s</span>
                      <span>{new Date(call.createdAt).toLocaleTimeString()}</span>
                    </div>

                    {call.crmTaskCreated && (
                      <Badge className="bg-red-500/20 text-red-300 border-none text-[8px] font-black uppercase tracking-widest w-fit mt-1">
                        ⚠️ Tarea CRM Creada
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Consola de Escucha Activa (Visualizador y Transcripción) */}
        <div className="xl:col-span-2 space-y-6">
          {selectedCall ? (
            <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">{selectedCall.customerName || selectedCall.customerPhone}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Llamada ID: {selectedCall.id}</p>
                </div>
                {selectedCall.recordingUrl && (
                  <Button
                    onClick={togglePlayback}
                    className="bg-purple-500 hover:bg-purple-600 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-wider px-6 h-11"
                  >
                    <Play className="h-4 w-4 mr-2 fill-current" />
                    {isPlaying ? 'Pausar Escucha' : 'Reproducir Audio'}
                  </Button>
                )}
              </div>

              {/* Animación del espectrograma de voz */}
              {isPlaying && (
                <div className="bg-slate-900/60 rounded-2xl p-6 border border-purple-500/10 flex items-center justify-center gap-1.5 h-24 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-sky-500/5 to-purple-500/5 animate-pulse" />
                  {[...Array(20)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-gradient-to-t from-purple-500 to-sky-400 rounded-full animate-bounce" 
                      style={{ 
                        height: `${Math.floor(20 + Math.random() * 60)}%`,
                        animationDuration: `${0.4 + Math.random() * 0.8}s`
                      }} 
                    />
                  ))}
                </div>
              )}

              {/* Transcripción Dinámica */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Transcripción y Análisis Conversacional
                </div>
                <div className="bg-slate-900/60 rounded-2xl p-6 border border-white/5 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line max-h-60 overflow-y-auto">
                  {selectedCall.transcription || 'No hay transcripción disponible para llamadas no completadas.'}
                </div>
              </div>

              {/* Encuesta de Satisfacción */}
              {selectedCall.surveyScore && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current" />
                      Resultado de Encuesta del Bot
                    </span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-4 w-4 ${i < selectedCall.surveyScore ? 'text-amber-400 fill-current' : 'text-slate-700'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  {selectedCall.surveyFeedback && (
                    <p className="text-xs text-slate-300 italic">"{selectedCall.surveyFeedback}"</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-12 text-center text-slate-500 uppercase tracking-wider">
              Seleccione una llamada para auditar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
