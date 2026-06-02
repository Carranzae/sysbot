"use client";

import { useState, useEffect } from 'react';
import { Brain, Star, Activity, BookOpen, AlertTriangle, RefreshCw, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBusinessStore } from '@/store/business';

export default function LearningPage() {
  const { toast } = useToast();
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);

  // States
  const [learningLogs, setLearningLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedBusiness) return;
    refreshLearningLogs();
  }, [selectedBusiness]);

  const refreshLearningLogs = () => {
    setIsLoading(true);
    setTimeout(() => {
      setLearningLogs([
        {
          id: 'log-1',
          logDate: new Date().toISOString(),
          analyzedTickets: 142,
          optimizedRagCount: 4,
          performanceScore: 96.5,
          insights: 'El bot resolvió de manera autónoma el 96.5% de las consultas de hoy. El Estudiante Virtual optimizó la base RAG vectorizando 4 nuevos sinónimos clave relacionados con demoras de envíos e inconformidades menores detectadas en los chats del mediodía.',
          criticalIssues: [
            { category: 'Desvío semántico', detail: 'Fricción menor al consultar costos de envío internacionales.' }
          ]
        },
        {
          id: 'log-2',
          logDate: new Date(Date.now() - 86400000).toISOString(),
          analyzedTickets: 98,
          optimizedRagCount: 7,
          performanceScore: 92.0,
          insights: 'Se detectaron solicitudes de traspaso de asesores por problemas técnicos de cupones. El Estudiante Virtual optimizó el RAG inyectando 7 especificaciones semánticas sobre cupones de descuento no válidos.',
          criticalIssues: [
            { category: 'Solicitud de Asesor', detail: 'El bot falló al aplicar el cupón PROMO50.' }
          ]
        }
      ]);
      setIsLoading(false);
    }, 600);
  };

  const handleTriggerDrill = () => {
    setIsLoading(true);
    setTimeout(() => {
      const newLog = {
        id: `log-${Date.now()}`,
        logDate: new Date().toISOString(),
        analyzedTickets: 12,
        optimizedRagCount: 2,
        performanceScore: 98.0,
        insights: 'Sesión de auto-estudio activada manualmente. Escaneo express de las conversaciones de la última hora completado. RAG optimizado con 2 ajustes contextuales.',
        criticalIssues: []
      };
      setLearningLogs([newLog, ...learningLogs]);
      setIsLoading(false);
      toast({
        title: 'Auto-Estudio Completado',
        description: 'El Estudiante Virtual ha analizado los últimos tickets y optimizado la base RAG.',
      });
    }, 1200);
  };

  if (!selectedBusiness) {
    return (
      <div className="p-8 text-center bg-[#0d0f14] min-h-screen text-slate-400">
        <p className="text-lg">Selecciona un negocio para auditar los reportes del Estudiante Virtual.</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#0b0c10] text-slate-100 min-h-screen space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Memoria & Aprendizaje Diario</h1>
            <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono animate-pulse">
              🧠 Estudiante Virtual Activo
            </Badge>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase mt-1 tracking-wider">
            Reportes nocturnos de auto-estudio y optimización semántica del RAG del negocio
          </p>
        </div>
        <Button
          onClick={handleTriggerDrill}
          disabled={isLoading}
          className="bg-sky-500 hover:bg-sky-600 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest px-6 h-12"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Forzar Auto-Estudio RAG
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Efectividad General</div>
            <div className="text-3xl font-black text-sky-400">95.5%</div>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Conversaciones Auditadas</div>
            <div className="text-3xl font-black text-white">252</div>
          </div>
          <div className="p-3 bg-white/5 rounded-xl text-slate-300">
            <BookOpen className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Optimización Semánticas</div>
            <div className="text-3xl font-black text-purple-400">13 RAGs</div>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
            <Brain className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Historial de Reportes del Estudiante Virtual */}
      <div className="space-y-6">
        <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <Activity className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-black uppercase tracking-wider font-mono">Historial de Aprendizaje Diario</h2>
          </div>

          <div className="space-y-6">
            {learningLogs.map((log) => (
              <div key={log.id} className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between w-full border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white font-mono">{new Date(log.logDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-mono">
                      Efectividad: {log.performanceScore}%
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-500 font-mono">
                    <span>Auditados: {log.analyzedTickets} chats</span>
                    <span>Optimizados: {log.optimizedRagCount} vectores</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {log.insights}
                </p>

                {log.criticalIssues.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> Fricciones Detectadas y Corregidas
                    </div>
                    {log.criticalIssues.map((issue: any, index: number) => (
                      <div key={index} className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-[11px] text-rose-300">
                        <strong>[{issue.category}]</strong> {issue.detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
