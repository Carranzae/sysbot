import React, { useMemo } from 'react';
import { Activity, BarChart3, LineChart } from 'lucide-react';

interface CinematicScopesProps {
  isPlaying: boolean;
}

export function CinematicScopes({ isPlaying }: CinematicScopesProps) {
  // Generar datos de "señal de video" simulada que reaccione al play
  const waveformData = useMemo(() => {
    return Array.from({ length: 40 }).map(() => Math.random() * 100);
  }, [isPlaying]);

  return (
    <div className="absolute right-6 top-24 z-[100] flex flex-col gap-4 animate-in slide-in-from-right-8 duration-700 pointer-events-none">
      {/* Waveform Monitor (Luma) */}
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-48 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">Waveform (Luma)</span>
          </div>
          <span className="text-[7px] font-mono text-emerald-400">100 IRE</span>
        </div>
        
        <div className="h-24 flex items-end gap-[1px] relative">
          {/* IRE Grid */}
          <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
             {[0, 25, 50, 75, 100].map(v => <div key={v} className="w-full h-px bg-white" />)}
          </div>
          
          {waveformData.map((v, i) => (
            <div 
              key={i}
              className={`flex-1 bg-primary/40 rounded-t-sm transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
              style={{ height: `${20 + (v * 0.8)}%`, opacity: 0.3 + (v/200) }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[6px] font-mono text-white/20 uppercase">
          <span>Shadows</span>
          <span>Mids</span>
          <span>Highlights</span>
        </div>
      </div>

      {/* R.G.B Parade Simulation */}
      <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-3 w-48">
        <div className="flex items-center gap-2 mb-2">
          <LineChart className="w-2.5 h-2.5 text-slate-400" />
          <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">RGB Parade</span>
        </div>
        <div className="grid grid-cols-3 gap-2 h-12">
          {['bg-red-500/20', 'bg-emerald-500/20', 'bg-blue-500/20'].map((c, i) => (
            <div key={i} className={`h-full rounded ${c} relative overflow-hidden`}>
               <div className={`absolute bottom-0 left-0 right-0 ${c.replace('/20', '/40')} transition-all duration-500`} style={{ height: `${40 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Technical Metadata Feed */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-2 w-48">
         <div className="text-[6px] font-mono text-primary/60 space-y-1">
            <div className="flex justify-between"><span>RAW_DATA_STREAM:</span> <span className="text-white">ACTIVE</span></div>
            <div className="flex justify-between"><span>COLOR_SPACE:</span> <span className="text-white">REC.709 MASTER</span></div>
            <div className="flex justify-between"><span>LATENCY:</span> <span className="text-white">0.4ms</span></div>
         </div>
      </div>
    </div>
  );
}
