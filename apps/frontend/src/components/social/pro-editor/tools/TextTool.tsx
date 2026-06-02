import React from 'react';
import { Type, Sparkles, Highlighter, AlignCenter, Settings2, Maximize2, Palette, ChevronRight, Brush } from 'lucide-react';

interface TextToolProps {
  onAddText: (options?: any) => void;
  activeElement: any | null;
  onUpdateElement: (id: string, updates: any) => void;
}

const ELEGANT_FONTS = [
  { name: 'Inter', family: 'Inter', type: 'System' },
  { name: 'Montserrat', family: 'Montserrat', type: 'Modern' },
  { name: 'Poppins', family: 'Poppins', type: 'Geometric' },
  { name: 'Outfit', family: 'Outfit', type: 'Luxury' },
  { name: 'Playfair', family: '"Playfair Display"', type: 'Serif' },
  { name: 'Lora', family: 'Lora', type: 'Classic Serif' },
  { name: 'Bebas Neue', family: '"Bebas Neue"', type: 'Impact' },
  { name: 'Anton', family: 'Anton', type: 'Bold' },
  { name: 'Oswald', family: 'Oswald', type: 'Display' },
  { name: 'Cinzel', family: 'Cinzel', type: 'Classical' },
  { name: 'Cormorant', family: '"Cormorant Garamond"', type: 'Elegant' },
  { name: 'Pacifico', family: 'Pacifico', type: 'Retro' },
  { name: 'Dancing Script', family: '"Dancing Script"', type: 'Handwritten' },
  { name: 'Great Vibes', family: '"Great Vibes"', type: 'Luxury Script' },
];

