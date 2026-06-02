import React from 'react';
import { Zap, Sparkles, MoveRight, Maximize2, RotateCcw, Box, Wind, Flame, Infinity, RefreshCw, ScissorsSquare, Expand } from 'lucide-react';

interface TransitionsToolProps {
  activeClipId: string | null;
  onApplyTransition: (clipId: string, transition: any) => void;
}

export function TransitionsTool({ activeClipId, onApplyTransition }: TransitionsToolProps) {
  const [duration, setDuration] = React.useState(0.5);

  const TRANSITION_TYPES = [
    { id: 'cut', label: 'Corte', icon: ScissorsSquare, color: 'text-slate-400' },
    { id: 'zoom-in', label: 'Zoom In', icon: Maximize2, color: 'text-cyan-400' },
    { id: 'zoom-out', label: 'Zoom Out', icon: Expand, color: 'text-sky-400' },
    { id: 'glitch', label: 'Glitch 3D', icon: Zap, color: 'text-fuchsia-500' },
    { id: 'spin', label: 'Rotación', icon: RefreshCw, color: 'text-pink-400' },
    { id: 'flash', label: 'Flash Blanco', icon: Sparkles, color: 'text-white' },
    { id: 'burn', label: 'Film Burn', icon: Flame, color: 'text-orange-500' },
    { id: 'dissolve', label: 'Disolver', icon: Wind, color: 'text-slate-300' },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-[11px] text-white font-black uppercase tracking-widest flex items-center gap-2">
          <Infinity className="w-4 h-4 text-pink-500" /> Transiciones
        </div>
      </div>

      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
         <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Duración</span>
            <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded-md">{duration}s</span>
         </div>
         <input 
            type="range" min="0.1" max="2.0" step="0.1"
            value={duration} 
            onChange={(e) => setDuration(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-pink-500 bg-white/10 rounded-full appearance-none cursor-pointer" 
         />
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {TRANSITION_TYPES.map((t) => (
          <button 
            key={t.id} 
            onClick={() => activeClipId && onApplyTransition(activeClipId, { id: t.id, duration })}
            className="group relative h-20 bg-[#0a0c10] border border-white/10 rounded-xl hover:border-pink-500/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden"
          >
            <t.icon className={`w-5 h-5 ${t.color} group-hover:scale-110 transition-transform duration-300`} />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">{t.label}</span>
          </button>
        ))}
      </div>

      <button className="w-full py-3 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-pink-400 transition-all flex items-center justify-center gap-2">
        <Infinity className="w-3.5 h-3.5" /> Aplicar a todos
      </button>
    </div>
  );
}
