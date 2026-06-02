import { Upload, Music, Play, Image as ImageIcon, Camera, Layout, Zap, Scissors } from 'lucide-react';

interface MultimediaToolProps {
  onUploadClick: () => void;
  onAudioUploadClick: () => void;
  setVideoSettings?: React.Dispatch<React.SetStateAction<any>>;
  onSmartSplit?: () => void;
  hasActiveClip?: boolean;
}

export function MultimediaTool({ onUploadClick, onAudioUploadClick, setVideoSettings, onSmartSplit, hasActiveClip }: MultimediaToolProps) {
  const BACKGROUNDS = [
    { id: 'none', label: 'Original', thumb: 'bg-slate-900 border-dashed border-white/20', url: 'transparent' },
    { id: 'studio', label: 'Estudio TV', thumb: 'bg-black', url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80' },
    { id: 'cyber', label: 'Night City', thumb: 'bg-indigo-950', url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=800&q=80' },
    { id: 'luxury', label: 'Corporate', thumb: 'bg-slate-800', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80' },
    { id: 'neon', label: 'Neon Glow', thumb: 'bg-pink-900', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80' },
    { id: 'minimal', label: 'Architect', thumb: 'bg-stone-800', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80' },
  ];

  const setBackground = (url: string) => {
    if (setVideoSettings) {
      setVideoSettings((prev: any) => ({ 
        ...prev, 
        backgroundImage: url === 'transparent' ? '' : url,
        backgroundColor: url === 'transparent' ? 'transparent' : '#000000',
        smartCutoutEnabled: url !== 'transparent'
      }));
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Layout className="w-4 h-4 text-primary" /> Librería Cinematic
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onUploadClick}
          className="group flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-primary/50 transition-all gap-2"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
             <Camera className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter text-white">Cargar Video</span>
        </button>

        <button
          onClick={onAudioUploadClick}
          className="group flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-primary/50 transition-all gap-2"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
             <Music className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter text-white">Cargar Audio</span>
        </button>

        {hasActiveClip && (
          <button
            onClick={onSmartSplit}
            className="col-span-2 group flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary/20 transition-all gap-4 animate-in zoom-in-95"
          >
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                 <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-tighter text-white">Smart Split AI</span>
              </div>
              <p className="text-[8px] text-slate-500 font-bold uppercase">Detectar escenas y cortar para Social Media</p>
            </div>
            <div className="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/30 group-hover:bg-primary transition-colors">
               <span className="text-[9px] font-black text-white uppercase group-hover:text-primary-foreground">Analizar</span>
               <Scissors className="w-3 h-3 text-white group-hover:text-primary-foreground" />
            </div>
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
           <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Fondos Virtuales Cine</span>
           </div>
           <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-full border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-tighter">AI AutoCut</span>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
           {BACKGROUNDS.map((bg) => (
             <button
               key={bg.id}
               onClick={() => setBackground(bg.url)}
               className="group relative aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all"
             >
               <div className={`absolute inset-0 ${bg.thumb} bg-cover bg-center transition-transform duration-700 group-hover:scale-110`} style={{ backgroundImage: bg.url && bg.url !== 'transparent' ? `url(${bg.url})` : '' }} />
               <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
               <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <span className="text-[9px] font-black text-white uppercase tracking-tighter">{bg.label}</span>
                  <span className="text-[7px] text-primary font-bold uppercase">Apply Cine</span>
               </div>
             </button>
           ))}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-2">Historial de Medios</div>
        <div className="grid grid-cols-3 gap-1.5 ">
          {[1,2,3,4,5,6].map((i) => (
             <div key={i} className="aspect-square bg-white/5 rounded-lg border border-white/5 hover:border-primary/40 transition-all flex items-center justify-center group cursor-pointer overflow-hidden">
                <Play className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
