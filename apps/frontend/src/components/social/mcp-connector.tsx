'use client';

import { useState } from 'react';
import { 
  Bot, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Zap,
  Shield,
  Clock,
  Settings
} from 'lucide-react';
import { PlatformSelector } from './platform-selector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface McpConnectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  businessName: string;
}

export function McpConnector({ open, onOpenChange, businessId, businessName }: McpConnectorProps) {
  const { toast } = useToast();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const [connectionCode, setConnectionCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('chatgpt');
  const [platformSelectorOpen, setPlatformSelectorOpen] = useState(false);

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${apiBase}/mcp/generate-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          businessId,
          expiresIn: 3600, // 1 hora
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConnectionCode(data.code);
        setExpiresAt(new Date(data.expiresAt));
        
        const platformNames = {
          chatgpt: 'ChatGPT',
          claude: 'Claude',
          gemini: 'Gemini',
          copilot: 'Microsoft Copilot',
          perplexity: 'Perplexity',
          custom: 'Personalizado'
        };
        
        toast({
          title: 'Código MCP Generado',
          description: `Copia este código y pégalo en ${platformNames[selectedPlatform as keyof typeof platformNames]} para conectar.`,
        });
      } else {
        throw new Error('Error generando código');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el código MCP.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!connectionCode) return;
    
    try {
      await navigator.clipboard.writeText(connectionCode);
      toast({
        title: 'Copiado',
        description: 'Código copiado al portapapeles.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el código.',
        variant: 'destructive',
      });
    }
  };

  const openAIPlatform = (platform: string) => {
    const platformUrls = {
      chatgpt: 'https://chat.openai.com/',
      claude: 'https://claude.ai/',
      gemini: 'https://gemini.google.com/',
      copilot: 'https://copilot.microsoft.com/',
      perplexity: 'https://www.perplexity.ai/',
      custom: 'https://chat.openai.com/'
    };
    
    const url = platformUrls[platform as keyof typeof platformUrls] || platformUrls.chatgpt;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minutos`;
  };

  return (
    <>
      <PlatformSelector 
        open={platformSelectorOpen} 
        onOpenChange={setPlatformSelectorOpen}
        onPlatformSelect={setSelectedPlatform}
      />
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight uppercase">
              <Bot className="h-8 w-8 text-primary" />
              Conectar IA Externa (MCP)
            </DialogTitle>
            <DialogDescription className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">
              Conecta {selectedPlatform === 'chatgpt' ? 'ChatGPT' : 
                       selectedPlatform === 'claude' ? 'Claude' :
                       selectedPlatform === 'gemini' ? 'Gemini' :
                       selectedPlatform === 'copilot' ? 'Microsoft Copilot' :
                       selectedPlatform === 'perplexity' ? 'Perplexity' : 'cualquier IA'} directamente con tus publicaciones
            </DialogDescription>
          </DialogHeader>

        <div className="space-y-6">
          {/* Alerta Informativa */}
          <Alert className="rounded-2xl border-primary/20 bg-primary/5">
            <Shield className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Conexión Segura:</strong> Usa códigos temporales de un solo uso. 
              La IA solo podrá modificar publicaciones de <span className="font-black text-primary">{businessName}</span>.
            </AlertDescription>
          </Alert>

          {!connectionCode ? (
            <div className="text-center space-y-6">
              <div className="space-y-3">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto shadow-2xl">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Conexión MCP</h3>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Model Context Protocol
                  </p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 space-y-4">
                <div className="text-sm font-medium text-slate-700 space-y-2">
                  <p>🤖 <strong>¿Qué es MCP?</strong></p>
                  <p className="text-xs text-slate-600">
                    Permite que ChatGPT u otras IAs se conecten directamente a tu sistema de publicaciones 
                    y modifiquen contenido en tiempo real.
                  </p>
                </div>

                <div className="text-sm font-medium text-slate-700 space-y-2">
                  <p>🔗 <strong>¿Cómo funciona?</strong></p>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                    <li>Generas un código único aquí</li>
                    <li>Copias el código y lo pegas en ChatGPT</li>
                    <li>ChatGPT se conecta y puede modificar tus publicaciones</li>
                    <li>El código expira en 1 hora por seguridad</li>
                  </ol>
                </div>
              </div>

              <Button
                className="w-full h-16 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em] bg-primary text-white shadow-2xl hover:scale-[1.02] transition-all duration-300"
                onClick={generateCode}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generando código...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Generar Código de Conexión
                  </div>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Código Generado */}
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-black uppercase tracking-widest">
                    Código Activo
                  </Badge>
                  {expiresAt && (
                    <Badge variant="outline" className="text-xs font-black uppercase tracking-widest">
                      <Clock className="h-3 w-3 mr-1" />
                      Expira en {formatTimeRemaining(expiresAt)}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">Tu Código MCP</p>
                  <div className="relative">
                    <div className="bg-slate-900 text-primary font-mono text-2xl font-black tracking-widest rounded-2xl p-6 select-all">
                      {connectionCode}
                    </div>
                    <Button
                      size="sm"
                      className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary text-white shadow-lg hover:scale-110 transition-transform"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Instrucciones */}
              <div className="rounded-[2rem] border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-primary/0 p-6 space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-primary">Instrucciones de Conexión</h4>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">Abre ChatGPT</p>
                      <p className="text-xs text-slate-600">Haz clic en el botón de abajo para abrir ChatGPT</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">Pega el código</p>
                      <p className="text-xs text-slate-600">Copia y pega: <code className="bg-slate-100 px-2 py-1 rounded text-xs">{connectionCode}</code></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">Envía tu prompt</p>
                      <p className="text-xs text-slate-600">Ej: &quot;Mejora este caption para Instagram y TikTok: [tu texto]&quot;</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="rounded-2xl border-slate-100 font-black uppercase text-[10px] tracking-widest px-8 h-14 bg-white"
                  onClick={() => setPlatformSelectorOpen(true)}
                >
                  <Settings className="h-4 w-4 mr-2.5" />
                  Conectar IA (MCP)
                </Button>

                <Button
                  className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-gradient-to-r from-primary to-primary/80"
                  onClick={() => {
                    setConnectionCode(null);
                    setSessionId(null);
                    setExpiresAt(null);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generar Nuevo
                </Button>
                <Button
                  className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-gradient-to-r from-primary to-primary/80"
                  onClick={() => openAIPlatform('chatgpt')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir ChatGPT
                </Button>
              </div>

              {/* Ejemplo de Prompt */}
              <Alert className="rounded-2xl border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <strong>Ejemplo de prompt para ChatGPT:</strong><br/>
                  <code className="text-xs bg-white px-2 py-1 rounded mt-1 block">
                    Código MCP: {connectionCode}<br/>
                    Modifica el caption para que sea más viral en Instagram y TikTok. 
                    Añade hashtags trending y un CTA potente.
                  </code>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
