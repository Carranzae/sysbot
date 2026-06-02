import React from 'react';
import { Shapes, Maximize2, Settings2, Trash2, Eraser, Sparkles, Layout } from 'lucide-react';

interface ElementsToolProps {
  onAddElement?: (options?: any) => void;
  activeElement?: any;
  onUpdateElement?: (id: string, updates: any) => void;
}

export function ElementsTool({ onAddElement, activeElement, onUpdateElement }: ElementsToolProps) {
  
  if (activeElement && onUpdateElement) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-primary" /> Editar {activeElement.type === 'blur' ? 'Parche' : 'Elemento'}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-black/40 rounded-xl border border-white/5 shadow-inner">
          {activeElement.type === 'blur' ? (
            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 flex items-center justify-center">
               <Eraser className="w-8 h-8 text-primary" />
            </div>
          ) : (
            <span className="text-6xl drop-shadow-2xl">{activeElement.content}</span>
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Escala (Tamaño)</label>
              <span className="text-xs font-mono text-primary">{activeElement.fontSize}px</span>
            </div>
            <input 
              type="range" min="10" max="800" 
              value={activeElement.fontSize || 48}
              onChange={(e) => onUpdateElement(activeElement.id, { fontSize: parseInt(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
            />
          </div>
        </div>
      </div>
    );
  }

  const handleAdd = (content: string, type: string = 'sticker') => {
    if (onAddElement) {
      onAddElement({ content, fontSize: 80, type });
    }
  };

  const handleAddBlur = () => {
    if (onAddElement) {
      onAddElement({ type: 'blur', fontSize: 150, content: '' });
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest">Post-Pro Toolkit</div>
        <Shapes className="w-3.5 h-3.5 text-primary" />
      </div>

      <div className="space-y-6">
        {/* Parche Pro (Eraser) */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl group hover:bg-primary/10 transition-all cursor-pointer" onClick={handleAddBlur}>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                 <Eraser className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[11px] font-black text-white uppercase tracking-tighter">Parche Pro (AI Eraser)</span>
                 <span className="text-[9px] text-primary font-bold">Ocultar objetos no deseados</span>
              </div>
           </div>
           <p className="text-[8px] text-slate-500 font-medium leading-relaxed italic">
             Coloca este parche sobre logos, rostros o cables para ocultarlos con desenfoque cinematográfico.
           </p>
        </div>

        {/* Sombras Cinemáticas */}
        <div>
           <div className="flex items-center gap-2 mb-3">
              <Layout className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Overlays de Cine</span>
           </div>
           <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Viñeta Top', content: '▲', type: 'overlay' },
                { label: 'Viñeta Bot', content: '▼', type: 'overlay' },
                { label: 'Grain Film', content: '░', type: 'overlay' },
                { label: 'Dust Effect', content: '·', type: 'overlay' }
              ].map(ov => (
                <button 
                  key={ov.label}
                  onClick={() => handleAdd(ov.content, ov.type)}
                  className="px-3 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-white transition-all text-center"
                >
                  {ov.label}
                </button>
              ))}
           </div>
        </div>

        {/* Reacciones Populares */}
        <div>
          <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-2">VFX Pop / Stickers</div>
          <div className="grid grid-cols-4 gap-2">
            {['🔥', '😂', '💀', '❤️', '🤯', '✨', '👀', '💯', '👾', '🚀', '🔮', '⚡'].map((emoji) => (
              <button 
                key={emoji}
                onClick={() => handleAdd(emoji)}
                className="aspect-square bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/50 transition-all rounded-xl text-2xl flex items-center justify-center hover:scale-110 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
