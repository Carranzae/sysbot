'use client';

import { 
  Radio, 
  History, 
  ListChecks, 
  Clock, 
  ArrowUpRight, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SocialChannel } from '@/store/social';

interface ActivityPanelProps {
  channels: SocialChannel[];
}

export function ActivityPanel({ channels }: ActivityPanelProps) {
  return (
    <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-100 bg-white overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white border border-slate-800 shadow-lg shadow-slate-200">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-slate-900 tracking-tight uppercase">Actividad Pro</CardTitle>
            <CardDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Eventos recientes y tareas pendientes para este negocio.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-6">
        <div className="space-y-4">
          <div className="group rounded-[2rem] border border-slate-100 p-6 bg-white shadow-sm hover:border-primary/20 hover:shadow-xl hover:shadow-slate-50 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ListChecks className="h-20 w-20 -mr-4 -mt-4" />
            </div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Tareas asistidas</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pendiente por autorizar</span>
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                0 Pendientes
              </Badge>
            </div>
            <div className="mt-4 p-3 bg-slate-50/50 rounded-2xl text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-tighter border border-slate-100">
              Cuando un canal esté en modo asistido, aquí verás las tareas para finalizar publicación manualmente.
            </div>
          </div>

          <div className="group rounded-[2rem] border border-slate-100 p-6 bg-white shadow-sm hover:border-primary/20 hover:shadow-xl hover:shadow-slate-50 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="h-20 w-20 -mr-4 -mt-4" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                  <History className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Estado de Canales</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monitoreo 24/7 activo</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {channels.slice(0, 4).map((c) => {
                  const isConnected = c.status === 'connected';
                  return (
                    <div key={`activity-${c.key}`} className="flex items-center justify-between text-xs p-3 bg-slate-50/50 rounded-2xl border border-slate-100 group-hover:border-primary/5 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-200 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="font-black text-slate-700 uppercase tracking-widest">{c.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                            <CheckCircle2 className="h-3 w-3" />
                            Live
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200/50">
                            <XCircle className="h-3 w-3" />
                            Offline
                          </div>
                        )}
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
