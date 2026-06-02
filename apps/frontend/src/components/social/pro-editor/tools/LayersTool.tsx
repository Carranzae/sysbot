import React from 'react';
import { Layers, Eye, EyeOff, Lock, Unlock, Trash2, Edit3, Type, Image as ImageIcon, Sparkles, GripVertical } from 'lucide-react';

interface LayersToolProps {
  elements: any[];
  setElements: React.Dispatch<React.SetStateAction<any[]>>;
  selectedElement: string | null;
  setSelectedElement: (id: string | null) => void;
}

export function LayersTool({ elements, setElements, selectedElement, setSelectedElement }: LayersToolProps) {
  const toggleVisibility = (id: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, hidden: !el.hidden } : el
    ));
  };

  const toggleLock = (id: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, locked: !el.locked } : el
    ));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const index = elements.findIndex(el => el.id === id);
    if (index === -1) return;
    
    const newElements = [...elements];
    if (direction === 'up' && index < elements.length - 1) {
      [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
    } else if (direction === 'down' && index > 0) {
      [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
    }
    setElements(newElements);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'text': return Type;
      case 'sticker': return Sparkles;
      case 'image': return ImageIcon;
      case 'video': return ImageIcon;
      case 'blur': return Layers;
      default: return Layers;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Panel de Capas Unificado
        </div>
        <span className="text-[10px] text-slate-500 font-bold">{elements.length} Elementos</span>
      </div>

      <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
        {elements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <Layers className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-[10px] text-slate-500 font-bold uppercase">No hay capas en esta composición</p>
          </div>
        ) : (
          [...elements].reverse().map((el, idx) => {
            const Icon = getIcon(el.type);
            const isSelected = selectedElement === el.id;
            
            return (
              <div 
                key={el.id}
                onClick={() => setSelectedElement(el.id)}
                className={`group relative p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-primary/10 border-primary ring-1 ring-primary/20' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 opacity-60'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-black tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {el.content || el.type.toUpperCase()}
                      </span>
                      {el.locked && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">{el.type}</span>
                      <span className="text-[8px] text-slate-700 font-mono">• Layer {elements.length - (elements.indexOf(el))}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleVisibility(el.id); }}
                      className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${el.hidden ? 'text-red-400' : 'text-slate-400'}`}
                    >
                      {el.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLock(el.id); }}
                      className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${el.locked ? 'text-amber-500' : 'text-slate-400'}`}
                    >
                      {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                      className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Layer Ordering Buttons */}
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all scale-75">
                  <button 
                    onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'up'); }}
                    className="p-1 bg-slate-800 border border-white/10 rounded-md hover:bg-primary transition-colors text-white"
                  >
                    <GripVertical className="w-3 h-3 rotate-180" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'down'); }}
                    className="p-1 bg-slate-800 border border-white/10 rounded-md hover:bg-primary transition-colors text-white"
                  >
                    <GripVertical className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
        <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase text-center italic">
          Tip: El orden de las capas determina qué elementos aparecen encima de otros en la previsualización.
        </p>
      </div>
    </div>
  );
}
