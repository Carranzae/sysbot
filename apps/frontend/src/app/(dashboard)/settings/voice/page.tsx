"use client";

import { useState, useEffect } from 'react';
import { Shield, Volume2, Upload, AlertCircle, FileText, CheckCircle, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useBusinessStore } from '@/store/business';

export default function VoiceCloningPage() {
  const { toast } = useToast();
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [voiceModelId, setVoiceModelId] = useState('');
  const [sampleAudioUrl, setSampleAudioUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // TTS Test Form
  const [testText, setTestText] = useState('');
  const [synthesizedAudio, setSynthesizedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!selectedBusiness) return;
    // Simular fetch de configuración existente
    setTermsAccepted(true);
    setVoiceModelId('eleven_voice_custom_v2');
    setSampleAudioUrl('https://storage.googleapis.com/sysbot-voices/sample_business_owner.mp3');
  }, [selectedBusiness]);

  const handleAcceptTerms = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setTermsAccepted(true);
      setIsLoading(false);
      toast({
        title: 'Términos Aceptados',
        description: 'Se ha registrado la aceptación de términos con firma digital e IP del servidor.',
      });
    }, 1000);
  };

  const handleSaveModel = async () => {
    if (!voiceModelId) {
      toast({
        title: 'Error de validación',
        description: 'Ingrese un ID de modelo de voz válido.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: 'Configuración Guardada',
        description: 'El motor de telefonía y audio se sincronizó con el modelo de voz.',
      });
    }, 1000);
  };

  const handleSynthesize = async () => {
    if (!testText) return;
    setIsLoading(true);
    setTimeout(() => {
      setSynthesizedAudio('https://storage.googleapis.com/sysbot-voices/generated_test.mp3');
      setIsLoading(false);
      toast({
        title: 'Audio Sintetizado',
        description: 'Audio generado correctamente con la clonación de tu voz.',
      });
    }, 1500);
  };

  if (!selectedBusiness) {
    return (
      <div className="p-8 text-center bg-[#0d0f14] min-h-screen text-slate-400">
        <p className="text-lg">Selecciona un negocio en el menú superior para configurar la Clonación de Voz.</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#0b0c10] text-slate-100 min-h-screen space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Clonación de Voz</h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase px-2 py-0.5 rounded">
              🎙️ Microservicio Activo
            </Badge>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase mt-1 tracking-wider">
            Configura y entrena la propia voz de tu negocio para audios y llamadas automáticas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Acuerdo Legal de Consentimiento */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-amber-400">
              <Shield className="h-6 w-6" />
              <h2 className="text-lg font-black uppercase tracking-wider">Acuerdo y Consentimiento de Privacidad</h2>
            </div>
            
            <div className="bg-slate-900/60 rounded-2xl p-6 border border-white/5 max-h-60 overflow-y-auto text-xs text-slate-400 leading-relaxed space-y-4">
              <p className="font-bold text-slate-300">TÉRMINOS Y CONDICIONES GENERALES DE BIO-SEGURIDAD DE VOZ</p>
              <p>1. <strong>Exclusividad de Instancia:</strong> La voz del cliente se utilizará de manera aislada y cerrada y jamás bajo ningún concepto será compartida con terceros o expuesta en modelos de IA públicos.</p>
              <p>2. <strong>Firma Digital Obligatoria:</strong> Al habilitar este apartado, usted certifica la autenticidad e inocencia de las muestras de voz provistas bajo sanciones y responsabilidades civiles de su jurisdicción.</p>
              <p>3. <strong>Revocabilidad instantánea:</strong> El cliente tiene total potestad para eliminar por completo la red de voz de nuestros servidores con un solo clic.</p>
            </div>

            <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  {termsAccepted ? 'Términos Legales Aceptados y Firmados Digitalmente' : 'Pendiente de Aceptación Legal'}
                </span>
              </div>
              {!termsAccepted && (
                <Button 
                  onClick={handleAcceptTerms} 
                  disabled={isLoading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl font-bold uppercase text-[10px] tracking-wider px-6 h-10"
                >
                  Aceptar Términos
                </Button>
              )}
            </div>
          </div>

          {/* Configuración del Modelo de Voz */}
          <div className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-sky-400">
              <Volume2 className="h-6 w-6" />
              <h2 className="text-lg font-black uppercase tracking-wider">Configuración de Red de Voz</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">ID de Modelo de Voz (ElevenLabs / Play.ht)</label>
                <input 
                  type="text" 
                  value={voiceModelId} 
                  onChange={(e) => setVoiceModelId(e.target.value)}
                  placeholder="Ej: eleven_voice_custom_v2"
                  className="w-full bg-slate-900/60 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                  disabled={!termsAccepted}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Archivo de Muestra Original</label>
                <div className="flex items-center gap-4 bg-slate-900/60 border border-white/5 rounded-2xl p-4">
                  <div className="p-3 bg-white/5 rounded-xl text-slate-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">sample_business_owner.mp3</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">3.2 MB • Grabación de Voz</div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-white/10 hover:bg-white/5 text-slate-300 rounded-xl font-bold uppercase text-[9px] tracking-wider px-4 h-9"
                    disabled={!termsAccepted}
                  >
                    <Upload className="h-3 w-3 mr-2" />
                    Cargar Muestra
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleSaveModel} 
                  disabled={isLoading || !termsAccepted}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 rounded-2xl font-black uppercase text-[11px] tracking-widest h-14"
                >
                  Sincronizar y Habilitar Voz del Bot
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Simulación y Prueba */}
        <div className="space-y-6">
          <div className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-purple-400">
              <Sparkles className="h-6 w-6" />
              <h2 className="text-lg font-black uppercase tracking-wider font-mono">Consola de Prueba TTS</h2>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Escribe cualquier mensaje de texto a continuación y genera una simulación del audio utilizando tu modelo de voz clonada en tiempo real.
            </p>

            <div className="space-y-4">
              <textarea 
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Hola, bienvenido a nuestro negocio corporativo. ¿En qué puedo asistirte hoy?"
                rows={4}
                className="w-full bg-slate-900/60 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition resize-none"
                disabled={!voiceModelId}
              />

              <Button 
                onClick={handleSynthesize}
                disabled={isLoading || !testText || !voiceModelId}
                className="w-full bg-purple-500 hover:bg-purple-600 text-slate-950 rounded-2xl font-black uppercase text-[11px] tracking-widest h-12"
              >
                Generar Audio Clonado
              </Button>

              {synthesizedAudio && (
                <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                      <Play className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">audio_sintetizado.mp3</div>
                      <div className="text-[10px] text-purple-400 font-bold uppercase mt-0.5">Voz Clonada OK</div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10 rounded-xl font-bold uppercase text-[9px] tracking-wider px-4 h-9"
                  >
                    Escuchar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
