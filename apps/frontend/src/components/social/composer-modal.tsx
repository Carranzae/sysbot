'use client';

import { useState, useEffect } from 'react';
import {
  Video,
  Image,
  Upload,
  Download,
  Copy,
  ExternalLink,
  X,
  Languages,
  RefreshCw,
  Clock,
  Layout,
  ImageIcon,
  Music,
  Scissors,
  Wand2,
  Sparkles,
  Radio,
  CheckCircle2,
  CalendarClock,
  Sliders,
  Volume2,
  Focus,
  Sun,
  Contrast,
  Zap,
  Layers,
  BarChart3,
  MousePointer2,
  Users,
  TrendingUp,
  MessageSquare,
  Share2,
  BadgeCheck,
  FileText,
  Edit3,
  Scan,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SocialChannel, PlatformKey } from '@/store/social';
import { filesApi, socialApi } from '@/lib/api';
import { AIScanner } from './ai-scanner';
import ProEditor from './pro-editor';

interface ComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  industryType: string;
  channels: SocialChannel[];
  selectedBusiness: any;
  mediaFile: File | null;
  mediaPreview: string | null;
  mediaType: 'video' | 'image' | 'other';
  onMediaChange: (file: File | null) => void;
  onOpenEditor: () => void;
  initialCaption?: string;
  initialPlatforms?: PlatformKey[];
}

