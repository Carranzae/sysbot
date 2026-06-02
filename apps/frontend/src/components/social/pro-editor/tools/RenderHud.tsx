import React, { useState, useEffect } from 'react';
import { Rocket, Loader2, CheckCircle2, Cpu, Monitor, Zap, Download, Share2, Sparkles, Database, ShieldCheck } from 'lucide-react';

interface RenderHudProps {
  onClose: () => void;
  projectData: any;
}

export function RenderHud({ onClose, projectData }: RenderHudProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing Render Engine...');
  const [isFinished, setIsFinished] = useState(false);

  const STEPS = [
    { threshold: 10, label: 'Compiling Shaders & Neural Models...', icon: Database },
    { threshold: 25, label: 'Applying Dreamy Glow & Beauty Engine...', icon: Sparkles },
    { threshold: 45, label: 'Baking Multi-Track Compositing...', icon: Cpu },
    { threshold: 65, label: 'Neural Audio Mastering & Locutions...', icon: Zap },
    { threshold: 85, label: 'Encoding HDR Frame Metadata...', icon: Monitor },
    { threshold: 100, label: 'Finalizing Cinematic Master...', icon: ShieldCheck },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsFinished(true);
          setStatus('Project Mastered Successfully');
          return 100;
        }
        const next = prev + Math.random() * 8;
        const step = STEPS.find(s => next <= s.threshold);
        if (step) setStatus(step.label);
        return Math.min(next, 100);
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const downloadManifest = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "cinepro_master_manifest.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-[2.5rem] p-8 shadow-[0_0_100px_rgba(var(--primary),0.15)] relative overflow-hidden">
        
        {/* Decorative background blast */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-32 bg-primary/20 blur-[100px] -translate-y-1/2" />

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col items-center text-center gap-4">
             <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.3)]">
                {isFinished ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-in zoom-in-50" />
                ) : (
                  <Rocket className="w-10 h-10 text-primary animate-bounce-slow" />
                )}
             </div>
             <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white">
                  {isFinished ? 'Master Pro Listo' : 'Renderizando Obra'}
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">CinePro Industrial Export Engine v4.0</p>
             </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black text-primary uppercase animate-pulse">{status}</span>
              <span className="text-xl font-mono text-white tracking-tighter">{Math.floor(progress)}%</span>
            </div>
            
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-primary via-indigo-500 to-primary rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                 <div className="p-1.5 bg-black/40 rounded-lg"><Cpu className="w-3 h-3 text-slate-400" /></div>
                 <div className="leading-none">
                    <p className="text-[8px] text-slate-500 font-bold uppercase">Encoder</p>
                    <p className="text-[10px] text-white font-mono uppercase">H.265 Gen2</p>
                 </div>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                 <div className="p-1.5 bg-black/40 rounded-lg"><Zap className="w-3 h-3 text-slate-400" /></div>
                 <div className="leading-none">
                    <p className="text-[8px] text-slate-500 font-bold uppercase">Complexity</p>
                    <p className="text-[10px] text-white font-mono uppercase">High Fidelity</p>
                 </div>
              </div>
            </div>
          </div>

          {isFinished && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <button 
                 onClick={downloadManifest}
                 className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/30"
               >
                 <Download className="w-4 h-4" /> Bajar Máster (.JSON)
               </button>
               <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-[9px] border border-white/10 transition-all flex items-center justify-center gap-2">
                    <Share2 className="w-3.5 h-3.5" /> Compartir
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all"
                  >
                    Cerrar Editor
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Technical HUD side labels */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 opacity-10">
           <div className="[writing-mode:vertical-lr] text-[8px] font-mono text-white rotate-180">0x8892_PIPELINE_ACTIVE</div>
           <div className="[writing-mode:vertical-lr] text-[8px] font-mono text-white rotate-180">NEURAL_NET_V3_SYNK</div>
        </div>
      </div>
    </div>
  );
}
