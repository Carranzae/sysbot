'use client';

import { 
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Radio,
  Sparkles,
  Clock,
  ChevronRight,
  Activity,
  Share2,
} from 'lucide-react';

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const PlatformIcon = ({ platform, className }: { platform: string, className?: string }) => {
  switch (platform) {
    case 'instagram': return <Instagram className={className} />;
    case 'tiktok': return <TikTokIcon className={className} />;
    case 'youtube': return <Youtube className={className} />;
    case 'facebook': return <Facebook className={className} />;
    case 'reddit': return <Share2 className={className} />;
    case 'linkedin': return <Linkedin className={className} />;
    default: return <Radio className={className} />;
  }
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SocialChannel, PlatformKey } from '@/store/social';

interface CalendarPreviewProps {
  channels: SocialChannel[];
  frequency: string;
  schedulePreview: Record<PlatformKey, { days: string[]; times: string[] }>;
}

export function CalendarPreview({ channels, frequency, schedulePreview }: CalendarPreviewProps) {
  const platforms: PlatformKey[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'];

  return (
    <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-100 bg-white overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-slate-900 tracking-tight uppercase">Planificación Inteligente</CardTitle>
            <CardDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Vista previa de slots sugeridos por el algoritmo de IA.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-6">
        <Tabs defaultValue="instagram" className="w-full">
          <TabsList className="grid grid-cols-5 h-12 rounded-2xl bg-slate-50 p-1 mb-6 border border-slate-100/50">
            <TabsTrigger value="instagram" className="rounded-xl font-black text-[9px] uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 px-1">IG</TabsTrigger>
            <TabsTrigger value="tiktok" className="rounded-xl font-black text-[9px] uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 px-1">TikTok</TabsTrigger>
            <TabsTrigger value="youtube" className="rounded-xl font-black text-[9px] uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 px-1">YT</TabsTrigger>
            <TabsTrigger value="facebook" className="rounded-xl font-black text-[9px] uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 px-1">FB</TabsTrigger>
            <TabsTrigger value="linkedin" className="rounded-xl font-black text-[9px] uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 px-1">IN</TabsTrigger>
          </TabsList>

          {platforms.map((k) => {
            const info = schedulePreview[k];
            const channel = channels.find((c) => c.key === k);
            
            if (!info || !info.days) return null;

            return (
              <TabsContent key={k} value={k} className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{channel?.title} Slots</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Próximas 72 horas</span>
                  </div>
                  <Badge variant="outline" className="bg-primary/[0.03] text-primary border-primary/10 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                    {frequency === '3_week' ? '3/semana' : frequency === '1_day' ? '1/día' : frequency === '2_day' ? '2/día' : 'Custom'}
                  </Badge>
                </div>
                
                <div className="space-y-2.5">
                  {info.days.map((d, idx) => (
                    <div key={`${d}-${idx}`} className="group flex items-center justify-between rounded-2xl border border-slate-100 p-4 bg-white hover:border-primary/20 hover:shadow-lg hover:shadow-slate-50 transition-all duration-300 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                          <PlatformIcon platform={k} className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-primary transition-colors">{d}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1 group-hover:text-slate-500">Horario de alto tráfico</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-xl shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform">
                          <Clock className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-black text-white tracking-wider">{info.times[idx]}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 mt-6 relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <Activity className="h-12 w-12" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-wider relative z-10">
                    Basado en benchmarks globales + reglas del negocio. El algoritmo se auto-ajustará con datos reales de tu audiencia tras las primeras 5 publicaciones.
                  </p>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
