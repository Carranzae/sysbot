'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  Image as ImageIcon,
  Download,
  Upload,
  Copy,
  X,
  Type,
  Palette,
  Music,
  Scissors,
  Move,
  Zap,
  Sun,
  Contrast,
  Volume2,
  Sliders,
  Save,
  Eye,
  EyeOff,
  Layers,
  Text,
  Square,
  Circle,
  Triangle,
  Star,
  Clock,
  RotateCw,
  Crop,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface VideoEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoFile: File | null;
  onVideoChange: (file: File | null) => void;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  opacity: number;
  rotation: number;
}

interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sepia: number;
}

interface TimelineClip {
  id: string;
  startTime: number;
  endTime: number;
  name: string;
}

export function VideoEditor({ open, onOpenChange, videoFile, onVideoChange }: VideoEditorProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados del editor
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState<'edit' | 'text' | 'filters' | 'timeline'>('edit');
  
  // Estados de edición
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    sepia: 0,
  });
  
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [textSettings, setTextSettings] = useState({
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Arial',
    fontWeight: 'bold',
    opacity: 100,
    rotation: 0,
  });
  
  // Timeline
  const [timeline, setTimeline] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Cargar video en el elemento
  useEffect(() => {
    if (videoFile && videoRef.current) {
      const url = URL.createObjectURL(videoFile);
      videoRef.current.src = url;
      
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          setDuration(videoRef.current.duration);
          setCurrentTime(0);
        }
      };
      
      videoRef.current.ontimeupdate = () => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
      };
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [videoFile]);

  // Aplicar filtros al canvas
  const applyFilters = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    if (!ctx || !video) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Aplicar filtros CSS
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px) sepia(${filters.sepia}%)`;
    
    // Dibujar frame actual
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }, [filters, videoFile]);

  // Actualizar canvas cuando cambia el tiempo
  useEffect(() => {
    applyFilters();
  }, [currentTime, applyFilters]);

  // Controles de reproducción
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Text overlays
  const addTextOverlay = () => {
    if (!newText.trim()) return;
    
    const overlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50,
      y: 50,
      ...textSettings,
    };
    
    setTextOverlays([...textOverlays, overlay]);
    setNewText('');
    setSelectedTextId(overlay.id);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(overlays => 
      overlays.map(overlay => 
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(overlays => overlays.filter(overlay => overlay.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };

  // Timeline y trimming
  const addTimelineClip = () => {
    const clip: TimelineClip = {
      id: Date.now().toString(),
      startTime: trimStart,
      endTime: trimEnd,
      name: `Clip ${timeline.length + 1}`,
    };
    
    setTimeline([...timeline, clip]);
  };

  const deleteTimelineClip = (id: string) => {
    setTimeline(clips => clips.filter(clip => clip.id !== id));
  };

  // Exportar video editado
  const exportVideo = async () => {
    if (!canvasRef.current) return;
    
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        
        const exportFile = new File([blob], 'edited-video.mp4', { type: 'video/mp4' });
        onVideoChange(exportFile);
        
        toast({
          title: 'Video Exportado',
          description: 'El video editado ha sido exportado correctamente.',
        });
        
        onOpenChange(false);
      }, 'video/mp4');
    } catch (error) {
      toast({
        title: 'Error al Exportar',
        description: 'No se pudo exportar el video editado.',
        variant: 'destructive',
      });
    }
  };

  // Formatear tiempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="flex items-center justify-between p-6 border-b bg-white">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <Video className="h-6 w-6 text-primary" />
            Editor de Video Profesional
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Edita tu video con herramientas profesionales: filtros, texto, timeline y más.
          </DialogDescription>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={exportVideo}
              className="bg-primary text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden">
          {/* Panel Izquierdo - Canvas y Video */}
          <div className="lg:col-span-2 p-6 bg-slate-50 border-r">
            <div className="space-y-4">
              {/* Canvas de edición */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="hidden"
                  onPlay={handlePlay}
                  onPause={handlePause}
                />
                <canvas
                  ref={canvasRef}
                  className="w-full h-full max-h-96 object-contain"
                />
                
                {/* Controles de reproducción */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4">
                  <div className="flex items-center gap-4 text-white">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={isPlaying ? handlePause : handlePlay}
                      className="text-white hover:bg-white/20"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <span>{formatTime(currentTime)}</span>
                      <span>/</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-white hover:bg-white/20"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Controles adicionales */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-700">Volumen</Label>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-slate-500" />
                    <Slider
                      value={[volume]}
                      onValueChange={([value]) => handleVolumeChange(value)}
                      max={1}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xs text-slate-500">{Math.round(volume * 100)}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-700">Velocidad</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <select
                      value={playbackSpeed}
                      onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                      className="flex-1 px-2 py-1 text-sm border rounded"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2x</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel Derecho - Herramientas */}
          <div className="p-6 bg-white overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-12 rounded-xl bg-slate-100 p-1 mb-6">
                <TabsTrigger value="edit" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                  <Sliders className="h-4 w-4" />
                  Editar
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                  <Type className="h-4 w-4" />
                  Texto
                </TabsTrigger>
                <TabsTrigger value="filters" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                  <Palette className="h-4 w-4" />
                  Filtros
                </TabsTrigger>
              </TabsList>

              {/* Tab de Editar */}
              <TabsContent value="edit" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Recortar Video (Trim)</Label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Inicio</Label>
                          <Input
                            type="number"
                            value={trimStart}
                            onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                            min={0}
                            max={duration}
                            step={0.1}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fin</Label>
                          <Input
                            type="number"
                            value={trimEnd}
                            onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                            min={0}
                            max={duration}
                            step={0.1}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={addTimelineClip}
                        className="w-full"
                        disabled={trimStart >= trimEnd}
                      >
                        <Scissors className="h-4 w-4 mr-2" />
                        Agregar Clip
                      </Button>
                    </div>
                  </div>

                  {/* Timeline Clips */}
                  {timeline.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3">Timeline</Label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {timeline.map((clip) => (
                          <div
                            key={clip.id}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedClipId === clip.id
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => setSelectedClipId(clip.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Play className="h-4 w-4 text-slate-500" />
                              <div>
                                <div className="text-sm font-medium">{clip.name}</div>
                                <div className="text-xs text-slate-500">
                                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteTimelineClip(clip.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab de Texto */}
              <TabsContent value="text" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Agregar Texto</Label>
                    <div className="space-y-3">
                      <Textarea
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder="Escribe tu texto aquí..."
                        className="min-h-[80px]"
                      />
                      <Button
                        onClick={addTextOverlay}
                        disabled={!newText.trim()}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Texto
                      </Button>
                    </div>
                  </div>

                  {/* Text Overlays */}
                  {textOverlays.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3">Capas de Texto</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {textOverlays.map((overlay) => (
                          <div
                            key={overlay.id}
                            className={`p-3 rounded-lg border transition-all ${
                              selectedTextId === overlay.id
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => setSelectedTextId(overlay.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium mb-2">{overlay.text}</div>
                                <div className="text-xs text-slate-500">
                                  Posición: ({Math.round(overlay.x)}, {Math.round(overlay.y)})
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteTextOverlay(overlay.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Configuración de texto seleccionado */}
                  {selectedTextId && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                      <Label className="text-sm font-medium text-slate-700 mb-3">Configurar Texto</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Tamaño</Label>
                          <Slider
                            value={[textSettings.fontSize]}
                            onValueChange={([value]) => updateTextOverlay(selectedTextId, { fontSize: value })}
                            min={12}
                            max={120}
                            step={2}
                          />
                          <span className="text-xs text-slate-500">{textSettings.fontSize}px</span>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Color</Label>
                          <input
                            type="color"
                            value={textSettings.color}
                            onChange={(e) => updateTextOverlay(selectedTextId, { color: e.target.value })}
                            className="w-full h-10 rounded"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-xs">Opacidad</Label>
                          <Slider
                            value={[textSettings.opacity]}
                            onValueChange={([value]) => updateTextOverlay(selectedTextId, { opacity: value })}
                            min={0}
                            max={100}
                            step={5}
                          />
                          <span className="text-xs text-slate-500">{textSettings.opacity}%</span>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Rotación</Label>
                          <Slider
                            value={[textSettings.rotation]}
                            onValueChange={([value]) => updateTextOverlay(selectedTextId, { rotation: value })}
                            min={-180}
                            max={180}
                            step={15}
                          />
                          <span className="text-xs text-slate-500">{textSettings.rotation}°</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab de Filtros */}
              <TabsContent value="filters" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Filtros de Video</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Brillo</Label>
                        <Slider
                          value={[filters.brightness]}
                          onValueChange={([value]) => setFilters({ ...filters, brightness: value })}
                          min={0}
                          max={200}
                          step={5}
                        />
                        <span className="text-xs text-slate-500">{filters.brightness}%</span>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Contraste</Label>
                        <Slider
                          value={[filters.contrast]}
                          onValueChange={([value]) => setFilters({ ...filters, contrast: value })}
                          min={0}
                          max={200}
                          step={5}
                        />
                        <span className="text-xs text-slate-500">{filters.contrast}%</span>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Saturación</Label>
                        <Slider
                          value={[filters.saturation]}
                          onValueChange={([value]) => setFilters({ ...filters, saturation: value })}
                          min={0}
                          max={200}
                          step={5}
                        />
                        <span className="text-xs text-slate-500">{filters.saturation}%</span>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Desenfoque</Label>
                        <Slider
                          value={[filters.blur]}
                          onValueChange={([value]) => setFilters({ ...filters, blur: value })}
                          min={0}
                          max={20}
                          step={1}
                        />
                        <span className="text-xs text-slate-500">{filters.blur}px</span>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Sepia</Label>
                        <Slider
                          value={[filters.sepia]}
                          onValueChange={([value]) => setFilters({ ...filters, sepia: value })}
                          min={0}
                          max={100}
                          step={5}
                        />
                        <span className="text-xs text-slate-500">{filters.sepia}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Presets de filtros */}
                  <div className="mt-6">
                    <Label className="text-sm font-medium text-slate-700 mb-3">Presets Rápidos</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ brightness: 110, contrast: 110, saturation: 120, blur: 0, sepia: 0 })}
                      >
                        <Sun className="h-4 w-4 mr-1" />
                        Soleado
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ brightness: 90, contrast: 90, saturation: 80, blur: 0, sepia: 20 })}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Atardecer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ brightness: 80, contrast: 120, saturation: 50, blur: 0, sepia: 40 })}
                      >
                        <Contrast className="h-4 w-4 mr-1" />
                        Dramático
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0 })}
                      >
                        <RotateCw className="h-4 w-4 mr-1" />
                        Original
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
