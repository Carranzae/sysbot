import React, { useState } from 'react';
import { History, Save, RotateCcw, CheckCircle2, Clock, Trash2, FileJson, Share2 } from 'lucide-react';

export function VersionsTool() {
  const [snapshots, setSnapshots] = useState([
    { id: '1', name: 'Primer Corte - Estilo 9:16', time: 'Hace 10 min', active: false },
    { id: '2', name: 'Version Cine 21:9 - Edit B', time: 'Hace 2 min', active: true },
  ]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <History className="w-4 h-4 text-primary" /> Historial de Versiones Pro
        </div>
      </div>

      <div className="space-y-4">
        <button className="w-full py-4 bg-primary text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
           <Save className="w-4 h-4" /> Crear Snapshot del Proyecto
        </button>

        <div className="space-y-2">
           <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-3 px-1 text-left">Versiones Guardadas</div>
           {snapshots.map((s) => (
             <div 
               key={s.id}
               className={`group p-4 rounded-[2rem] border transition-all flex items-center justify-between ${s.active ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-white/2 border-white/5 hover:border-white/10'}`}
             >
                <div className="flex items-center gap-3">
                   <div className={`p-2 rounded-xl bg-black/40 ${s.active ? 'text-primary' : 'text-slate-600'}`}>
                      <FileJson className="w-4 h-4" />
                   </div>
                   <div className="flex flex-col text-left leading-tight">
                      <span className="text-[11px] font-black text-white uppercase tracking-tighter">{s.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                         <Clock className="w-3 h-3 text-slate-500" />
                         <span className="text-[8px] text-slate-500 font-bold uppercase">{s.time}</span>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                   <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400" title="Restaurar"><RotateCcw className="w-3.5 h-3.5" /></button>
                   <button className="p-2 hover:bg-red-500/20 rounded-lg text-red-500" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
             </div>
           ))}
        </div>

        <div className="p-5 bg-white/5 border border-white/5 rounded-[2.5rem] flex flex-col items-center text-center gap-3 mt-10">
           <Share2 className="w-6 h-6 text-slate-400" />
           <div className="space-y-1">
              <h4 className="text-[10px] font-black text-white uppercase">Colaboración Externa</h4>
              <p className="text-[8px] text-slate-600 font-bold uppercase px-6">Genera un link de revisión para clientes o equipo de post-producción.</p>
           </div>
           <button className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[9px] font-black uppercase text-white transition-all">
              Generar Link de Revisión
           </button>
        </div>
      </div>
    </div>
  );
}