export function TextTool({ onAddText, activeElement, onUpdateElement }: TextToolProps) {
  
  if (activeElement) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-primary" /> Editar Texto
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Contenido</label>
          <textarea 
            value={activeElement.content}
            onChange={(e) => onUpdateElement(activeElement.id, { content: e.target.value })}
            className="w-full h-20 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white resize-none outline-none focus:border-primary transition-colors font-medium"
            placeholder="Escribe tu texto..."
          />
        </div>

        {/* Typography */}
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-3">
               <Brush className="w-3 h-3 text-primary" /> Fuente Elegante
            </label>
            <div className="grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
              {ELEGANT_FONTS.map(font => (
                <button
                  key={font.family}
                  onClick={() => onUpdateElement(activeElement.id, { fontFamily: font.family })}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all border ${
                    activeElement.fontFamily === font.family 
                      ? 'bg-primary/20 border-primary text-white' 
                      : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span style={{ fontFamily: font.family }} className="text-sm">{font.name}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">{font.type}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Tamaño</label>
              <span className="text-xs font-mono text-primary">{activeElement.fontSize}px</span>
            </div>
            <input 
              type="range" min="10" max="250" 
              value={activeElement.fontSize || 32}
              onChange={(e) => onUpdateElement(activeElement.id, { fontSize: parseInt(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-2"><Palette className="w-3 h-3" /> Color Mágico</label>
            <div className="flex flex-wrap gap-2">
              {[
                '#ffffff', '#000000', '#ffcc00', '#ffd700', 
                '#ff2d55', '#ff4500', '#00ffcc', '#00ff00',
                '#5856d6', '#007aff', '#ff9500', '#af52de',
                '#ff3b30', '#c0c0c0', '#e5e5ea', '#fbda61'
              ].map(color => (
                <button
                  key={color}
                  onClick={() => onUpdateElement(activeElement.id, { color })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-125 ${activeElement.color === color ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-white/20'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Animations */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">
            <Sparkles className="w-3 h-3 text-primary" /> Animación Master
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'none', label: 'Ninguna' },
              { id: 'blur-in', label: 'Efecto Desenfoque' },
              { id: 'slide-reveal', label: 'Revelado Pro' },
              { id: 'bounce-in', label: 'Rebote Suave' },
              { id: 'glitch', label: 'Estilo Glitch' },
              { id: 'floating', label: 'Flotado Suave' },
              { id: 'neon-pulse', label: 'Pulso Neón' }
            ].map(anim => (
              <button
                key={anim.id}
                onClick={() => onUpdateElement(activeElement.id, { animation: anim.id })}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                  activeElement.animation === anim.id 
                    ? 'bg-primary/20 border-primary text-white' 
                    : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:text-white'
                }`}
              >
                {anim.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl mt-6">
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
            Tip: Las animaciones se activan automáticamente al iniciar el clip.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40 font-black uppercase tracking-widest">Tipografía Premium</div>
        <Type className="w-3.5 h-3.5 text-primary" />
      </div>

      <div className="space-y-4">
        {/* Main Actions */}
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => onAddText({ content: 'TITULAR MODERNO', fontSize: 72, fontFamily: 'Montserrat', color: '#ffffff' })}
            className="w-full group px-4 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/40 transition-all text-left flex items-center justify-between"
          >
             <div className="flex flex-col">
               <span className="text-xs font-black text-white uppercase tracking-tighter">Impacto Moderno</span>
               <span className="text-[9px] text-slate-500">Montserrat Bold</span>
             </div>
             <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
          </button>

          <button 
            onClick={() => onAddText({ content: 'Elegancia y Clase', fontSize: 60, fontFamily: '"Playfair Display"', color: '#ffd700' })}
            className="w-full group px-4 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/40 transition-all text-left flex items-center justify-between"
          >
             <div className="flex flex-col">
               <span className="text-xs font-serif italic text-yellow-500/90 font-bold">Lujo Cinematográfico</span>
               <span className="text-[9px] text-slate-500">Playfair Display</span>
             </div>
             <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
          </button>
          
          <button 
            onClick={() => onAddText({ content: 'SUBTÍTULO DINÁMICO', fontSize: 24, fontFamily: 'Oswald', color: '#ffffff' })}
            className="w-full group px-4 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/40 transition-all text-left flex items-center justify-between"
          >
             <div className="flex flex-col">
               <span className="text-xs font-bold text-slate-300 tracking-widest uppercase">Subtítulo Base</span>
               <span className="text-[9px] text-slate-500">Oswald Light</span>
             </div>
             <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
          </button>

          {/* Social Viral Styles */}
          <button 
            onClick={() => onAddText({ content: 'VIRAL HOOK', fontSize: 80, fontFamily: '"Bebas Neue"', color: '#fbda61', animation: 'bounce-in', blendMode: 'screen' })}
            className="w-full group px-4 py-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl hover:from-yellow-500/20 hover:to-orange-500/20 transition-all text-left flex items-center justify-between"
          >
             <div className="flex flex-col">
               <span className="text-xs font-black text-yellow-500 uppercase italic">TikTok Viral Hook</span>
               <span className="text-[9px] text-slate-400">Bebas Neue + Bounce Animation</span>
             </div>
             <Sparkles className="w-4 h-4 text-yellow-500 group-hover:scale-125 transition-transform" />
          </button>

          <button 
            onClick={() => onAddText({ content: 'Cinematic Chapter', fontSize: 50, fontFamily: '"Cormorant Garamond"', color: '#ffffff', animation: 'blur-in' })}
            className="w-full group px-4 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/40 transition-all text-left flex items-center justify-between"
          >
             <div className="flex flex-col">
               <span className="text-xs font-serif italic text-white/80">Minimalist Chapter</span>
               <span className="text-[9px] text-slate-500">Cormorant Garamond + Blur Reveal</span>
             </div>
             <Palette className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        <div className="pt-4 border-t border-white/5">
           <div className="flex items-center gap-2 mb-4">
             <Highlighter className="w-3 h-3 text-primary" />
             <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">Estilos Rápidos</span>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
             <button 
               onClick={() => onAddText({ content: 'RETRO', fontSize: 50, fontFamily: 'Pacifico', color: '#ff2d55' })}
               className="h-16 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center hover:bg-pink-500/20 transition-all"
             >
               <span style={{ fontFamily: 'Pacifico' }} className="text-pink-500 text-sm">Retro</span>
             </button>
             <button 
               onClick={() => onAddText({ content: 'ANTIQUE', fontSize: 50, fontFamily: '"Cormorant Garamond"', color: '#c0c0c0' })}
               className="h-16 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center hover:bg-slate-500/20 transition-all"
             >
               <span style={{ fontFamily: '"Cormorant Garamond"' }} className="text-slate-400 text-sm italic font-bold">Antique</span>
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
