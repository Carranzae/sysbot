'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan,
  MousePointer2,
  Trash2,
  Sparkles,
  Eye,
  EyeOff,
  Layers,
  Zap,
  Wand2,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Target,
  Eraser,
  Brush,
  Move,
  Square,
  Circle,
  Triangle,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mask?: string; // Base64 mask for precise removal
  removed: boolean;
}

interface AIScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaFile: File | null;
  onMediaChange: (file: File | null) => void;
}

export function AIScanner({ open, onOpenChange, mediaFile, onMediaChange }: AIScannerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados del escáner
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [showMasks, setShowMasks] = useState(true);
  const [activeTab, setActiveTab] = useState<'scan' | 'remove' | 'enhance'>('scan');
  const [scanMode, setScanMode] = useState<'auto' | 'manual'>('auto');
  const [brushSize, setBrushSize] = useState(20);
  const [sensitivity, setSensitivity] = useState(0.7);
  const [originalMedia, setOriginalMedia] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  // Cargar media en el elemento correspondiente
  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setOriginalMedia(url);
      
      if (mediaFile.type.startsWith('video/')) {
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setTotalFrames(Math.floor(videoRef.current.duration * 30)); // 30fps
              setCurrentFrame(0);
            }
          };
        }
      } else {
        if (imageRef.current) {
          imageRef.current.src = url;
          imageRef.current.onload = () => {
            drawCanvas();
          };
        }
      }
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [mediaFile]);

  // Dibujar en canvas
  const drawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar media
    if (imageRef.current && mediaFile?.type.startsWith('image/')) {
      canvas.width = imageRef.current.naturalWidth;
      canvas.height = imageRef.current.naturalHeight;
      ctx.drawImage(imageRef.current, 0, 0);
    } else if (videoRef.current && mediaFile?.type.startsWith('video/')) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
    }

    // Dibujar máscaras de objetos detectados
    if (showMasks) {
      detectedObjects.forEach(obj => {
        if (!obj.removed) {
          // Dibujar bounding box
          ctx.strokeStyle = selectedObjectId === obj.id ? '#10b981' : '#3b82f6';
          ctx.lineWidth = 2;
          ctx.strokeRect(obj.bbox.x, obj.bbox.y, obj.bbox.width, obj.bbox.height);
          
          // Dibujar etiqueta
          ctx.fillStyle = selectedObjectId === obj.id ? '#10b981' : '#3b82f6';
          ctx.fillRect(obj.bbox.x, obj.bbox.y - 25, 120, 25);
          ctx.fillStyle = 'white';
          ctx.font = '12px sans-serif';
          ctx.fillText(`${obj.label} (${Math.round(obj.confidence * 100)}%)`, obj.bbox.x + 5, obj.bbox.y - 8);
          
          // Dibujar puntos de control
          if (selectedObjectId === obj.id) {
            ctx.fillStyle = '#10b981';
            const points = [
              { x: obj.bbox.x, y: obj.bbox.y },
              { x: obj.bbox.x + obj.bbox.width, y: obj.bbox.y },
              { x: obj.bbox.x, y: obj.bbox.y + obj.bbox.height },
              { x: obj.bbox.x + obj.bbox.width, y: obj.bbox.y + obj.bbox.height }
            ];
            points.forEach(point => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            });
          }
        }
      });
    }
  }, [detectedObjects, selectedObjectId, showMasks, mediaFile]);

  // Actualizar canvas cuando cambian los objetos
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Escaneo IA de objetos
  const scanObjects = async () => {
    if (!canvasRef.current || !mediaFile) return;
    
    setIsScanning(true);
    try {
      // Simular detección de objetos con IA
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Simular diferentes tipos de objetos detectados
      const mockObjects: DetectedObject[] = [
        {
          id: '1',
          label: 'Persona',
          confidence: 0.95,
          bbox: { x: 100, y: 50, width: 150, height: 300 },
          removed: false,
        },
        {
          id: '2',
          label: 'Coche',
          confidence: 0.88,
          bbox: { x: 300, y: 200, width: 200, height: 120 },
          removed: false,
        },
        {
          id: '3',
          label: 'Edificio',
          confidence: 0.92,
          bbox: { x: 50, y: 100, width: 80, height: 200 },
          removed: false,
        },
        {
          id: '4',
          label: 'Árbol',
          confidence: 0.85,
          bbox: { x: 450, y: 150, width: 100, height: 180 },
          removed: false,
        },
        {
          id: '5',
          label: 'Texto',
          confidence: 0.78,
          bbox: { x: 200, y: 350, width: 180, height: 40 },
          removed: false,
        }
      ];
      
      // Filtrar por sensibilidad
      const filteredObjects = mockObjects.filter(obj => obj.confidence >= sensitivity);
      setDetectedObjects(filteredObjects);
      
      toast({
        title: 'Escaneo Completado',
        description: `Se detectaron ${filteredObjects.length} objetos con ${Math.round(sensitivity * 100)}% de confianza mínima.`,
      });
    } catch (error) {
      toast({
        title: 'Error en Escaneo',
        description: 'No se pudo completar el escaneo de objetos.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Eliminar objeto con IA
  const removeObject = async (objectId: string) => {
    setIsProcessing(true);
    try {
      // Simular eliminación con IA
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setDetectedObjects(prev => 
        prev.map(obj => 
          obj.id === objectId ? { ...obj, removed: true } : obj
        )
      );
      
      toast({
        title: 'Objeto Eliminado',
        description: 'El objeto ha sido eliminado con IA inteligente.',
      });
      
      setSelectedObjectId(null);
    } catch (error) {
      toast({
        title: 'Error al Eliminar',
        description: 'No se pudo eliminar el objeto.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Eliminar todos los objetos seleccionados
  const removeAllSelected = async () => {
    const selectedObjects = detectedObjects.filter(obj => !obj.removed);
    if (selectedObjects.length === 0) return;
    
    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setDetectedObjects(prev => 
        prev.map(obj => ({ ...obj, removed: true }))
      );
      
      toast({
        title: 'Todos los Objetos Eliminados',
        description: `Se eliminaron ${selectedObjects.length} objetos automáticamente.`,
      });
    } catch (error) {
      toast({
        title: 'Error al Eliminar',
        description: 'No se pudieron eliminar todos los objetos.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Restaurar objeto
  const restoreObject = (objectId: string) => {
    setDetectedObjects(prev => 
      prev.map(obj => 
        obj.id === objectId ? { ...obj, removed: false } : obj
      )
    );
  };

  // Restaurar todos los objetos
  const restoreAll = () => {
    setDetectedObjects(prev => 
      prev.map(obj => ({ ...obj, removed: false }))
    );
  };

  // Manejar clic en canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Escalar coordenadas al tamaño real del canvas
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Verificar si se hizo clic en un objeto
    const clickedObject = detectedObjects.find(obj => {
      if (obj.removed) return false;
      return (
        canvasX >= obj.bbox.x &&
        canvasX <= obj.bbox.x + obj.bbox.width &&
        canvasY >= obj.bbox.y &&
        canvasY <= obj.bbox.y + obj.bbox.height
      );
    });
    
    if (clickedObject) {
      setSelectedObjectId(clickedObject.id);
      setActiveTab('remove');
    } else {
      setSelectedObjectId(null);
    }
  };

  // Exportar media editado
  const exportMedia = async () => {
    if (!canvasRef.current) return;
    
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        
        const exportFile = new File([blob], 'ai-edited-media.png', { type: 'image/png' });
        onMediaChange(exportFile);
        
        toast({
          title: 'Media Exportado',
          description: 'El archivo editado con IA ha sido exportado correctamente.',
        });
        
        onOpenChange(false);
      }, 'image/png');
    } catch (error) {
      toast({
        title: 'Error al Exportar',
        description: 'No se pudo exportar el archivo editado.',
        variant: 'destructive',
      });
    }
  };

  // Contar objetos
  const totalObjects = detectedObjects.length;
  const removedObjects = detectedObjects.filter(obj => obj.removed).length;
  const remainingObjects = totalObjects - removedObjects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="flex items-center justify-between p-6 border-b bg-white">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <Scan className="h-6 w-6 text-primary" />
            Escáner IA Inteligente
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Detecta y elimina objetos automáticamente con un solo clic.
          </DialogDescription>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {remainingObjects}/{totalObjects} objetos
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={exportMedia}
              className="bg-primary text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden">
          {/* Panel Izquierdo - Canvas y Preview */}
          <div className="lg:col-span-2 p-6 bg-slate-50 border-r">
            <div className="space-y-4">
              {/* Canvas principal */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                <img
                  ref={imageRef}
                  className="hidden"
                  onLoad={drawCanvas}
                />
                <video
                  ref={videoRef}
                  className="hidden"
                  onTimeUpdate={drawCanvas}
                />
                <canvas
                  ref={canvasRef}
                  className="w-full h-full max-h-96 object-contain cursor-crosshair"
                  onClick={handleCanvasClick}
                />
                
                {/* Overlay de información */}
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-3 text-white">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4" />
                    <span>Clic para seleccionar objeto</span>
                  </div>
                  {selectedObjectId && (
                    <div className="mt-2 text-xs text-green-400">
                      Objeto seleccionado
                    </div>
                  )}
                </div>
                
                {/* Indicador de escaneo */}
                {isScanning && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Escaneando con IA...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controles rápidos */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showMasks}
                    onCheckedChange={setShowMasks}
                  />
                  <Label className="text-sm">Mostrar detecciones</Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scanObjects}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scan className="h-4 w-4" />
                    )}
                    Escanear
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={restoreAll}
                    disabled={totalObjects === 0}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Panel Derecho - Herramientas */}
          <div className="p-6 bg-white overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-12 rounded-xl bg-slate-100 p-1 mb-6">
                <TabsTrigger value="scan" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                  <Scan className="h-4 w-4" />
                  Escanear
                </TabsTrigger>
                <TabsTrigger value="remove" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                  <Eraser className="h-4 w-4" />
                  Eliminar
                </TabsTrigger>
                <TabsTrigger value="enhance" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
                  <Sparkles className="h-4 w-4" />
                  Mejorar
                </TabsTrigger>
              </TabsList>

              {/* Tab de Escanear */}
              <TabsContent value="scan" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Modo de Escaneo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={scanMode === 'auto' ? 'default' : 'outline'}
                        onClick={() => setScanMode('auto')}
                        className="flex items-center gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Automático
                      </Button>
                      <Button
                        variant={scanMode === 'manual' ? 'default' : 'outline'}
                        onClick={() => setScanMode('manual')}
                        className="flex items-center gap-2"
                      >
                        <MousePointer2 className="h-4 w-4" />
                        Manual
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Sensibilidad de Detección</Label>
                    <div className="space-y-2">
                      <Slider
                        value={[sensitivity]}
                        onValueChange={([value]) => setSensitivity(value)}
                        min={0.1}
                        max={1}
                        step={0.1}
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Baja</span>
                        <span>{Math.round(sensitivity * 100)}%</span>
                        <span>Alta</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Tipos de Objetos</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {['Persona', 'Coche', 'Edificio', 'Árbol', 'Texto', 'Animal', 'Producto', 'Logotipo'].map(type => (
                        <div key={type} className="flex items-center justify-between p-2 rounded border">
                          <span className="text-sm">{type}</span>
                          <Switch />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={scanObjects}
                    disabled={isScanning || !mediaFile}
                    className="w-full"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Escaneando...
                      </>
                    ) : (
                      <>
                        <Scan className="h-4 w-4 mr-2" />
                        Iniciar Escaneo IA
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab de Eliminar */}
              <TabsContent value="remove" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Objetos Detectados</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {detectedObjects.map((obj) => (
                        <div
                          key={obj.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            selectedObjectId === obj.id
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-200 hover:border-slate-300'
                          } ${obj.removed ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              obj.removed ? 'bg-red-500' : 'bg-green-500'
                            }`} />
                            <div>
                              <div className="text-sm font-medium">{obj.label}</div>
                              <div className="text-xs text-slate-500">
                                {Math.round(obj.confidence * 100)}% confianza
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {obj.removed ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => restoreObject(obj.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeObject(obj.id)}
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={removeAllSelected}
                      disabled={remainingObjects === 0 || isProcessing}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Todos
                    </Button>
                    <Button
                      variant="outline"
                      onClick={restoreAll}
                      disabled={removedObjects === 0}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Restaurar Todos
                    </Button>
                  </div>

                  {selectedObjectId && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <Label className="text-sm font-medium text-slate-700 mb-2">Objeto Seleccionado</Label>
                      <div className="text-sm text-slate-600">
                        {detectedObjects.find(obj => obj.id === selectedObjectId)?.label}
                      </div>
                      <Button
                        className="w-full mt-2"
                        onClick={() => removeObject(selectedObjectId)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Eraser className="h-4 w-4 mr-2" />
                            Eliminar con IA
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab de Mejorar */}
              <TabsContent value="enhance" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Herramientas de Mejora</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4" />
                        Auto-mejorar
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Brush className="h-4 w-4" />
                        Rellenar fondo
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Reducir ruido
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Mejorar nitidez
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Tamaño de Pincel</Label>
                    <div className="space-y-2">
                      <Slider
                        value={[brushSize]}
                        onValueChange={([value]) => setBrushSize(value)}
                        min={5}
                        max={100}
                        step={5}
                      />
                      <div className="text-center text-sm text-slate-500">{brushSize}px</div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3">Opciones Avanzadas</Label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Preservar bordes</Label>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Suavizado inteligente</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Detección de texturas</Label>
                        <Switch defaultChecked />
                      </div>
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
