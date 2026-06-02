import React, { useState } from 'react';
import { Palette, Layers, Film, Wand2, Sun, Sparkles, SlidersHorizontal, ImageDown } from 'lucide-react';

interface FiltersToolProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export function FiltersTool({ settings, setSettings }: FiltersToolProps) {
  const [activeTab, setActiveTab] = React.useState<'tiktok' | 'cine'>('tiktok');
  const [intensity, setIntensity] = useState(80);

  const updateSetting = (key: string, value: any) => {
    setSettings((s: any) => ({ ...s, [key]: value }));
  };

  const TIKTOK_FILTERS = [
    { id: 'vivid', label: 'Vivid Pop', bg: 'bg-gradient-to-tr from-pink-400 to-orange-400' },
    { id: 'soft', label: 'Soft Clear', bg: 'bg-gradient-to-tr from-cyan-200 to-blue-200' },
    { id: 'summertime', label: 'Verano', bg: 'bg-gradient-to-tr from-yellow-300 to-orange-400' },
    { id: 'vintage', label: 'Y2K Vintage', bg: 'bg-gradient-to-tr from-rose-900 to-amber-700' },
    { id: 'cyber', label: 'Cyberpunk', bg: 'bg-gradient-to-tr from-fuchsia-600 to-blue-800' },
    { id: 'anime', label: 'Anime Filter', bg: 'bg-gradient-to-tr from-violet-400 to-fuchsia-300' },
    { id: 'bw-dramatic', label: 'B&W Drama', bg: 'bg-gradient-to-tr from-slate-900 to-slate-400' },
    { id: 'glower', label: 'Glow Face', bg: 'bg-gradient-to-tr from-amber-100 to-rose-200' }
  ];

  const CINE_LUTS = [
    { id: 'teal-orange', label: 'Teal & Orange', desc: 'Estándar de Hollywood (Blockbuster)', preview: 'bg-gradient-to-tr from-cyan-900 to-orange-600' },
    { id: 'kodak-2383', label: 'Kodak 2383', desc: 'Emulación de película impresa 35mm', preview: 'bg-gradient-to-tr from-stone-800 to-amber-900' },
    { id: 'fuji-eterna', label: 'Fuji Eterna', desc: 'Tonos desaturados y sombras ricas', preview: 'bg-gradient-to-tr from-emerald-900 to-teal-800' },
    { id: 'matrix', label: 'Sci-Fi Green', desc: 'Look Matrix verde profundo', preview: 'bg-gradient-to-tr from-green-950 to-emerald-800' }
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      {/* Intesity slider */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
         <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><SlidersHorizontal className="w-3 h-3 text-primary" /> Intensidad del Filtro</span>
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">{intensity}%</span>
         </div>
         <input 
            type="range" min="0" max="100" 
            value={intensity} 
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full h-1.5 accent-primary bg-white/10 rounded-full appearance-none cursor-pointer" 
         />
      </div>

      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
        <button 
          onClick={() => setActiveTab('tiktok')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'tiktok' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Populares
        </button>
        <button 
          onClick={() => setActiveTab('cine')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'cine' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        >
          <Film className="w-3.5 h-3.5" /> Cine / LUTs
        </button>
      </div>

      <div className="space-y-4 custom-scrollbar max-h-[60vh] overflow-y-auto pr-2 pb-10">
        {activeTab === 'tiktok' ? (
          <div className="grid grid-cols-2 gap-2">
             <button
               onClick={() => updateSetting('filter', 'none')}
               className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center gap-2 ${settings.filter === 'none' || !settings.filter ? 'border-white bg-white/10' : 'border-white/5 bg-black/40 hover:border-white/20'}`}
             >
                <ImageDown className="w-6 h-6 text-slate-400" />
                <span className="text-[10px] font-black text-white uppercase">Original</span>
             </button>

             {TIKTOK_FILTERS.map((filter) => (
               <button
                 key={filter.id}
                 onClick={() => updateSetting('filter', filter.id)}
                 className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all group ${settings.filter === filter.id ? 'border-primary ring-2 ring-primary/20 scale-[0.98]' : 'border-transparent hover:scale-[1.02]'}`}
               >
                  <div className={`absolute inset-0 opacity-80 ${filter.bg} group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="absolute bottom-3 left-0 w-full text-center z-10 px-2">
                     <span className="text-[10px] font-black text-white uppercase tracking-wider drop-shadow-md">{filter.label}</span>
                  </div>

                  {settings.filter === filter.id && (
                     <div className="absolute top-2 right-2 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
                        <Wand2 className="w-2.5 h-2.5" />
                     </div>
                  )}
               </button>
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
             {CINE_LUTS.map((lut) => (
               <button
                 key={lut.id}
                 className="group w-full relative h-28 overflow-hidden rounded-xl border border-white/5 hover:border-white/30 transition-all flex items-center px-6"
               >
                  <div className={`absolute inset-0 opacity-70 transition-opacity group-hover:opacity-100 ${lut.preview}`} />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117] via-black/60 to-transparent" />
                  
                  <div className="relative z-10 flex flex-col text-left">
                     <span className="text-[12px] font-black text-white uppercase tracking-wider">{lut.label}</span>
                     <span className="text-[9px] text-slate-300 font-medium italic mt-1.5 opacity-80">{lut.desc}</span>
                  </div>
                  
                  <div className="ml-auto relative z-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                     <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[9px] font-black uppercase rounded text-center">
                        Aplicar LUT
                     </div>
                  </div>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
