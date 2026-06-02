'use client';

import { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Brain, 
  Zap, 
  Search,
  Settings,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PlatformSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlatformSelect: (platform: string) => void;
}

const platforms = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'IA conversacional creativa y versátil',
    icon: Bot,
    color: 'bg-emerald-500',
    url: 'https://chat.openai.com/',
    capabilities: ['Generación de contenido', 'Análisis de tendencias', 'Optimización de hashtags'],
    bestFor: 'Creatividad y virality'
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'IA analítica con razonamiento profundo',
    icon: Brain,
    color: 'bg-orange-500',
    url: 'https://claude.ai/',
    capabilities: ['Análisis profundo', 'Razonamiento complejo', 'Contenido educativo'],
    bestFor: 'Análisis detallado y estrategia'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'IA multimodal con capacidades visuales',
    icon: Sparkles,
    color: 'bg-blue-500',
    url: 'https://gemini.google.com/',
    capabilities: ['Generación multimedia', 'Análisis visual', 'Tendencias visuales'],
    bestFor: 'Contenido visual y multimedia'
  },
  {
    id: 'copilot',
    name: 'Microsoft Copilot',
    description: 'IA integrada con ecosistema Microsoft',
    icon: Zap,
    color: 'bg-indigo-500',
    url: 'https://copilot.microsoft.com/',
    capabilities: ['Integración Microsoft', 'Productividad', 'Contenido B2B'],
    bestFor: 'Entornos corporativos y productividad'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'IA con búsqueda en tiempo real',
    icon: Search,
    color: 'bg-purple-500',
    url: 'https://www.perplexity.ai/',
    capabilities: ['Búsqueda en tiempo real', 'Tendencias actuales', 'Datos frescos'],
    bestFor: 'Información actualizada y tendencias'
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Configuración personalizada para cualquier IA',
    icon: Settings,
    color: 'bg-slate-500',
    url: '',
    capabilities: ['Personalización completa', 'Adaptación total'],
    bestFor: 'Casos especiales y personalización'
  }
];

export function PlatformSelector({ open, onOpenChange, onPlatformSelect }: PlatformSelectorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const handlePlatformSelect = (platform: typeof platforms[0]) => {
    setSelectedPlatform(platform.id);
    onPlatformSelect(platform.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-8 max-h-[80vh] overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight uppercase">
            <Settings className="h-8 w-8 text-primary" />
            Selecciona Plataforma IA
          </DialogTitle>
          <DialogDescription className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">
            Elige qué IA quieres conectar con tus redes sociales
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const isSelected = selectedPlatform === platform.id;
            
            return (
              <div
                key={platform.id}
                className={`relative group cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-lg scale-[1.02]' 
                    : 'border-slate-200 bg-white hover:border-primary/30 hover:shadow-md hover:scale-[1.01]'
                }`}
                onClick={() => handlePlatformSelect(platform)}
              >
                {/* Indicador de Selección */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`h-12 w-12 rounded-xl ${platform.color} flex items-center justify-center shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      {platform.name}
                    </h3>
                    <Badge 
                      className={`text-xs font-black uppercase tracking-widest mt-1 ${
                        platform.id === 'chatgpt' ? 'bg-emerald-100 text-emerald-700' :
                        platform.id === 'claude' ? 'bg-orange-100 text-orange-700' :
                        platform.id === 'gemini' ? 'bg-blue-100 text-blue-700' :
                        platform.id === 'copilot' ? 'bg-indigo-100 text-indigo-700' :
                        platform.id === 'perplexity' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {platform.bestFor}
                    </Badge>
                  </div>
                </div>

                {/* Descripción */}
                <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
                  {platform.description}
                </p>

                {/* Capacidades */}
                <div className="space-y-3 mb-4">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Capacidades Principales:
                  </div>
                  <div className="space-y-2">
                    {platform.capabilities.map((capability, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-xs text-slate-700 font-medium">{capability}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-slate-500 font-medium">Disponible</span>
                  </div>
                  
                  {platform.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl text-xs font-black uppercase tracking-widest border-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(platform.url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Abrir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-primary/0 border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm">
              <h4 className="font-black text-slate-900 mb-2">¿Cómo funciona?</h4>
              <ol className="space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="font-black text-primary">1.</span>
                  <span>Selecciona tu IA preferida</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-black text-primary">2.</span>
                  <span>Genera el código MCP único</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-black text-primary">3.</span>
                  <span>Copia y pega el código en la IA seleccionada</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-black text-primary">4.</span>
                  <span>Envía prompts y observa la magia</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
