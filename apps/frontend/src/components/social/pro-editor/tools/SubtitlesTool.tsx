import React, { useState } from 'react';
import { MessageSquare, Wand2, CheckCircle2, Loader2, Sparkles, Highlighter, Zap, FileText, Edit3, Save, Clock, Trash2 } from 'lucide-react';

interface SubtitlesToolProps {
  onGenerateSubtitles?: () => void;
}

export function SubtitlesTool({ onGenerateSubtitles }: SubtitlesToolProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'editor'>('presets');
  const [activeStyle, setActiveStyle] = useState('minimal');

  const [captions, setCaptions] = useState([
    { id: '1', start: '0:01', text: '¡Bienvenidos al futuro de la edición AI!' },
    { id: '2', start: '0:04', text: 'Hoy vamos a crear contenido alucinante.' },
    { id: '3', start: '0:07', text: 'Con CinePro, todo es posible en segundos.' },
  ]);

  const handleAutoGenerate = () => {
    setIsGenerating(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setGenerated(true);
          setActiveTab('editor'); // Auto-switch to editor when ready
          if (onGenerateSubtitles) onGenerateSubtitles();
          return 100;
        }
        return p + 4;
      });
    }, 100);
  };

  const SUBTITLE_PRESETS = [
    { id: 'hormozi', icon: Sparkles, label: 'Alex Hormozi', desc: 'Sube la retención 40%', color: 'text-amber-400' },
    { id: 'minimal', icon: Highlighter, label: 'Minimal Glow', desc: 'Estética limpia Apple', color: 'text-white' },
    { id: 'beast', icon: Zap, label: 'Impacto Beast', desc: 'Para contenido viral', color: 'text-primary' },
    { id: 'news', icon: FileText, label: 'News Modern', desc: 'Serio y profesional', color: 'text-slate-200' },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 flex flex-col h-full">
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shrink-0">
        <button 
          onClick={() => setActiveTab('presets')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'presets' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
        >
          <Sparkles className="w-4 h-4" /> Estilos
        </button>
        <button 
          onClick={() => setActiveTab('editor')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'editor' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
        >
          <Edit3 className="w-4 h-4" /> Editorial
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {activeTab === 'presets' ? (
          <div className="space-y-6">
             <div className="space-y-4">
               {!generated ? (
                 <button 
                   onClick={handleAutoGenerate}
                   disabled={isGenerating}
                   className="w-full relative overflow-hidden group px-4 py-8 bg-slate-900 border border-white/10 rounded-3xl hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-3 shadow-2xl"
                 >
                   <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                   {isGenerating ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <Wand2 className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />}
                   <div className="text-center relative z-10">
                     <span className="text-xs font-black text-white uppercase tracking-[0.2em] block mb-1">{isGenerating ? 'Escrutando Audio...' : 'Auto-Transcribir'}</span>
                     <span className="text-[9px] text-slate-500 font-bold uppercase">Tecnología Whisper v3 Pro</span>
                   </div>
                   {isGenerating && (
                     <div className="w-[80%] h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden"><div className="h-full bg-primary transition-all duration-75 shadow-[0_0_15px_rgba(var(--primary),0.8)]" style={{ width: `${progress}%` }} /></div>
                   )}
                 </button>
               ) : (
                 <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[1.8rem] flex items-center justify-between animate-in zoom-in-95">
                    <div className="flex items-center gap-3 text-left">
                       <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                       <div className="flex flex-col"><span className="text-xs font-black text-white uppercase tracking-tighter">Éxito: Transcripción Lista</span><span className="text-[9px] text-emerald-500/60 font-bold uppercase">320 palabras detectadas</span></div>
                    </div>
                 </div>
               )}
             </div>

             <div className="grid grid-cols-1 gap-2">
                <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-2 px-1 text-left">Dynamic Subtitle Layouts</div>
                {SUBTITLE_PRESETS.map((style) => (
                  <button 
                    key={style.id} 
                    onClick={() => setActiveStyle(style.id)}
                    className={`group px-5 py-4 rounded-[2rem] border flex items-center justify-between transition-all ${activeStyle === style.id ? 'bg-primary/20 border-primary text-white shadow-xl shadow-primary/10' : 'bg-white/2 border-white/5 hover:bg-white/5 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-4">
                       <style.icon className={`w-5 h-5 ${activeStyle === style.id ? style.color : 'text-slate-600'}`} />
                       <div className="flex flex-col text-left leading-tight">
                          <span className={`text-[12px] font-black uppercase tracking-widest ${activeStyle === style.id ? 'text-white' : ''}`}>{style.label}</span>
                          <span className="text-[8px] opacity-60 font-bold uppercase mt-1">{style.desc}</span>
                       </div>
                    </div>
                    {activeStyle === style.id && <div className="w-2 hs-2 rounded-full bg-primary animate-pulse" />}
                  </button>
                ))}
             </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-500">
             <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em]">Subtitle Sequence Editor</span>
                <button className="text-[9px] text-primary font-black uppercase px-2 py-1 bg-primary/10 rounded-lg">+ Add Caption</button>
             </div>
             {captions.map((c) => (
               <div key={c.id} className="p-4 bg-[#0d1117] border border-white/5 rounded-[1.8rem] group hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between mb-3 px-1">
                     <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-primary/60" />
                        <span className="text-[9px] font-mono text-slate-500 tracking-tighter">{c.start}</span>
                     </div>
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"><Trash2 className="w-3 h-3" /></button>
                     </div>
                  </div>
                  <textarea 
                    value={c.text}
                    onChange={(e) => setCaptions(prev => prev.map(cap => cap.id === c.id ? { ...cap, text: e.target.value } : cap))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-white/80 font-medium outline-none focus:border-primary/50 transition-all resize-none min-h-[60px]"
                  />
               </div>
             ))}
             <button className="w-full py-3 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-4">
                <Save className="w-3.5 h-3.5 inline mr-2" /> Guardar Cambios Editoriales
             </button>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/5 grow-0">
         <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-[2rem]">
            <div className="flex items-center gap-3 text-left">
               <Zap className="w-5 h-5 text-primary" />
               <div className="flex flex-col"><span className="text-[10px] font-black text-white uppercase">Karaoke Engine V2</span><span className="text-[8px] text-slate-500 font-bold uppercase">Sync Palabras x Milisegundo</span></div>
            </div>
            <div className="w-10 h-5 bg-primary rounded-full p-1 flex justify-end shadow-lg shadow-primary/20"><div className="w-3 h-3 bg-white rounded-full" /></div>
         </div>
      </div>
    </div>
  );
}
