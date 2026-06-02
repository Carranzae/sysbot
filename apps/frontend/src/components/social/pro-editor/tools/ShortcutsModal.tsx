import React from 'react';
import { Command, Scissors, Trash2, Save, Play, Search, ZoomIn, ZoomOut, Maximize, MousePointer2, Move, Copy } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const SHORTCUTS = [
    { key: 'S', action: 'Cortar Clip (Blade)', icon: Scissors },
    { key: 'DEL', action: 'Borrar Seleccionado', icon: Trash2 },
    { key: 'SPACE', action: 'Play / Pausa', icon: Play },
    { key: 'CTRL + S', action: 'Guardar Proyecto', icon: Save },
    { key: 'V', action: 'Herramienta Selección', icon: MousePointer2 },
    { key: 'Z + Drag', action: 'Zoom en Timeline', icon: Search },
    { key: 'ALT + Drag', action: 'Duplicar Elemento', icon: Copy },
    { key: 'F', action: 'Pantalla Completa', icon: Maximize },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-[3rem] p-10 shadow-[0_0_100px_rgba(var(--primary),0.2)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] opacity-30 -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex items-center gap-4 mb-10">
           <div className="p-3 bg-primary/20 rounded-2xl">
              <Command className="w-6 h-6 text-primary" />
           </div>
           <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Keyboard Mastery</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Optimiza tu flujo de trabajo industrial</p>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {SHORTCUTS.map((s, i) => (
             <div key={i} className="flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl group hover:border-primary/40 transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
                      <s.icon className="w-4 h-4" />
                   </div>
                   <span className="text-[11px] font-black text-white/80 uppercase tracking-tight">{s.action}</span>
                </div>
                <div className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg shadow-inner">
                   <span className="text-[10px] font-mono font-black text-primary tracking-tighter">{s.key}</span>
                </div>
             </div>
           ))}
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 py-4 bg-white text-black text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-primary hover:text-white transition-all shadow-xl shadow-black/20"
        >
          Entendido, Master
        </button>
      </div>
    </div>
  );
}
