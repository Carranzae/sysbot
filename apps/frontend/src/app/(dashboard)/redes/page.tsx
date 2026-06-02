
 "use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useBusinessStore } from '@/store/business';
import { PlatformKey, SocialSettings, useSocialStore } from '@/store/social';
import { metaApi, oauthApi } from '@/lib/api';
import { ChannelCard } from '@/components/social/channel-card';
import { SettingsPanel } from '@/components/social/settings-panel';
import { CalendarPreview } from '@/components/social/calendar-preview';
import { ActivityPanel } from '@/components/social/activity-panel';
import { ComposerModal } from '@/components/social/composer-modal';
import ProEditor from '@/components/social/pro-editor';
import { McpConnector } from '@/components/social/mcp-connector';
import { PostHistory } from '@/components/social/post-history';

export default function RedesPage() {
  const { toast } = useToast();
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  const businessDataMap = useSocialStore((s) => s.businessData);
  const isLoading = useSocialStore((s) => s.isLoading);
  const error = useSocialStore((s) => s.error);
  const fetchBusinessData = useSocialStore((s) => s.fetchBusinessData);
  const setChannels = useSocialStore((s) => s.setChannels);
  const updateSettings = useSocialStore((s) => s.updateSettings);
  const searchParams = useSearchParams();

  const businessId = selectedBusiness?.id;
  const businessData = businessId ? businessDataMap[businessId] : undefined;
  const channels = businessData?.channels || [];
  const settings = businessData?.settings;

  const connectedParam = searchParams?.get('connected') || null;
  const callbackBusinessIdParam = searchParams?.get('businessId') || null;
  const metaSelectParam = searchParams?.get('metaSelect') || null;
  const metaSessionIdParam = searchParams?.get('sessionId') || null;
  const createParam = searchParams?.get('create') || null;

  const [composerOpen, setComposerOpen] = useState(false);
  const [proEditorOpen, setProEditorOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image' | 'other'>('video');
  const [connectOpen, setConnectOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [draftSettings, setDraftSettings] = useState<SocialSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Estado para REUTILIZAR COPIAS
  const [reuseCaption, setReuseCaption] = useState<string>('');
  const [reusePlatforms, setReusePlatforms] = useState<PlatformKey[]>([]);

  // Manejar cambio de archivo centralizado
  const handleMediaChange = (file: File | null) => {
    // Revocar URL anterior si existe para evitar fugas de memoria
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }

    if (file) {
      setMediaFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
      if (file.type.startsWith('video/')) setMediaType('video');
      else if (file.type.startsWith('image/')) setMediaType('image');
      else setMediaType('other');
    } else {
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType('video');
    }
  };

  const [metaSelectOpen, setMetaSelectOpen] = useState(false);
  const [metaSessionId, setMetaSessionId] = useState<string | null>(null);
  const [metaPages, setMetaPages] = useState<Array<{ id: string; name: string }>>([]);
  const [metaSelectedPageId, setMetaSelectedPageId] = useState<string>('');
  const [isMetaLoading, setIsMetaLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    fetchBusinessData(businessId);
  }, [businessId, fetchBusinessData]);

  useEffect(() => {
    if (!connectedParam && !callbackBusinessIdParam) return;

    if (callbackBusinessIdParam && selectedBusiness?.id && callbackBusinessIdParam !== selectedBusiness.id) {
      toast({
        title: 'Negocio diferente',
        description: 'La conexión OAuth se completó en otro negocio. Selecciona ese negocio para ver el estado.',
        variant: 'destructive',
      });
      return;
    }

    if (!businessId) return;

    fetchBusinessData(businessId).then(() => {
      if (connectedParam) {
        toast({
          title: 'Conexión actualizada',
          description: `Se actualizó el estado de ${connectedParam.toUpperCase()} para este negocio.`,
        });
      }
    });
  }, [connectedParam, callbackBusinessIdParam, businessId, selectedBusiness?.id, fetchBusinessData, toast]);

  useEffect(() => {
    if (!metaSelectParam || metaSelectParam !== '1' || !metaSessionIdParam) return;

    setIsMetaLoading(true);
    oauthApi
      .getMetaPages(metaSessionIdParam)
      .then((res) => {
        const pages = res.data?.pages || [];
        setMetaPages(pages);
        setMetaSessionId(metaSessionIdParam);
        setMetaSelectedPageId(pages?.[0]?.id || '');
        setMetaSelectOpen(true);
      })
      .catch((e: any) => {
        toast({
          title: 'Error cargando páginas',
          description: e?.response?.data?.message || e?.message || 'No se pudo obtener la lista de páginas.',
          variant: 'destructive',
        });
      })
      .finally(() => setIsMetaLoading(false));
  }, [metaSelectParam, metaSessionIdParam, toast]);

  // Cargar borrador si venimos desde Campañas/Recomendaciones
  useEffect(() => {
    if (createParam === 'true') {
      const draftCaption = sessionStorage.getItem('botSaaS_draftPost_caption');
      const draftPlatforms = sessionStorage.getItem('botSaaS_draftPost_platforms');
      
      if (draftCaption || draftPlatforms) {
        setReuseCaption(draftCaption || '');
        if (draftPlatforms) {
          try {
            setReusePlatforms(JSON.parse(draftPlatforms));
          } catch (e) {}
        }
        setComposerOpen(true);
        // Limpiar para evitar re-aperturas accidentales
        sessionStorage.removeItem('botSaaS_draftPost_caption');
        sessionStorage.removeItem('botSaaS_draftPost_platforms');
        
        // Limpiar URL
        const url = new URL(window.location.href);
        url.searchParams.delete('create');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [createParam]);

  const finalizeMetaSelection = async () => {
    if (!metaSessionId || !metaSelectedPageId) return;
    setIsMetaLoading(true);
    try {
      await oauthApi.selectMetaPage(metaSessionId, metaSelectedPageId);
      toast({
        title: 'Meta vinculada',
        description: 'Se guardó la página seleccionada y se actualizó el estado del canal.',
      });
      setMetaSelectOpen(false);
      await refreshNow();
    } catch (e: any) {
      toast({
        title: 'No se pudo vincular Meta',
        description: e?.response?.data?.message || e?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsMetaLoading(false);
    }
  };

  const refreshNow = async () => {
    if (!businessId) return;
    await fetchBusinessData(businessId);
  };

  useEffect(() => {
    if (!settings) return;
    setDraftSettings(settings);
  }, [settings]);

  const schedulePreview = useMemo(() => {
    if (!settings) return null;
    const base: Record<PlatformKey, { days: string[]; times: string[] }> = {
      tiktok: { days: ['Lun', 'Mié', 'Vie'], times: ['21:10', '21:40', '20:55'] },
      instagram: { days: ['Lun', 'Mié', 'Vie'], times: ['20:30', '13:10', '19:50'] },
      youtube: { days: ['Mar', 'Jue', 'Sáb'], times: ['19:50', '20:20', '18:40'] },
      facebook: { days: ['Mar', 'Jue', 'Dom'], times: ['20:10', '20:40', '19:20'] },
      linkedin: { days: ['Mar', 'Mié', 'Jue'], times: ['09:40', '12:10', '10:15'] },
    };

    if (settings.frequency === '1_day') {
      return Object.fromEntries(
        Object.entries(base).map(([k, v]) => [
          k,
          {
            days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            times: [v.times[0], '12:30', v.times[1], '18:20', v.times[2], '13:00', '19:10'],
          },
        ])
      ) as Record<PlatformKey, { days: string[]; times: string[] }>;
    }

    if (settings.frequency === '2_day') {
      return Object.fromEntries(
        Object.entries(base).map(([k, v]) => [
          k,
          {
            days: ['Lun', 'Lun', 'Mar', 'Mar', 'Mié', 'Mié'],
            times: [v.times[0], '08:45', v.times[1], '14:10', v.times[2], '20:35'],
          },
        ])
      ) as Record<PlatformKey, { days: string[]; times: string[] }>;
    }

    return base;
  }, [settings]);

  if (!selectedBusiness) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">Redes</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
            Conecta y gestiona la publicación en redes sociales.
          </p>
        </div>
        <div className="rounded-[2rem] border-2 border-dashed border-slate-100 p-12 text-center bg-white">
          <div className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Selecciona un negocio activo</div>
          <Link href="/businesses">
            <Button className="rounded-2xl font-black uppercase text-[11px] tracking-widest px-10 h-14">Ir a Negocios</Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeCount = channels.filter((c) => c.status !== 'disconnected').length;
  const strategyScore = Math.min(99, Math.max(70, 78 + activeCount * 4));

  const handleConnect = (platform: PlatformKey) => {
    setSelectedPlatform(platform);
    setConnectOpen(true);
  };

  const handleManage = (platform: PlatformKey) => {
    setSelectedPlatform(platform);
    setManageOpen(true);
  };

  const handleDisconnect = async (platform: PlatformKey) => {
    setIsDisconnecting(true);
    try {
      if (platform === 'facebook' || platform === 'instagram') {
        const payload =
          platform === 'facebook'
            ? { messengerAccessToken: null, messengerEnabled: false, messengerConnected: false }
            : { instagramAccessToken: null, instagramEnabled: false, instagramConnected: false };
        await metaApi.updateConnection(selectedBusiness.id, payload);
      }

      const updatedChannels = channels.map((c) =>
          c.key === platform ? { ...c, status: 'disconnected' as const, accountLabel: undefined, connectedAt: undefined } : c
      );
      await setChannels(selectedBusiness.id, updatedChannels);

      toast({
        title: 'Canal desconectado',
        description: `Se revocó la conexión de ${platform.toUpperCase()} para este negocio.`,
        variant: 'destructive',
      });
    } catch (e: any) {
      toast({
        title: 'Error al desconectar',
        description: e?.message || 'No se pudo desconectar el canal.',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const startOAuth = () => {
    if (!selectedPlatform) return;

    if (selectedPlatform !== 'facebook' && selectedPlatform !== 'instagram') {
      toast({
        title: 'OAuth no disponible para esta red',
        description: 'Por ahora el login oficial (AUTO) solo está implementado para Meta (Facebook/Instagram). Usa modo ASISTIDO para publicar sin API.',
        variant: 'destructive',
      });
      setConnectOpen(false);
      setManageOpen(false);
      return;
    }

    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const url = `${base}/oauth/${selectedPlatform}/start?businessId=${encodeURIComponent(selectedBusiness.id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast({
      title: 'Vinculación iniciada',
      description: 'Completa el login en la ventana oficial. Luego vuelve y recarga la página.',
    });
    setConnectOpen(false);
  };

  const saveSettings = async () => {
    if (!selectedBusiness || !draftSettings) return;
    setIsSavingSettings(true);
    try {
      await updateSettings(selectedBusiness.id, draftSettings);
      toast({ title: 'Reglas guardadas', description: 'Se sincronizaron con el backend.' });
    } catch (e: any) {
      toast({
        title: 'Error al guardar reglas',
        description: e?.message || 'No se pudieron guardar los cambios.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleReusePost = (post: any) => {
    setReuseCaption(post.caption || '');
    setReusePlatforms(post.targets?.map((t: any) => t.platform as PlatformKey) || []);
    setComposerOpen(true);
    toast({
      title: 'Contenido cargado',
      description: 'El copy y las redes se han cargado en el editor.',
    });
  };

  return (
    <div className="p-8 space-y-10">
      <Dialog open={metaSelectOpen} onOpenChange={setMetaSelectOpen}>
        <DialogContent className="max-w-lg rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-[12px]">Selecciona tu Página de Facebook</DialogTitle>
            <DialogDescription className="text-[12px]">
              Detectamos múltiples páginas. Elige cuál vincular para este negocio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Páginas disponibles</div>
            <div className="space-y-2">
              {metaPages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMetaSelectedPageId(p.id)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-[12px] font-bold transition ${
                    metaSelectedPageId === p.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-100 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-black uppercase tracking-widest text-[11px] text-slate-900">{p.name}</div>
                  <div className="text-[11px] text-slate-400">{p.id}</div>
                </button>
              ))}
            </div>
            <Button
              className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]"
              onClick={finalizeMetaSelection}
              disabled={isMetaLoading || !metaSelectedPageId}
            >
              {isMetaLoading ? 'Vinculando...' : 'Confirmar y vincular'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Redes Sociales</h1>
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/10 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
            >
              Pro
            </Badge>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
            Estrategia multi-red para <span className="text-primary font-black">{selectedBusiness.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.1em] px-8 h-14"
            onClick={() => setComposerOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2.5" />
            Nueva Publicación
          </Button>

          <Button
            variant="outline"
            className="rounded-2xl border-slate-100 font-black uppercase text-[10px] tracking-widest px-8 h-14 bg-white"
            onClick={refreshNow}
            disabled={isLoading || isMetaLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2.5 ${isLoading || isMetaLoading ? 'animate-spin' : ''}`} />
            Actualizar estado
          </Button>

          <Button
            variant="outline"
            className="rounded-2xl border-slate-100 font-black uppercase text-[10px] tracking-widest px-8 h-14 bg-white"
            onClick={() => setMcpOpen(true)}
          >
            <Bot className="h-4 w-4 mr-2.5" />
            Conectar IA (MCP)
          </Button>
        </div>
      </div>

      {!!error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-black uppercase tracking-widest text-[11px]">Error de sincronización</AlertTitle>
          <AlertDescription className="text-[12px]">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && channels.length === 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-[130px] rounded-3xl border border-slate-100 bg-white animate-pulse" />
          <div className="h-[130px] rounded-3xl border border-slate-100 bg-white animate-pulse" />
          <div className="h-[130px] rounded-3xl border border-slate-100 bg-white animate-pulse" />
          <div className="h-[130px] rounded-3xl border border-slate-100 bg-white animate-pulse" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {channels.map((c) => (
              <ChannelCard key={c.key} channel={c} onConnect={handleConnect} onDisconnect={handleDisconnect} onConfigureSettings={handleManage} />
            ))}
          </div>

          {draftSettings && (
            <SettingsPanel
              settings={draftSettings}
              onUpdate={(newSettings) => setDraftSettings((prev) => (prev ? { ...prev, ...newSettings } : prev))}
              onSave={saveSettings}
              onGenerate={() => toast({ title: 'Regenerado', description: 'El algoritmo recalculó la estrategia.' })}
              activeCount={activeCount}
              totalCount={channels.length}
              isSaving={isSavingSettings}
              isRegenerating={false}
              strategyScore={strategyScore}
            />
          )}
        </div>

        <div className="space-y-10">
          {settings && schedulePreview && (
            <CalendarPreview channels={channels} frequency={settings.frequency} schedulePreview={schedulePreview} />
          )}
          {businessId && <PostHistory businessId={businessId} onReuse={handleReusePost} />}
          <ActivityPanel channels={channels} />
        </div>
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-10">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight uppercase">
              Conectar {selectedPlatform?.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">
              Se abrirá el login oficial. No pedimos ni guardamos tu contraseña.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]" onClick={startOAuth}>
              Abrir login oficial
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]"
              onClick={() => setConnectOpen(false)}
              disabled={isDisconnecting}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-10">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight uppercase">
              Gestionar {selectedPlatform?.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">
              Revisa estado, reconecta o desconecta de forma segura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]" onClick={startOAuth}>
              Reconectar (login oficial)
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]"
              onClick={refreshNow}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar estado
            </Button>
            <Button
              variant="destructive"
              className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]"
              onClick={() => (selectedPlatform ? handleDisconnect(selectedPlatform) : undefined)}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.1em]"
              onClick={() => setManageOpen(false)}
              disabled={isDisconnecting}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ComposerModal
        open={composerOpen}
        onOpenChange={setComposerOpen}
        businessName={selectedBusiness.name}
        industryType={selectedBusiness.industryType}
        channels={channels}
        selectedBusiness={selectedBusiness}
        mediaFile={mediaFile}
        mediaPreview={mediaPreview}
        mediaType={mediaType}
        onMediaChange={handleMediaChange}
        onOpenEditor={() => {
          setProEditorOpen(true);
          setComposerOpen(false);
        }}
        initialCaption={reuseCaption}
        initialPlatforms={reusePlatforms}
      />

      <ProEditor
        open={proEditorOpen}
        onOpenChange={(isOpen) => {
          setProEditorOpen(isOpen);
          if (!isOpen) {
            setComposerOpen(true);
          }
        }}
        businessId={selectedBusiness.id}
        mediaFile={mediaFile}
        onMediaChange={handleMediaChange}
      />

      <McpConnector
        open={mcpOpen}
        onOpenChange={setMcpOpen}
        businessId={selectedBusiness.id}
        businessName={selectedBusiness.name}
      />
    </div>
  );
}
