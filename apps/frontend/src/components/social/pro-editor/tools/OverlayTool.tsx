import React, { useState } from 'react';
import { Sparkles, Flame, Wind, Cloud, Zap, Sun, Ghost, Wand2, Layers, Aperture } from 'lucide-react';

interface OverlayToolProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export function OverlayTool({ settings, setSettings }: OverlayToolProps) {
  const [activeTab, setActiveTab] = useState<'atmosphere' | 'lens' | 'vandal'>('atmosphere');

  const updateSetting = (key: string, value: any) => {
    setSettings((s: any) => ({ ...s, [key]: value }));
  };

  const OVERLAYS = {
    atmosphere: [
      { id: 'embers', label: 'Ember Particles', icon: Flame, desc: 'Partículas de fuego realistas' },
      { id: 'fog', label: 'Cinematic Fog', icon: Wind, desc: 'Niebla volumétrica densa' },
      { id: 'particles', label: 'Dust & Motes', icon: Cloud, desc: 'Polvo flotante en suspensión' },
      { id: 'rain', label: 'Dynamic Rain', icon: Wind, desc: 'Lluvia digital interactiva' },
    ],
    lens: [
      { id: 'leak', label: 'Light Leak', icon: Sun, desc: 'Fugas de luz vintage 35mm' },
      { id: 'flare', label: 'Lens Flare Pro', icon: Aperture, desc: 'Destello óptico anamórfico' },
      { id: 'bloom', label: 'Dreamy Bloom', icon: Sparkles, desc: 'Suavizado de altas luces' },
      { id: 'grain', label: 'Film Grain 16mm', icon: Layers, desc: 'Grano de película analógico' },
    ],
    vandal: [
      { id: 'glitch', label: 'Data Corruption', icon: Zap, desc: 'Efecto de fallo digital' },
      { id: 'shake', label: 'Motion Shake', icon: Wind, desc: 'Vibración de cámara mano' },
      { id: 'burn', label: 'Film Burn Out', icon: Flame, desc: 'Quemadura de cinta final' },
    ]
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
        {[
          { id: 'atmosphere', icon: Cloud, label: 'Atmos' },
          { id: 'lens', icon: Sun, label: 'Lente' },
          { id: 'vandal', icon: Zap, label: 'FX Master' },
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 custom-scrollbar max-h-[70vh] overflow-y-auto pr-2">
         {OVERLAYS[activeTab].map((fx) => (
           <button
             key={fx.id}
             onClick={() => updateSetting('backgroundAtmosphere', fx.id)}
             className={`group relative w-full overflow-hidden bg-[#0d1117] border rounded-[1.8rem] p-4 flex items-center justify-between transition-all hover:bg-white/[0.02] ${settings.backgroundAtmosphere === fx.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-white/5 hover:border-white/20'}`}
           >
             <div className="flex items-center gap-4 relative z-10">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${settings.backgroundAtmosphere === fx.id ? 'bg-primary text-white' : 'bg-white/5 text-slate-500 group-hover:text-white'}`}>
                   <fx.icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                   <span className="text-[11px] font-black text-white uppercase tracking-tighter">{fx.label}</span>
                   <span className="text-[8px] text-slate-500 font-bold uppercase mt-1">{fx.desc}</span>
                </div>
             </div>
             {settings.backgroundAtmosphere === fx.id && (
                <div className="flex flex-col items-center gap-1">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   <span className="text-[7px] text-primary font-black uppercase">Active</span>
                </div>
             )}
           </button>
         ))}
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-[2rem] space-y-4">
         <div className="flex items-center justify-between px-1">
            <div className="flex flex-col">
               <span className="text-[10px] text-white/60 font-black uppercase">Intensidad Global del Efecto</span>
               <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter italic">Procesado por GPU AI Engine</span>
            </div>
            <span className="text-[10px] text-primary font-mono font-black">{settings.backgroundBlur || 0}%</span>
         </div>
         <input 
            type="range" min="0" max="100" 
            value={settings.backgroundBlur || 0}
            onChange={(e) => updateSetting('backgroundBlur', parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
         />
      </div>
    </div>
  );
}
