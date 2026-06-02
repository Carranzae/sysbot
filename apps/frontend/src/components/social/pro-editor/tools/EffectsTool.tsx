import React, { useState } from 'react';
import { Sparkles, Zap, Flame, Camera, Wand2, Star, Target, MonitorPlay, Focus } from 'lucide-react';

interface EffectsToolProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const EFFECTS_CATEGORIES = [
  {
    title: 'Tendencias TikTok 🔥',
    effects: [
      { id: 'vhs-glitch', name: 'VHS Glitch', icon: Zap, bg: 'bg-gradient-to-br from-purple-600 to-indigo-600' },
      { id: 'halo-blur', name: 'Halo Blur', icon: Target, bg: 'bg-gradient-to-tr from-pink-500 to-rose-400' },
      { id: 'color-pop', name: 'Color Pop', icon: Star, bg: 'bg-gradient-to-r from-cyan-400 to-blue-500' },
      { id: 'slow-zoom', name: 'Auto Zoom', icon: Camera, bg: 'bg-gradient-to-bl from-amber-400 to-orange-500' },
    ]
  },
  {
    title: 'Magia IA 🤖',
    effects: [
      { id: 'cartoonify', name: 'Caricatura 3D', icon: Wand2, bg: 'bg-violet-500' },
      { id: 'anime-style', name: 'Anime Lens', icon: Sparkles, bg: 'bg-fuchsia-500' },
      { id: 'bg-remove', name: 'Auto Recorte', icon: Focus, bg: 'bg-emerald-500' },
    ]
  },
  {
    title: 'Estilo Hollywood 🎬',
    effects: [
      { id: 'cinematic-bars', name: 'Cine Bars', icon: MonitorPlay, bg: 'bg-slate-800' },
      { id: 'film-burn', name: 'Film Burn', icon: Flame, bg: 'bg-red-600' },
    ]
  }
];

export function EffectsTool({ settings, setSettings }: EffectsToolProps) {
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  const toggleEffect = (effectId: string) => {
    setActiveEffect(prev => {
      const next = prev === effectId ? null : effectId;
      setSettings((s: any) => ({ ...s, activeVisualEffect: next }));
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-[11px] text-white font-black uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Efectos Virales
        </div>
      </div>

      <div className="space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar pr-2 pb-10">
        {EFFECTS_CATEGORIES.map(category => (
          <div key={category.title} className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {category.title}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {category.effects.map(effect => (
                <button
                  key={effect.id}
                  onClick={() => toggleEffect(effect.id)}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden transition-all duration-300 ${activeEffect === effect.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1117] scale-[0.98]' : 'hover:scale-[1.02] opacity-80 hover:opacity-100'}`}
                >
                  <div className={`absolute inset-0 opacity-40 ${effect.bg}`} />
                  {activeEffect === effect.id && (
                    <div className={`absolute inset-0 ${effect.bg} animate-pulse opacity-80`} />
                  )}
                  
                  <effect.icon className={`w-6 h-6 mb-2 relative z-10 ${activeEffect === effect.id ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'text-slate-200'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-wide relative z-10 text-center ${activeEffect === effect.id ? 'text-white' : 'text-slate-200'}`}>
                    {effect.name}
                  </span>
                  
                  {activeEffect === effect.id && (
                    <div className="absolute top-1 right-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
