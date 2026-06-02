import React, { useState } from 'react';
import { Music, Mic, Sliders, Play, Plus, Sparkles, Wind, Headphones, Ghost, Zap, Flame, Sun, Search } from 'lucide-react';

interface AudioToolProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  onAddAudio?: (url: string, name: string) => void;
}

export function AudioTool({ settings, setSettings, onAddAudio }: AudioToolProps) {
  const [activeTab, setActiveTab] = useState<'stock' | 'sfx' | 'enhance'>('stock');
  const [search, setSearch] = useState('');

  const STOCK_MUSIC = [
    { id: 'cine-1', name: 'Interstellar Echoes', genre: 'Cinematic', dur: '3:45', color: 'text-sky-400', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 'cine-2', name: 'Dark Knight Rises', genre: 'Epic / Action', dur: '4:12', color: 'text-red-500', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { id: 'vlog-1', name: 'Summer Sunset', genre: 'Vlog / Happy', dur: '2:30', color: 'text-amber-400', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { id: 'lofi-1', name: 'Midnight Study', genre: 'Lo-Fi / Chill', dur: '5:00', color: 'text-indigo-400', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { id: 'horror-1', name: 'Forgotten Attic', genre: 'Horror', dur: '1:50', icon: Ghost, color: 'text-slate-600', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  ];

  const SFX_LIBRARY = [
    { id: 'sfx-1', name: 'Cinematic Whoosh', cat: 'Transitions', icon: Wind, dur: '0:02', color: 'text-indigo-400' },
    { id: 'sfx-2', name: 'Glitch Distortion', cat: 'Effects', icon: Zap, dur: '0:03', color: 'text-emerald-400' },
    { id: 'sfx-3', name: 'Epic Impact', cat: 'Hits', icon: Flame, dur: '0:05', color: 'text-orange-500' },
    { id: 'sfx-4', name: 'Magic Sparkles', cat: 'Ambient', icon: Sparkles, dur: '0:08', color: 'text-amber-300' },
    { id: 'sfx-5', name: 'Lens Flare Pop', cat: 'Optical', icon: Sun, dur: '0:01', color: 'text-white' },
  ];

  const updateEnhancement = (key: string, value: number) => {
    setSettings((s: any) => ({
      ...s,
      audioEnhancements: { ...s.audioEnhancements, [key]: value }
    }));
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
        {[
          { id: 'stock', icon: Music, label: 'BGM Cine' },
          { id: 'sfx', icon: Zap, label: 'Efectos SFX' },
          { id: 'enhance', icon: Sparkles, label: 'Neural Master' },
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' : 'text-slate-500 hover:text-white'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-hover:text-primary transition-colors" />
        <input 
          type="text" 
          placeholder="Buscar assets de audio élite..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-[10px] text-white outline-none focus:border-primary/40 transition-all placeholder:text-slate-700"
        />
      </div>

      <div className="custom-scrollbar max-h-[60vh] overflow-y-auto pr-2">
        {activeTab === 'stock' && (
          <div className="space-y-3 animate-in fade-in duration-500">
             <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-4">Hollywood Background Music</div>
             {STOCK_MUSIC.map((track) => (
               <div key={track.id} className="group relative bg-[#0d1117] border border-white/5 rounded-3xl p-4 flex items-center justify-between hover:border-primary/40 hover:bg-white/[0.02] transition-all">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-all">
                       <Play className={`w-4 h-4 ${track.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <div className="flex flex-col text-left leading-tight">
                       <span className="text-[11px] font-black text-white uppercase tracking-tight">{track.name}</span>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] text-slate-500 font-bold uppercase">{track.genre}</span>
                          <span className="text-[8px] text-white/20">•</span>
                          <span className="text-[8px] text-primary/60 font-mono tracking-tighter">{track.dur}</span>
                       </div>
                    </div>
                 </div>
                 <button 
                   onClick={() => onAddAudio && onAddAudio(track.url, track.name)}
                   className="w-10 h-10 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-primary/20 scale-90 group-hover:scale-100"
                 >
                    <Plus className="w-5 h-5" />
                 </button>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'sfx' && (
          <div className="grid grid-cols-1 gap-2 animate-in fade-in duration-500">
             <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-2 px-2">Cinematic SFX Library</div>
             {SFX_LIBRARY.map((sfx) => (
               <button 
                 key={sfx.id} 
                 className="flex items-center gap-4 p-3 bg-white/2 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-all group"
               >
                  <div className={`p-2.5 rounded-xl bg-black/40 ${sfx.color} group-hover:scale-110 transition-transform`}>
                     <sfx.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left leading-none">
                     <h4 className="text-[10px] font-black text-white uppercase mb-1 tracking-tight">{sfx.name}</h4>
                     <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">{sfx.cat}</span>
                  </div>
                  <span className="text-[8px] font-mono text-white/20">{sfx.dur}</span>
               </button>
             ))}
          </div>
        )}

        {activeTab === 'enhance' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="p-5 bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 rounded-[2.5rem] flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-black/40 flex items-center justify-center border border-white/5 shadow-2xl relative overflow-hidden">
                   <div className="absolute inset-0 bg-primary/10 animate-pulse" />
                   <Sparkles className="w-8 h-8 text-primary relative z-10" />
                </div>
                <div>
                   <h3 className="text-xs font-black text-white uppercase tracking-widest">Neural Mastering Engine</h3>
                   <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Optimización Automática de Audio V4</p>
                </div>
                <button className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20">
                   Masterizar Pista Actual
                </button>
             </div>

             <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'noiseReduction', label: 'Eliminar Ruido de Fondo', icon: Wind, desc: 'Ideal para locuciones de exterior' },
                  { id: 'bassBoost', label: 'Cine Bass Punch', icon: Headphones, desc: 'Aumenta el impacto cinematográfico' },
                  { id: 'clarity', label: 'Vocal Presence', icon: Mic, desc: 'IA realza las frecuencias vocales' },
                ].map(enhance => (
                  <div key={enhance.id} className="p-4 bg-white/2 border border-white/5 rounded-[1.8rem] space-y-4">
                     <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-3">
                           <enhance.icon className="w-4 h-4 text-primary" />
                           <div className="flex flex-col text-left leading-tight">
                              <span className="text-[9px] font-black uppercase text-white tracking-widest">{enhance.label}</span>
                              <span className="text-[7.5px] text-slate-500 font-bold uppercase">{enhance.desc}</span>
                           </div>
                        </div>
                        <span className="text-[10px] text-primary font-mono font-black">{settings.audioEnhancements?.[enhance.id] || 0}%</span>
                     </div>
                     <input 
                       type="range" min="0" max="100" 
                       value={settings.audioEnhancements?.[enhance.id] || 0}
                       onChange={(e) => updateEnhancement(enhance.id, parseInt(e.target.value))}
                       className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
                     />
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900/50 border border-white/5 rounded-3xl flex items-center justify-between">
         <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <div className="flex flex-col text-left">
               <span className="text-[10px] font-black text-white uppercase tracking-tighter italic">Neural Beat Pulse</span>
               <span className="text-[8px] text-slate-500 font-bold uppercase">Sincronización AI Activa</span>
            </div>
         </div>
         <button className="bg-primary hover:bg-primary-dark text-black text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-lg shadow-primary/20">
            Auto-Beat Sync
         </button>
      </div>
    </div>
  );
}
