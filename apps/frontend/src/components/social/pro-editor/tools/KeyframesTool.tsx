import React, { useState } from 'react';
import { Target, Plus, Minus, Move, Maximize2, RotateCcw, Droplets, Zap, Activity, Wand2, MousePointer2 } from 'lucide-react';

interface KeyframesToolProps {
  selectedElementId: string | null;
  playheadSec: number;
  elements: any[];
  onAddKeyframe: (elementId: string, property: string, time: number, value: number) => void;
}

export function KeyframesTool({ selectedElementId, playheadSec, elements, onAddKeyframe }: KeyframesToolProps) {
  const [activeProperty, setActiveProperty] = useState('scale');
  
  const selectedElement = elements.find(el => el.id === selectedElementId);
  
  const PROPERTIES = [
    { id: 'scale', label: 'Escala', icon: Maximize2, color: 'text-primary' },
    { id: 'opacity', label: 'Opacidad', icon: Droplets, color: 'text-sky-400' },
    { id: 'rotation', label: 'Rotación', icon: RotateCcw, color: 'text-amber-400' },
    { id: 'x', label: 'Posición X', icon: Move, color: 'text-white' },
    { id: 'y', label: 'Posición Y', icon: Move, color: 'text-white' },
  ];

  if (!selectedElementId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4 animate-in fade-in duration-500">
         <div className="w-16 h-16 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center">
            <MousePointer2 className="w-8 h-8 text-slate-500" />
         </div>
         <div className="space-y-1">
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Sin Selección</h3>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Selecciona un elemento en el canvas para animar con keyframes.</p>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Animation Bezier Master
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[7px] text-emerald-400 font-black border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase bg-emerald-500/10 animate-pulse">Live Curve Engine</span>
        </div>
      </div>

      <div className="space-y-4">
         <div className="grid grid-cols-5 gap-1.5">
            {PROPERTIES.map(p => (
              <button 
                key={p.id}
                onClick={() => setActiveProperty(p.id)}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${activeProperty === p.id ? 'bg-primary/20 border-primary text-white' : 'bg-white/2 border-white/5 text-slate-500 hover:text-white hover:border-white/20'}`}
              >
                 <p.icon className="w-4 h-4" />
                 <span className="text-[7px] font-black uppercase tracking-tighter">{p.label}</span>
              </button>
            ))}
         </div>

         <div className="p-6 bg-[#0d1117] border border-white/5 rounded-[2.5rem] space-y-6 shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            <div className="flex items-center justify-between relative z-10">
               <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Propiedad: <span className="text-primary">{activeProperty}</span></span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Interpolación: Cubic Bezier (In-Out)</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="text-[9px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">{(selectedElement[activeProperty] || 0).toFixed(1)}</div>
               </div>
            </div>

            {/* Bezier Curve Visualizer - Simplified Pro View */}
            <div className="h-24 w-full bg-black/40 rounded-2xl border border-white/5 relative flex items-center justify-center overflow-hidden">
               <svg className="absolute inset-0 w-full h-full opacity-30">
                  <path d="M 0 80 Q 50 10 100 80" stroke="currentColor" fill="none" className="text-primary w-full h-full" vectorEffect="non-scaling-stroke" />
               </svg>
               <div className="absolute w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),1)] animate-pulse" style={{ left: '50%' }} />
               <div className="flex flex-col items-center gap-1 z-10">
                  <Activity className="w-5 h-5 text-primary opacity-40" />
                  <span className="text-[8px] text-white/20 font-black uppercase">Visualizing Curve...</span>
               </div>
            </div>

            <div className="flex gap-2">
               <button 
                 onClick={() => onAddKeyframe(selectedElementId, activeProperty, playheadSec, selectedElement[activeProperty] || 100)}
                 className="flex-1 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
               >
                  <Plus className="w-4 h-4 inline mr-2" /> Agregar Keyframe
               </button>
               <button className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/5 transition-all">
                  <Wand2 className="w-4 h-4" />
               </button>
            </div>
         </div>

         <div className="space-y-2">
            <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-3 px-1 text-left">Keyframe Sequence (Track)</div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
               {[1, 2].map(k => (
                 <div key={k} className="p-3 bg-white/2 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/20 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_5px_rgba(var(--primary),1)]" />
                       </div>
                       <div className="flex flex-col text-left leading-tight">
                          <span className="text-[9px] font-black text-white uppercase tracking-tighter">Frame {k}</span>
                          <span className="text-[8px] text-slate-600 font-mono tracking-tighter">Tiempo: 0:0{k * 2}.00s • Val: {100 + k*10}%</span>
                       </div>
                    </div>
                    <button className="p-1.5 text-slate-700 hover:text-red-500 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                 </div>
               ))}
            </div>
         </div>

         <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center gap-4">
            <Zap className="w-6 h-6 text-amber-500" />
            <div className="flex flex-col text-left">
               <span className="text-[10px] font-black text-white uppercase tracking-tighter">Motion Easing AI</span>
               <span className="text-[8px] text-slate-500 font-bold uppercase leading-tight px-1">Aplica suavizado orgánico a todos los movimientos automáticamente.</span>
            </div>
         </div>
      </div>
    </div>
  );
}