export function ComposerModal({ 
  open, 
  onOpenChange, 
  businessName, 
  industryType, 
  channels, 
  selectedBusiness,
  mediaFile,
  mediaPreview,
  mediaType,
  onMediaChange,
  onOpenEditor,
  initialCaption = '',
  initialPlatforms = ['instagram', 'tiktok', 'youtube']
}: ComposerModalProps) {
  const { toast } = useToast();
  
  const [globalCaption, setGlobalCaption] = useState('');
  const [selectedTargetPlatforms, setSelectedTargetPlatforms] = useState<PlatformKey[]>(['instagram', 'tiktok', 'youtube']);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [musicStyle, setMusicStyle] = useState('none');
  const [aiScannerOpen, setAiScannerOpen] = useState(false);
  
  // Sincronizar datos iniciales para REUSAR COPIAS
  useEffect(() => {
    if (open) {
      if (initialCaption) setGlobalCaption(initialCaption);
      if (initialPlatforms && initialPlatforms.length > 0) setSelectedTargetPlatforms(initialPlatforms);
    }
  }, [open, initialCaption, initialPlatforms]);

  // Estados de Edición de Calidad
  const [activeTab, setActiveTab] = useState<'edit' | 'ai' | 'strategy' | 'preview'>('edit');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [upscale4K, setUpscale4K] = useState(false);
  const [colorGrade, setColorGrade] = useState('natural');
  const [faceEnhance, setFaceEnhance] = useState(true);

  // Estados de Simulación de Rendimiento (Nuevos)
  const [predictionData, setPredictionData] = useState<{
    reach: string;
    engagement: string;
    bestTime: string;
    score: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onMediaChange(file);
    }
  };

  const handleRemoveMedia = () => {
    onMediaChange(null);
  };

  const handlePublish = async () => {
    if (!mediaFile || !selectedBusiness) return;

    const selectedChannels = channels.filter((c) => selectedTargetPlatforms.includes(c.key));
    const autoTargets = selectedChannels.filter((c) => c.mode === 'AUTO' && c.status === 'connected').map((c) => c.key);
    const assistedTargets = selectedTargetPlatforms.filter((k) => !autoTargets.includes(k));
    
    setIsPublishing(true);
    try {
      // 1. Subida real del archivo al backend
      const uploadRes = await filesApi.upload(
        selectedBusiness.id, 
        mediaFile, 
        `Post para ${selectedTargetPlatforms.join(', ')}`,
        ['social-media-post', ...selectedTargetPlatforms]
      );

      const fileId = uploadRes.data.id;
      const fileUrl = uploadRes.data.url; // Asumimos que el backend retorna la URL pública

      // 2. Persistencia en Backend (Industrialización)
      await socialApi.createPost(selectedBusiness.id, {
        caption: globalCaption,
        mediaUrl: fileUrl,
        mediaType: mediaType,
        targetPlatforms: selectedTargetPlatforms,
        scheduledAt: predictionData?.bestTime ? new Date().toISOString() : undefined, // Ejemplo de programación
      });

      // 3. Notificación al Usuario
      const mediaTypeText = mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Imagen' : 'Archivo';
      toast({
        title: assistedTargets.length > 0 ? `${mediaTypeText} en cola de sincronización` : '¡Lanzado correctamente!',
        description:
          assistedTargets.length > 0
            ? `Post registrado con éxito. Como hay redes en modo ASISTIDO, el sistema te notificará para completar la subida manual.`
            : `El post ha sido guardado de forma persistente y está siendo procesado para su publicación automática.`,
      });

      onOpenChange(false);
      handleRemoveMedia();
      setGlobalCaption('');
    } catch (error: any) {
      toast({
        title: 'Error en la publicación',
        description: error.message || 'No se pudo subir el archivo al servidor.',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAIMagic = () => {
    setIsAnalyzing(true);
    // Simular análisis de IA
    setTimeout(() => {
      setGlobalCaption(`� ¡ATENCIÓN ${businessName.toUpperCase()}! 🚀\n\n¿Estás listo para transformar tu experiencia en ${industryType}? \n\nDescubre por qué somos tendencia. 👇\n\n#${industryType.replace(/\s+/g, '')} #Innovacion #Exito #Viral`);
      setPredictionData({
        reach: "45K - 60K",
        engagement: "8.4%",
        bestTime: "Hoy, 20:45",
        score: 92
      });
      setIsAnalyzing(false);
      toast({
        title: 'Estrategia Generada',
        description: 'La IA ha optimizado el copy y predicho el rendimiento.',
      });
    }, 1500);
  };

  const togglePlatform = (key: PlatformKey) => {
    setSelectedTargetPlatforms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectedChannels = channels.filter((c) => selectedTargetPlatforms.includes(c.key));
  const autoTargets = selectedChannels.filter((c) => c.mode === 'AUTO' && c.status === 'connected').map((c) => c.key);
  const assistedTargets = selectedTargetPlatforms.filter((k) => !autoTargets.includes(k));

  const assistedLink = (platform: PlatformKey) => {
    if (platform === 'instagram') return 'https://www.instagram.com/';
    if (platform === 'facebook') return 'https://www.facebook.com/';
    if (platform === 'tiktok') return 'https://www.tiktok.com/upload';
    if (platform === 'youtube') return 'https://studio.youtube.com/';
    if (platform === 'linkedin') return 'https://www.linkedin.com/feed/';
    return 'https://www.google.com/';
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(globalCaption || '');
      toast({ title: 'Copiado', description: 'Caption copiado al portapapeles.' });
    } catch {
      toast({
        title: 'No se pudo copiar',
        description: 'Tu navegador bloqueó el portapapeles. Copia manualmente el texto.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadMedia = () => {
    if (!mediaFile) return;
    const url = URL.createObjectURL(mediaFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = mediaFile.name || 'media-file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleOpenVideoEditor = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Botón Editar presionado. mediaFile:', !!mediaFile);
    if (!mediaFile) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un archivo de imagen o video antes de abrir el editor.',
        variant: 'destructive',
      });
      return;
    }
    console.log('Solicitando apertura de Editor Pro al padre');
    onOpenEditor();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden rounded-3xl">
        <div className="p-6 border-b bg-white">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Video className="h-6 w-6 text-primary" />
            Nueva Publicación Multi-red
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium mt-1">
            Sube un video master, el sistema lo preparará para todas las redes seleccionadas.
          </DialogDescription>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 h-full overflow-hidden">
          {/* Columna Izquierda: Video y Masterización */}
          <div className="p-0 flex flex-col h-full overflow-hidden border-r bg-slate-50/30">
            {/* Preview de Video */}
            <div className="p-6 pb-2">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Master Asset Preview</Label>
                {mediaPreview && (
                  <Badge className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest border-none px-3 py-1 rounded-full animate-pulse">
                    {mediaType === 'video' ? 'Enriqueciendo Live' : mediaType === 'image' ? 'Procesando Imagen' : 'Procesando Archivo'}
                  </Badge>
                )}
              </div>
              
              {!mediaPreview ? (
                <div className="border-2 border-dashed rounded-[2.5rem] p-16 text-center hover:border-primary/50 transition-all cursor-pointer bg-white group shadow-sm border-slate-200 relative overflow-hidden">
                  <input
                    type="file"
                    accept="video/*,image/*,.pdf,.doc,.docx,.txt"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={handleFileChange}
                  />
                  <div className="bg-primary/5 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500 border border-primary/10">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                  <p className="text-lg text-slate-900 font-black uppercase tracking-tighter">Subir Archivo Master</p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-[0.2em]">
                    {mediaType === 'video' ? '4K • HDR • 60FPS Soportado' : 
                     mediaType === 'image' ? 'Alta Calidad • Formatos Web' : 
                     'Múltiples Formatos Soportados'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 group">
                  <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-video shadow-2xl ring-1 ring-slate-200 group-hover:ring-primary/20 transition-all duration-500">
                    {mediaType === 'video' ? (
                      <video 
                        src={mediaPreview} 
                        controls 
                        className="w-full h-full" 
                        style={{ 
                          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` 
                        }}
                      />
                    ) : (
                      <img 
                        src={mediaPreview} 
                        alt="Preview" 
                        className="w-full h-full object-contain" 
                        style={{ 
                          filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` 
                        }}
                      />
                    )}
                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <Badge className="bg-black/60 backdrop-blur-md text-[9px] font-black uppercase border-white/10">
                        {mediaType === 'video' ? aspectRatio : mediaType === 'image' ? 'Imagen' : 'Archivo'}
                      </Badge>
                      <Badge className="bg-black/60 backdrop-blur-md text-[9px] font-black uppercase border-white/10">
                        {mediaType === 'video' ? 'Master' : mediaType === 'image' ? 'Original' : 'Archivo'}
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-4 right-4 h-10 w-10 rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100"
                      onClick={handleRemoveMedia}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Botón de Edición Estratégico */}
            {mediaFile && (
              <div className="px-6 py-3 bg-gradient-to-r from-primary/5 to-blue-500/5 border-y border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
                      <Edit3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Edición Profesional</div>
                      <div className="text-xs text-slate-600">Recorta, agrega efectos y mejora tu contenido</div>
                    </div>
                  </div>
                  <div
                    role="button"
                    onClick={(e) => handleOpenVideoEditor(e)}
                    className="bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white rounded-xl font-black uppercase text-[11px] tracking-wider shadow-lg hover:shadow-xl transition-all duration-300 h-12 px-6 flex items-center justify-center cursor-pointer select-none"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar
                  </div>
                </div>
              </div>
            )}

            {/* Panel de Herramientas Pro */}
            <div className="flex-1 overflow-y-auto p-6 pt-2">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid grid-cols-4 h-14 rounded-2xl bg-white p-1 mb-6 border border-slate-200 shadow-sm">
                  <TabsTrigger value="edit" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-300">
                    <Sliders className="h-3.5 w-3.5 mr-2" />
                    Calidad
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-300">
                    <Zap className="h-3.5 w-3.5 mr-2" />
                    IA Magic
                  </TabsTrigger>
                  <TabsTrigger value="strategy" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-300">
                    <TrendingUp className="h-3.5 w-3.5 mr-2" />
                    Predicción
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-300">
                    <Share2 className="h-3.5 w-3.5 mr-2" />
                    Previsualizar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-4 mt-0 animate-in fade-in duration-300">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                          <Sun className="h-3.5 w-3.5 text-amber-500" /> Brillo
                        </Label>
                        <span className="text-[10px] font-black text-slate-400">{brightness}%</span>
                      </div>
                      <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                          <Contrast className="h-3.5 w-3.5 text-blue-500" /> Contraste
                        </Label>
                        <span className="text-[10px] font-black text-slate-400">{contrast}%</span>
                      </div>
                      <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                          <Volume2 className="h-3.5 w-3.5 text-emerald-500" /> Saturación
                        </Label>
                        <span className="text-[10px] font-black text-slate-400">{saturation}%</span>
                      </div>
                      <input type="range" min="50" max="150" value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button type="button" variant="outline" className={`h-16 flex-col gap-1 rounded-2xl border-slate-100 hover:bg-slate-50 transition-all ${upscale4K ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`} onClick={() => setUpscale4K(!upscale4K)}>
                        <Focus className="h-4 w-4 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Upscale 4K</span>
                      </Button>
                      <Button type="button" variant="outline" className={`h-16 flex-col gap-1 rounded-2xl border-slate-100 hover:bg-slate-50 transition-all ${faceEnhance ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`} onClick={() => setFaceEnhance(!faceEnhance)}>
                        <Layers className="h-4 w-4 text-emerald-500" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Mejorar Rostros</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4 mt-0 animate-in fade-in duration-300">
                  <div className="rounded-3xl border border-slate-100 p-6 bg-white">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-900">IA de copy y rendimiento</div>
                    <div className="mt-2 text-[11px] font-medium text-slate-500">
                      Usa “Mejorar con IA” en el panel derecho para generar caption y predicción.
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="strategy" className="space-y-4 mt-0 animate-in fade-in duration-300">
                  <div className="space-y-4">
                    <div className="rounded-3xl border-2 border-primary/10 p-6 bg-primary/[0.02] relative overflow-hidden">
                      <div className="relative z-10 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Puntuación de Viralidad</div>
                          <div className="text-4xl font-black text-slate-900">{predictionData?.score || '--'}%</div>
                        </div>
                        <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${predictionData?.score || 0}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 p-4 bg-white">
                        <Users className="h-4 w-4 text-blue-500 mb-2" />
                        <div className="text-[9px] font-black uppercase text-slate-400">Alcance Estimado</div>
                        <div className="text-sm font-black text-slate-900 tracking-tight">{predictionData?.reach || 'N/A'}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-4 bg-white">
                        <MousePointer2 className="h-4 w-4 text-emerald-500 mb-2" />
                        <div className="text-[9px] font-black uppercase text-slate-400">Engagement</div>
                        <div className="text-sm font-black text-slate-900 tracking-tight">{predictionData?.engagement || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 p-4 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Mejor Momento</div>
                          <div className="text-xs font-black text-slate-900 tracking-tight">{predictionData?.bestTime || 'Calculando...'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-4 mt-0 animate-in fade-in duration-300">
                  <div className="space-y-4">
                    <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm mx-auto max-w-[280px]">
                      <div className="p-4 flex items-center gap-3 border-b border-slate-50">
                        <div className="h-8 w-8 rounded-full bg-slate-100" />
                        <div className="text-[11px] font-black uppercase tracking-tight text-slate-900">{businessName}</div>
                      </div>
                      <div className="aspect-[4/5] bg-slate-900 flex items-center justify-center relative">
                        {mediaPreview ? (
                          mediaType === 'video' ? (
                            <video src={mediaPreview} className="w-full h-full object-cover opacity-60" muted />
                          ) : (
                            <img src={mediaPreview} className="w-full h-full object-cover opacity-60" />
                          )
                        ) : (
                          <Video className="h-10 w-10 text-white/20" />
                        )}
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="text-white text-[10px] font-medium line-clamp-2">{globalCaption || 'Tu caption aparecerá aquí...'}</div>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between border-t border-slate-50">
                        <div className="flex gap-3">
                          <MessageSquare className="h-4 w-4 text-slate-400" />
                          <Share2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <BadgeCheck className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">Vista previa Mobile (Instagram/Reels)</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Columna Derecha: Estrategia y Publicación */}
          <div className="p-6 space-y-6 overflow-y-auto bg-white">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="caption" className="text-xs font-bold uppercase tracking-widest text-slate-500">Contenido Estratégico</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary hover:bg-primary/5 rounded-full px-4"
                  onClick={handleAIMagic}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Mejorar con IA
                </Button>
              </div>
              <Textarea
                id="caption"
                placeholder="¿De qué trata este video? La IA generará el mejor copy para cada red..."
                className="min-h-[160px] resize-none focus-visible:ring-primary rounded-3xl border-slate-200 text-sm p-5 shadow-sm"
                value={globalCaption}
                onChange={(e) => setGlobalCaption(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 px-1">
                <Badge variant="secondary" className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 rounded-lg px-2 shadow-sm border-none">#viral</Badge>
                <Badge variant="secondary" className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 rounded-lg px-2 shadow-sm border-none">#{industryType.toLowerCase()}</Badge>
                <Badge variant="secondary" className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 rounded-lg px-2 shadow-sm border-none">#trending</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Plan de Distribución</Label>
              <div className="grid grid-cols-2 gap-3">
                {channels.map((c) => (
                  <div 
                    key={`target-${c.key}`} 
                    className={`group relative flex items-center space-x-3 border-2 rounded-2xl p-4 transition-all duration-300 cursor-pointer ${
                      selectedTargetPlatforms.includes(c.key) ? 'border-primary bg-primary/[0.03] shadow-md scale-[1.02]' : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                    onClick={() => togglePlatform(c.key)}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-300 ${selectedTargetPlatforms.includes(c.key) ? 'bg-primary text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-black leading-none tracking-tight ${selectedTargetPlatforms.includes(c.key) ? 'text-primary' : 'text-slate-700'}`}>{c.title}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 tracking-widest">{c.mode}</span>
                    </div>
                    <div className={`absolute top-2 right-2 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${selectedTargetPlatforms.includes(c.key) ? 'bg-primary border-primary scale-110 shadow-sm' : 'border-slate-200 scale-90'}`}>
                      {selectedTargetPlatforms.includes(c.key) && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t space-y-5">
              {assistedTargets.length > 0 && (
                <div className="rounded-[2rem] border border-amber-100 bg-amber-50/50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Publicación asistida (sin API)</div>
                    <Badge className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest border-none px-3 rounded-full">
                      {assistedTargets.length} canales
                    </Badge>
                  </div>
                  <div className="mt-2 text-[11px] font-medium text-amber-700/80">
                    Para estos canales, publica manualmente usando la app oficial (sin scraping, sin riesgos).
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest border-amber-200 bg-white"
                      onClick={handleDownloadMedia}
                      disabled={!mediaFile}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest border-amber-200 bg-white"
                      onClick={handleCopyCaption}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar caption
                    </Button>
                    <Button
                      type="button"
                      className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                      onClick={() => window.open(assistedLink(assistedTargets[0]!), '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir app/web
                    </Button>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-[2rem] p-5 text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CalendarClock className="h-24 w-24 -mr-8 -mt-8" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/20">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Algoritmo de Envío</span>
                    </div>
                    <Badge className="bg-primary text-white text-[9px] font-black uppercase tracking-widest border-none px-3 rounded-full">Premium</Badge>
                  </div>
                  <p className="text-[11px] text-slate-300 font-bold leading-relaxed tracking-wide uppercase">
                    El sistema elegirá los <span className="text-primary font-black">3 mejores horarios</span> de esta semana para cada red según la actividad de tu audiencia.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 pt-2">
                <Button 
                  variant="ghost" 
                  className="flex-1 rounded-2xl font-black uppercase text-[11px] tracking-widest h-14 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors" 
                  onClick={() => onOpenChange(false)}
                >
                  Descartar
                </Button>
                <Button 
                  className="flex-[2] bg-primary text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.1em] h-14 shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all duration-300 active:scale-95 disabled:opacity-50 relative overflow-hidden" 
                  disabled={!mediaFile || isAnalyzing || isPublishing} 
                  onClick={handlePublish}
                >
                  {isAnalyzing ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analizando...
                    </div>
                  ) : isPublishing ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Subiendo Master...
                    </div>
                  ) : (
                    "Lanzar en todas las redes"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal del Escáner IA - Mantener aquí por ahora ya que no causaba conflicto, pero usando el mediaFile compartido */}
    <AIScanner
      open={aiScannerOpen}
      onOpenChange={setAiScannerOpen}
      mediaFile={mediaFile}
      onMediaChange={onMediaChange}
    />
    </>
  );
}
