import React, { useState } from 'react';
import { Mic2, Play, Sparkles, Volume2, Wand2, Languages, Headphones, MessageSquareText } from 'lucide-react';

interface VoiceoverToolProps {
  onAddAudio: (url: string, name: string) => void;
}

export function VoiceoverTool({ onAddAudio }: VoiceoverToolProps) {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('elegant-pro');
  const [isGenerating, setIsGenerating] = useState(false);

  const VOICES = [
    { id: 'elegant-pro', name: 'Elegancia Pro', lang: 'ES', icon: Headphones, desc: 'Voz profunda y calmada para cine' },
    { id: 'viral-energy', name: 'Energía Viral', lang: 'ES', icon: Sparkles, desc: 'Voz dinámica para TikTok/Reels' },
    { id: 'narrator-soft', name: 'Narrador Soft', lang: 'ES', icon: Volume2, desc: 'Ideal para documentales y vlogs' },
    { id: 'english-master', name: 'English Master', lang: 'EN', icon: Languages, desc: 'Perfect British RP accent' },
  ];

  const handleGenerate = () => {
    if (!text) return;
    setIsGenerating(true);
    
    // Simulación de procesamiento de IA Neural Pro
    setTimeout(() => {
      // En un entorno real, aquí se llamaría a una API (ElevenLabs, OpenAI TTS, etc.)
      // Para la demo, usamos un placeholder que representa el archivo generado
      const simulatedAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // URL de ejemplo
      onAddAudio(simulatedAudioUrl, `AI Voiceover - ${voice}`);
      setIsGenerating(false);
      setText('');
    }, 2000);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="text-xs text-white/60 font-black uppercase tracking-widest flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary animate-pulse" /> Locución IA Generativa
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
            <MessageSquareText className="w-3 h-3" /> Texto para Locución
          </label>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe lo que quieres que diga la IA... (Ej: Bienvenidos a esta increíble experiencia cinematográfica)"
            className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-xs text-white resize-none outline-none focus:border-primary/50 transition-all placeholder:text-slate-700"
          />
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Seleccionar Voz de Elite</label>
          <div className="grid grid-cols-1 gap-2">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${
                  voice === v.id 
                    ? 'bg-primary/20 border-primary text-white shadow-[0_0_20px_rgba(var(--primary),0.1)]' 
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10'
                }`}
              >
                <div className={`p-2 rounded-xl ${voice === v.id ? 'bg-primary text-white' : 'bg-white/10 text-slate-500'}`}>
                   <v.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-tight">{v.name}</span>
                    <span className="text-[7px] bg-white/10 px-1 rounded font-bold">{v.lang}</span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-medium">{v.desc}</p>
                </div>
                {voice === v.id && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!text || isGenerating}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${
            isGenerating || !text
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5' 
              : 'bg-primary hover:bg-primary-dark text-white shadow-xl shadow-primary/20 active:scale-95 border border-primary/20'
          }`}
        >
          {isGenerating ? (
             <div className="flex items-center gap-3">
               <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               <span className="text-[10px] font-black uppercase tracking-widest italic">Sintetizando Voz...</span>
             </div>
          ) : (
             <>
               <Mic2 className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Generar Locución Realista</span>
             </>
          )}
        </button>
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-4">
         <Sparkles className="w-4 h-4 text-primary shrink-0" />
         <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">
           Nuestra IA utiliza redes neuronales de última generación para capturar cadencia, tono y emoción humana real. Perfecta para contenido viral y documentales.
         </p>
      </div>
    </div>
  );
}
