'use client';

import { 
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Radio, 
  BadgeCheck, 
  ExternalLink, 
  Unplug, 
  AlertTriangle,
  Settings2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SocialChannel, ChannelMode, ChannelStatus, PlatformKey } from '@/store/social';

// Custom TikTok Icon SVG
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const PlatformIcon = ({ platform, className }: { platform: string, className?: string }) => {
  switch (platform) {
    case 'instagram': return <Instagram className={className} />;
    case 'tiktok': return <TikTokIcon className={className} />;
    case 'youtube': return <Youtube className={className} />;
    case 'facebook': return <Facebook className={className} />;
    case 'linkedin': return <Linkedin className={className} />;
    default: return <Radio className={className} />;
  }
};

interface ChannelCardProps {
  channel: SocialChannel;
  onConnect: (platform: PlatformKey) => void;
  onDisconnect: (platform: PlatformKey) => void;
  onConfigureSettings: (platform: PlatformKey) => void;
}

function modeBadgeClass(mode: ChannelMode) {
  if (mode === 'AUTO') return 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50';
  if (mode === 'ASISTIDO') return 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-50';
  return 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-50';
}

function statusBadge(status: ChannelStatus) {
  if (status === 'connected') {
    return { label: 'Conectado', className: 'bg-emerald-500 text-white border-none hover:bg-emerald-600' };
  }
  if (status === 'needs_action') {
    return { label: 'Acción requerida', className: 'bg-amber-500 text-white border-none hover:bg-amber-600' };
  }
  return { label: 'Desconectado', className: 'bg-slate-100 text-slate-400 border-none hover:bg-slate-200' };
}

export function ChannelCard({ channel, onConnect, onDisconnect, onConfigureSettings }: ChannelCardProps) {
  const st = statusBadge(channel.status);
  
  return (
    <div className="group relative rounded-3xl border border-slate-100 bg-white p-5 transition-all duration-300 hover:shadow-xl hover:shadow-slate-100 hover:border-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            channel.status === 'connected' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-50 text-slate-400'
          }`}>
            <PlatformIcon platform={channel.key} className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-900 tracking-tight">{channel.title}</span>
              {channel.status === 'connected' && <BadgeCheck className="h-4 w-4 text-primary" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border shadow-sm ${st.className}`}>
                {st.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border shadow-sm ${modeBadgeClass(channel.mode)}`}>
                {channel.mode}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {channel.status === 'connected' || channel.status === 'needs_action' ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 rounded-xl border-slate-100 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50"
                onClick={() => onConfigureSettings(channel.key)}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                Gestionar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 rounded-xl text-slate-300 hover:text-destructive hover:bg-destructive/5 transition-colors"
                onClick={() => onDisconnect(channel.key)}
              >
                <Unplug className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 rounded-xl border-primary/20 text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
              onClick={() => onConnect(channel.key)}
            >
              Conectar
            </Button>
          )}
        </div>
      </div>

      {channel.accountLabel && (
        <div className="mt-4 flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100/50">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">Activo: {channel.accountLabel}</span>
          </div>
          <ExternalLink className="h-3 w-3 text-slate-300" />
        </div>
      )}

      {channel.status === 'needs_action' && (
        <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-100/50 space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Atención requerida</span>
          </div>
          <p className="text-[10px] text-amber-700/70 font-medium leading-relaxed">
            Este canal está en modo asistido. Debes autorizar cada post manualmente mediante la app.
          </p>
        </div>
      )}
    </div>
  );
}
