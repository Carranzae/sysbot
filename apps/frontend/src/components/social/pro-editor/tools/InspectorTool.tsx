import React from 'react';
import { Target, Maximize, Scissors, Layers, Sliders, Type, Droplets, Sun, Ghost, Wand2, Hash, Move } from 'lucide-react';

interface InspectorToolProps {
  element: any;
  onUpdate: (id: string, updates: any) => void;
}

export function InspectorTool({ element, onUpdate }: InspectorToolProps) {
  if (!element) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4 opacity-40">
         <Target className="w-10 h-10 text-slate-500" />
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inspector Vacío</span>
      </div>
    );
  }

  const update = (key: string, val: any) => onUpdate(element.id, { [key]: val });

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-[10px] text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" /> Propiedades Quirúrgicas
        </div>
        <span className="text-[8px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{element.id.substring(0, 8)}</span>
      </div>

      <div className="space-y-4">
        {/* Transform Group */}
        <div className="p-4 bg-white/2 border border-white/5 rounded-[1.8rem] space-y-4">
           <div className="flex items-center gap-2 mb-2">
              <Maximize className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-black uppercase text-white/40">Transformar</span>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[8px] text-slate-500 font-bold uppercase ml-1">Posición X (%)</label>
                 <input 
                   type="number" value={Math.round(element.x)} 
                   onChange={(e) => update('x', parseInt(e.target.value))}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-mono"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[8px] text-slate-500 font-bold uppercase ml-1">Posición Y (%)</label>
                 <input 
                   type="number" value={Math.round(element.y)} 
                   onChange={(e) => update('y', parseInt(e.target.value))}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-mono"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[8px] text-slate-500 font-bold uppercase ml-1">Escala</label>
                 <input 
                   type="number" step="0.1" value={element.scale || 1} 
                   onChange={(e) => update('scale', parseFloat(e.target.value))}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-mono"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[8px] text-slate-500 font-bold uppercase ml-1">Rotación (°)</label>
                 <input 
                   type="number" value={element.rotation || 0} 
                   onChange={(e) => update('rotation', parseInt(e.target.value))}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-mono"
                 />
              </div>
           </div>
        </div>

        {/* Visual FX Group */}
        <div className="p-4 bg-white/2 border border-white/5 rounded-[1.8rem] space-y-5">
           <div className="flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[9px] font-black uppercase text-white/40">Efectos Visuales</span>
           </div>

           <div className="space-y-3">
              <div className="flex justify-between px-1">
                 <span className="text-[8px] text-slate-500 font-bold uppercase">Opacidad</span>
                 <span className="text-[8px] text-primary font-mono">{element.opacity || 100}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={element.opacity || 100} 
                onChange={(e) => update('opacity', parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
           </div>

           <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                 <label className="text-[8px] text-slate-500 font-bold uppercase ml-1 flex items-center gap-2">
                    <Sun className="w-3 h-3 text-amber-500" /> Drop Shadow Color
                 </label>
                 <div className="flex gap-2">
                    <input 
                       type="color" value={element.dropShadow || '#000000'} 
                       onChange={(e) => update('dropShadow', e.target.value)}
                       className="w-10 h-8 bg-black/40 border border-white/10 rounded-lg p-1"
                    />
                    <input 
                       type="text" value={element.dropShadow || ''} 
                       onChange={(e) => update('dropShadow', e.target.value)}
                       placeholder="#000000"
                       className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 text-[10px] text-white font-mono uppercase"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[8px] text-slate-500 font-bold uppercase ml-1 flex items-center gap-2">
                    <Ghost className="w-3 h-3 text-emerald-400" /> Outer Glow Color
                 </label>
                 <div className="flex gap-2">
                    <input 
                       type="color" value={element.outerGlow || '#00ff00'} 
                       onChange={(e) => update('outerGlow', e.target.value)}
                       className="w-10 h-8 bg-black/40 border border-white/10 rounded-lg p-1"
                    />
                    <input 
                       type="text" value={element.outerGlow || ''} 
                       onChange={(e) => update('outerGlow', e.target.value)}
                       placeholder="#00ff00"
                       className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 text-[10px] text-white font-mono uppercase"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Blending & Layering */}
        <div className="p-4 bg-white/2 border border-white/5 rounded-[1.8rem] space-y-4">
           <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
              <span className="text-[9px] font-black uppercase text-white/40">Composición Pro</span>
           </div>
           <select 
              value={element.blendMode || 'normal'}
              onChange={(e) => update('blendMode', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-white font-black uppercase outline-none focus:border-primary"
           >
              <option value="normal">Normal</option>
              <option value="multiply">Multiplicar</option>
              <option value="screen">Trama (Screen)</option>
              <option value="overlay">Superponer</option>
              <option value="difference">Diferencia</option>
           </select>
        </div>

        <div className="pt-6">
           <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[9px] font-black uppercase text-white tracking-widest transition-all flex items-center justify-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-primary" /> Auto-Enhance Element
           </button>
        </div>
      </div>
    </div>
  );
}
