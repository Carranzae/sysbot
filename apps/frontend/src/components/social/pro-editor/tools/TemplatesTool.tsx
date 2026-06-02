import React, { useState } from 'react';
import { Layout, Sparkles, Zap, Smartphone, LayoutGrid, Monitor, Box, Crown, PlayCircle, Music, Clock, Flame } from 'lucide-react';

interface TemplatesToolProps {
  onApplyStyle: (config: any) => void;
}

export function TemplatesTool({ onApplyStyle }: TemplatesToolProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'layouts'>('trends');

  const TRENDS = [
    { 
      id: 'velocity', 
      label: 'Auto Velocity', 
      desc: 'Sync automático con el beat', 
      icon: Zap, 
      color: 'bg-gradient-to-br from-indigo-500 to-purple-600',
      views: '2.4M'
    },
    { 
      id: 'aesthetic', 
      label: 'Aesthetic Vlog', 
      desc: 'Soft vibes y texto pequeño', 
      icon: Sparkles, 
      color: 'bg-gradient-to-br from-rose-400 to-orange-300',
      views: '1.8M'
    },
    { 
      id: 'flash-warning', 
      label: 'Flash Warning', 
      desc: 'Transiciones rápidas + Shake', 
      icon: Flame, 
      color: 'bg-gradient-to-br from-red-600 to-rose-900',
      views: '5.1M'
    },
    { 
      id: 'cinematic', 
      label: 'Dark Cinematic', 
      desc: 'Contraste alto para autos/gym', 
      icon: Crown, 
      color: 'bg-gradient-to-br from-slate-800 to-black',
      views: '900K'
    },
  ];

  const LAYOUTS = [
    { id: 'split-v', label: 'Pantalla Dividida', icon: Smartphone, desc: 'Reacciones' },
    { id: 'pip', label: 'Pic in Pic', icon: LayoutGrid, desc: 'Gaming/Streaming' },
    { id: 'cine-bars', label: 'Barras de Cine', icon: Monitor, desc: 'Formato 21:9' },
    { id: 'grid-4', label: 'Grid x4', icon: Box, desc: 'Collage' },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
        <button 
          onClick={() => setActiveTab('trends')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'trends' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          <Flame className="w-3.5 h-3.5" /> Tendencias
        </button>
        <button 
          onClick={() => setActiveTab('layouts')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'layouts' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          <Layout className="w-3.5 h-3.5" /> Layouts
        </button>
      </div>

      <div className="space-y-4 custom-scrollbar max-h-[70vh] overflow-y-auto pr-2 pb-10">
        {activeTab === 'trends' ? (
          <div className="grid grid-cols-2 gap-3">
             {TRENDS.map((trend) => (
               <button
                 key={trend.id}
                 className="group relative aspect-[4/5] overflow-hidden rounded-2xl flex flex-col justify-end p-3 hover:scale-[1.02] transition-transform text-left border border-white/10 hover:border-white/30"
               >
                 <div className={`absolute inset-0 opacity-80 ${trend.color} transition-opacity group-hover:opacity-100`} />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                 
                 <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white">
                   <PlayCircle className="w-2.5 h-2.5" /> {trend.views}
                 </div>

                 <div className="relative z-10 flex flex-col gap-1">
                    <trend.icon className="w-4 h-4 text-white/80 mb-1" />
                    <span className="text-[11px] font-black text-white uppercase leading-tight line-clamp-1">{trend.label}</span>
                    <span className="text-[8px] text-slate-300 font-medium line-clamp-2">{trend.desc}</span>
                 </div>
               </button>
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
             {LAYOUTS.map((layout) => (
               <button
                 key={layout.id}
                 className="group aspect-square bg-[#0a0c10] border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-white/30 hover:bg-white/5 transition-all p-2"
               >
                  <layout.icon className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
                  <div className="text-center">
                     <span className="text-[10px] font-black text-white uppercase block">{layout.label}</span>
                     <span className="text-[8px] text-slate-500 font-medium">{layout.desc}</span>
                  </div>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Just to avoid error with undefined Flame inside the TRENDS object
// Added manual import to Flame up above
