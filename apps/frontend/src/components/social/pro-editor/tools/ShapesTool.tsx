import React, { useState } from 'react';
import { Square, Circle, Triangle, Pentagon, Star, Hexagon, Wand2, Palette, Layers, Box, Maximize } from 'lucide-react';

interface ShapesToolProps {
  onAddShape: (type: string, color: string) => void;
}

export function ShapesTool({ onAddShape }: ShapesToolProps) {
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  
  const SHAPES = [
    { id: 'rect', icon: Square, label: 'Rectángulo' },
    { id: 'circle', icon: Circle, label: 'Círculo' },
    { id: 'poly', icon: Triangle, label: 'Triángulo' },
    { id: 'star', icon: Star, label: 'Estrella Elite' },
    { id: 'hexa', icon: Hexagon, label: 'Hexágono Pro' },
  ];

  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" /> Vector Graphics Engine
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {SHAPES.map((shape) => (
            <button
              key={shape.id}
              onClick={() => onAddShape(shape.id, selectedColor)}
              className="group flex flex-col items-center gap-3 p-5 bg-white/2 border border-white/5 rounded-[2rem] hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center text-slate-500 group-hover:text-primary transition-all">
                <shape.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-white">
                {shape.label}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3 p-4 bg-white/5 rounded-[2rem] border border-white/5">
          <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-2 px-1 text-left">Paleta de Colores Industrial</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-[2rem] flex items-center gap-4">
           <Wand2 className="w-6 h-6 text-primary" />
           <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-white uppercase tracking-tighter">AI Shape Assist</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">Alineación Magnética Activa</span>
           </div>
        </div>
      </div>
    </div>
  );
}
