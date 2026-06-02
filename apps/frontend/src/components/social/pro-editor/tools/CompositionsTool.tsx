import React, { useRef, useState } from 'react';
import { Film, Image as ImageIcon, Sparkles, Scissors, Trash2, Settings2, Maximize2 } from 'lucide-react';

interface CompositionsToolProps {
  onAddOverlay?: (file: File) => void;
  activeElement?: any;
  onUpdateElement?: (id: string, updates: any) => void;
}

export function CompositionsTool({ onAddOverlay, activeElement, onUpdateElement }: CompositionsToolProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddOverlay) {
      onAddOverlay(file);
    }
  };

  const handleRemoveBg = () => {
    if (!activeElement || !onUpdateElement) return;
    setIsProcessing(true);
    // Simulate AI Background Removal
    setTimeout(() => {
      onUpdateElement(activeElement.id, { isBackgroundRemoved: !activeElement.isBackgroundRemoved });
      setIsProcessing(false);
    }, 1200);
  };

  if (activeElement && onUpdateElement) {
    const isBgRemoved = activeElement.isBackgroundRemoved;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-primary" /> Capa {activeElement.type === 'video' ? 'de Video' : 'de Imagen'}
          </div>
        </div>

        {/* Smart Cutout Tool */}
        <div className="space-y-3">
          <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Inteligencia Artificial</div>
          <button 
            onClick={handleRemoveBg}
            disabled={isProcessing}
            className={`w-full relative overflow-hidden group px-4 py-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 border ${isBgRemoved ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/30 hover:border-indigo-500'}`}
          >
            {isBgRemoved && <div className="absolute inset-0 bg-emerald-500/5 transition-colors" />}
            
            <div className={`p-2 rounded-full ${isBgRemoved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/20 text-primary'}`}>
              <Scissors className={`w-4 h-4 ${isProcessing ? 'animate-ping' : ''}`} />
            </div>
            <span className={`text-xs font-black ${isBgRemoved ? 'text-emerald-200' : 'text-indigo-200'}`}>
              {isProcessing ? 'RECORTANDO MÁGICAMENTE...' : (isBgRemoved ? 'FONDO REMOVIDO' : 'QUITAR FONDO (RECORTE IA)')}
            </span>
          </button>
          {!isBgRemoved && <p className="text-[10px] text-center text-slate-500 uppercase font-semibold">Identifica sujetos y borra el fondo</p>}
        </div>

        {/* Resizing Canvas */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Escala (Ancho)</label>
              <span className="text-xs font-mono text-primary">{activeElement.fontSize}px</span>
            </div>
            <input 
              type="range" min="50" max="800" 
              value={activeElement.fontSize || 200}
              onChange={(e) => onUpdateElement(activeElement.id, { fontSize: parseInt(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest">Picture in Picture</div>
        <Film className="w-3.5 h-3.5 text-primary" />
      </div>

      <div className="space-y-3">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        
        {/* Main Actions */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full relative overflow-hidden group px-4 py-8 bg-gradient-to-br from-white/5 to-white/5 border border-dashed border-white/20 rounded-xl hover:border-primary/50 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
          <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
          <span className="text-sm font-black text-white">Importar Superposición</span>
          <span className="text-[10px] text-slate-500">Agrega fotos o videos sobre tu clip principal</span>
        </button>
      </div>
    </div>
  );
}
