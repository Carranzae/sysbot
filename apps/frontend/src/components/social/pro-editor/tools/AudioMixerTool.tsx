import React, { useState } from 'react';
import { Music, Mic2, Volume2, VolumeX, Sparkles, Activity, Layers, Sliders, Headphones, Zap, Radio } from 'lucide-react';

export function AudioMixerTool() {
  const [activeTab, setActiveTab] = useState<'levels' | 'eq'>('levels');
  const [channels, setChannels] = useState([
    { id: 'vocal', label: 'Voz IA / Locución', volume: 85, muted: false, icon: Mic2, color: 'text-primary' },
    { id: 'music', label: 'Música (BGM)', volume: 60, muted: false, icon: Music, color: 'text-indigo-400' },
    { id: 'sfx', label: 'Efectos (SFX)', volume: 90, muted: false, icon: Sparkles, color: 'text-emerald-400' },
    { id: 'master', label: 'Master Bus', volume: 100, muted: false, icon: Volume2, color: 'text-white' },
  ]);

  const [eq, setEq] = useState({ high: 0, mid: 0, low: 0, presence: 0 });

  const updateVolume = (id: string, val: number) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, volume: val } : c));
  };

  const toggleMute = (id: string) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, muted: !c.muted } : c));
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shrink-0">
        <button 
          onClick={() => setActiveTab('levels')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'levels' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
        >
          <Sliders className="w-4 h-4" /> Niveles
        </button>
        <button 
          onClick={() => setActiveTab('eq')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'eq' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
        >
          <Radio className="w-4 h-4" /> EQ Mastering
        </button>
      </div>

      <div className="flex-1 space-y-4 custom-scrollbar overflow-y-auto pr-2 pb-10">
        
        {activeTab === 'levels' ? (
          <div className="space-y-4 animate-in fade-in duration-500">
             {/* Signal Monitor HUD */}
             <div className="p-4 bg-black/40 rounded-[2rem] border border-white/5 space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-[8px] font-black text-white/30 uppercase tracking-widest px-2">
                   <span>-60db</span>
                   <span className="text-emerald-500">-12db (Ideal)</span>
                   <span className="text-red-500">Peak (0db)</span>
                </div>
                <div className="flex gap-1 h-12 items-end px-1">
                   {Array.from({ length: 30 }).map((_, i) => (
                     <div 
                       key={i} 
                       className={`flex-1 rounded-full transition-all duration-300 ${i > 24 ? 'bg-red-500/40' : i > 18 ? 'bg-yellow-500/40' : 'bg-emerald-500/40'}`} 
                       style={{ height: `${20 + Math.random() * 80}%` }}
                     />
                   ))}
                </div>
             </div>

             <div className="space-y-3 pt-2">
               {channels.map((chan) => (
                 <div 
                   key={chan.id}
                   className={`p-4 rounded-[1.8rem] border transition-all ${chan.id === 'master' ? 'bg-white/5 border-primary/30 shadow-xl shadow-primary/5' : 'bg-white/2 border-white/5'}`}
                 >
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-xl bg-black/40 ${chan.color}`}>
                            <chan.icon className="w-4 h-4" />
                         </div>
                         <div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-tight">{chan.label}</h4>
                            <p className="text-[7px] text-slate-500 font-bold uppercase">{chan.muted ? 'Muted' : 'Digital Signal'}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => toggleMute(chan.id)}
                        className={`p-2 rounded-xl transition-all ${chan.muted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {chan.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                   </div>
                   <input 
                     type="range" min="0" max="100" value={chan.volume} 
                     disabled={chan.muted}
                     onChange={(e) => updateVolume(chan.id, parseInt(e.target.value))}
                     className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-primary"
                   />
                 </div>
               ))}
             </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="p-6 bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 rounded-[2.5rem] flex flex-col gap-6">
                <div className="flex items-center gap-3">
                   <Zap className="w-6 h-6 text-primary" />
                   <div className="flex flex-col text-left">
                      <span className="text-xs font-black text-white uppercase tracking-widest">Master 4-Band EQ</span>
                      <span className="text-[9px] text-primary font-bold uppercase tracking-widest">Surgical Precision Controller</span>
                   </div>
                </div>

                <div className="flex justify-between items-end h-32 px-2 gap-4">
                   {Object.entries(eq).map(([key, val], idx) => (
                      <div key={key} className="flex-1 flex flex-col items-center gap-4 h-full">
                         <div className="flex-1 w-2.5 bg-black/40 rounded-full relative overflow-hidden group">
                             <div 
                               className="absolute bottom-0 w-full bg-primary transition-all duration-300" 
                               style={{ height: `${((val + 10) / 20) * 100}%` }}
                             />
                             <input 
                                type="range" min="-10" max="10" step="1" 
                                value={val}
                                onChange={(e) => setEq(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize rotate-0"
                                style={{ transform: 'rotate(-90deg)', width: '128px', height: '10px', top: '59px', left: '-59px' }}
                             />
                         </div>
                         <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{key[0].toUpperCase()}</span>
                            <span className="text-[8px] font-mono text-primary">{val > 0 ? '+' : ''}{val}dB</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="grid grid-cols-1 gap-3">
                <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-1 px-1 text-left">Neural Audio Enhancements</div>
                {[
                  { label: 'Bass Extender', icon: Sparkles, desc: 'Deep sub-frequency enhancement' },
                  { label: 'Vocal Presence', icon: Mic2, desc: 'Clarity in dialogue frequencies' },
                  { label: 'Air & Crisp', icon: Headphones, desc: 'High-end sparkling precision' },
                ].map((fx, i) => (
                  <button key={i} className="flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl hover:border-primary/40 transition-all group">
                     <div className="flex items-center gap-4">
                        <fx.icon className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                        <div className="flex flex-col text-left">
                           <span className="text-[10px] font-black text-white uppercase">{fx.label}</span>
                           <span className="text-[7.5px] text-slate-600 font-bold uppercase">{fx.desc}</span>
                        </div>
                     </div>
                     <div className="w-4 h-4 rounded-full border border-white/10 group-hover:bg-primary transition-all" />
                  </button>
                ))}
             </div>
          </div>
        )}

      </div>

      <div className="p-4 bg-primary/10 border border-primary/20 rounded-[2rem] flex items-center justify-between shrink-0">
         <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-primary" />
            <div className="text-left leading-tight">
               <p className="text-[9px] font-black text-white uppercase">Industrial Audio Engine</p>
               <p className="text-[7px] text-primary/60 font-bold uppercase tracking-tighter">Latency: 2ms Active</p>
            </div>
         </div>
      </div>
    </div>
  );
}
