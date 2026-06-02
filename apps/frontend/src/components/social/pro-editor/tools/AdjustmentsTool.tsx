import React from 'react';
import { Sun, Thermometer, Box, Aperture, Layers, Maximize2, Sparkles, ShieldCheck, Target, Droplets, RotateCcw } from 'lucide-react';

interface AdjustmentsToolProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  onReset?: () => void;
}

export function AdjustmentsTool({ settings, setSettings, onReset }: AdjustmentsToolProps) {
  const updateSetting = (key: string, value: any) => {
    setSettings((s: any) => ({ ...s, [key]: value }));
  };

  const ColorWheel = ({ label, color, value }: { label: string, color: string, value: number }) => (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative w-20 h-20 rounded-full border border-white/10 p-1 bg-black/40 overflow-hidden shadow-inner group-hover:border-primary/50 transition-all">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-primary/20 to-red-500/20 opacity-40" />
        <div 
          className="absolute inset-[15%] rounded-full border-2 transition-all duration-500 flex items-center justify-center"
          style={{ borderColor: color, transform: `scale(${0.8 + (value / 500)})`, boxShadow: `0 0 15px ${color}44` }}
        >
           <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="w-full h-px bg-white/5 rotate-45" />
           <div className="w-full h-px bg-white/5 -rotate-45" />
        </div>
      </div>
      <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-primary transition-colors">{label}</span>
    </div>
  );

  const AdjustmentSlider = ({ label, value, min, max, icon: Icon, k }: any) => (
    <div className="space-y-2 p-3 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/5 transition-all">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-2">
          <Icon className="w-3 h-3 text-primary/60" /> {label}
        </label>
        <span className="text-[10px] text-primary font-mono font-black">{value}%</span>
      </div>
      <input 
        type="range" min={min} max={max} 
        value={value}
        onChange={(e) => updateSetting(k, parseInt(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary-foreground transition-all" 
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Hollywood Grading Engine
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={onReset}
             className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all mr-2 group"
             title="Resetear Ajustes"
           >
              <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
           </button>
           <span className="text-[7px] text-slate-500 font-black border border-white/10 px-1 rounded uppercase">32-Bit Float</span>
        </div>
      </div>
      
      <div className="space-y-6 custom-scrollbar max-h-[82vh] overflow-y-auto pr-2 pb-10">
        
        {/* Color Wheels Implementation - The Hollywood Signature */}
        <div className="p-4 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-inner">
           <div className="flex items-center gap-2 mb-6">
              <Droplets className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-white/60 font-black uppercase">Primaries (Lift, Gamma, Gain)</span>
           </div>
           <div className="flex justify-between items-center px-2">
              <ColorWheel label="Lift (Sombras)" color="#3b82f6" value={settings.shadows} />
              <ColorWheel label="Gamma (Medios)" color="#a855f7" value={settings.contrast} />
              <ColorWheel label="Gain (Luces)" color="#ef4444" value={settings.highlights} />
           </div>
           <p className="mt-4 text-[7.5px] text-slate-500 font-bold uppercase text-center italic opacity-60">
             Utiliza las ruedas para balancear la temperatura cromática de la escena.
           </p>
        </div>

        <div className="space-y-2">
           <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-2 px-2">Controles Básicos</div>
           <AdjustmentSlider label="Exposición Global" value={settings.brightness} min={0} max={200} icon={Sun} k="brightness" />
           <AdjustmentSlider label="Saturación de Color" value={settings.saturation} min={0} max={200} icon={Box} k="saturation" />
        </div>

        <div className="space-y-2">
           <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-2 px-2">Balance de Blancos Senior</div>
           <div className="grid grid-cols-2 gap-2 px-1">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                 <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-blue-400">Temp</span> <span className="text-orange-400">Warm</span></div>
                 <input type="range" min="50" max="150" value={settings.temperature || 100} onChange={(e) => updateSetting('temperature', parseInt(e.target.value))} className="w-full h-1 accent-orange-500 rounded-full" />
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                 <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-emerald-400">Tint</span> <span className="text-pink-400">Magenta</span></div>
                 <input type="range" min="50" max="150" value={settings.tint || 100} onChange={(e) => updateSetting('tint', parseInt(e.target.value))} className="w-full h-1 accent-pink-500 rounded-full" />
              </div>
           </div>
        </div>

        <div className="pt-4 border-t border-white/5">
           <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-primary/80 font-black uppercase tracking-widest flex items-center gap-2">
                 <Sparkles className="w-3.5 h-3.5" /> Social Beauty Engine (V2)
              </div>
              <div className="h-4 w-10 bg-emerald-500/20 rounded-full flex items-center px-1 border border-emerald-500/40">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
           </div>
           <AdjustmentSlider label="Dreamy Glow" value={settings.dreamyGlow || 0} min={0} max={100} icon={Box} k="dreamyGlow" />
           <AdjustmentSlider label="Skin Smoothing" value={settings.beautyLevel || 0} min={0} max={100} icon={Aperture} k="beautyLevel" />
        </div>

        {/* Master AI Pass */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] flex flex-col items-center gap-3 text-center">
           <ShieldCheck className="w-8 h-8 text-emerald-400" />
           <div className="space-y-1">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Neural Mastering Pass</h4>
              <p className="text-[8px] text-slate-500 font-bold tracking-tight uppercase px-4 leading-normal">
                Aplica un pase final de inteligencia artificial para nivelar el rango dinámico HDR automáticamente.
              </p>
           </div>
           <button className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-[9px] font-black uppercase tracking-widest rounded-full transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
              Activar IA Master
           </button>
        </div>
      </div>
    </div>
  );
}
