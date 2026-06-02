'use client';

import { 
  CalendarClock, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  BellRing, 
  ShieldCheck, 
  Globe, 
  BadgeCheck 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { SocialSettings } from '@/store/social';

interface SettingsPanelProps {
  settings: SocialSettings;
  onUpdate: (settings: Partial<SocialSettings>) => void;
  onSave: () => void;
  onGenerate: () => void;
  activeCount: number;
  totalCount: number;
  isSaving?: boolean;
  isRegenerating?: boolean;
  strategyScore?: number;
}

export function SettingsPanel({ 
  settings, 
  onUpdate, 
  onSave, 
  onGenerate, 
  activeCount, 
  totalCount,
  isSaving = false,
  isRegenerating = false,
  strategyScore = 85
}: SettingsPanelProps) {
  return (
    <Card className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-slate-900 tracking-tight uppercase">Reglas del Negocio</CardTitle>
            <CardDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Configura cómo y cuándo publicará la IA para este negocio.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3 px-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              Zona horaria
            </Label>
            <Select value={settings.timezone} onValueChange={(v) => onUpdate({ timezone: v })}>
              <SelectTrigger className="h-12 rounded-2xl border-slate-100 shadow-sm focus:ring-primary">
                <SelectValue placeholder="Selecciona zona horaria" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100">
                <SelectItem value="America/Bogota">America/Bogota</SelectItem>
                <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
                <SelectItem value="America/Lima">America/Lima</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 px-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Frecuencia
            </Label>
            <Select value={settings.frequency} onValueChange={(v) => onUpdate({ frequency: v as any })}>
              <SelectTrigger className="h-12 rounded-2xl border-slate-100 shadow-sm focus:ring-primary">
                <SelectValue placeholder="Selecciona frecuencia" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100">
                <SelectItem value="3_week">3 por semana (Recomendado)</SelectItem>
                <SelectItem value="1_day">1 por día</SelectItem>
                <SelectItem value="2_day">2 por día (Mañana + Noche)</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 px-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Ventana horaria inicio
            </Label>
            <Input 
              value={settings.allowedStart} 
              onChange={(e) => onUpdate({ allowedStart: e.target.value })}
              className="h-12 rounded-2xl border-slate-100 shadow-sm focus:ring-primary"
            />
          </div>

          <div className="space-y-3 px-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Ventana horaria fin
            </Label>
            <Input 
              value={settings.allowedEnd} 
              onChange={(e) => onUpdate({ allowedEnd: e.target.value })}
              className="h-12 rounded-2xl border-slate-100 shadow-sm focus:ring-primary"
            />
          </div>

          <div className="space-y-3 px-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Separación mínima (min)</Label>
            <Input 
              type="number"
              value={settings.minSpacingMinutes} 
              onChange={(e) => onUpdate({ minSpacingMinutes: parseInt(e.target.value) })}
              className="h-12 rounded-2xl border-slate-100 shadow-sm focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-slate-100 p-4 px-6 bg-slate-50/50">
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 leading-none">Escalonado inteligente</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1.5 leading-none">Evita saturar las redes</span>
            </div>
            <Switch checked={settings.stagger} onCheckedChange={(v) => onUpdate({ stagger: v })} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 pt-4">
          <div className="rounded-[2rem] border border-slate-100 p-6 bg-white shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                <BellRing className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Notificaciones</span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between group">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Email Pro</span>
                <Switch checked={settings.notifications.email} onCheckedChange={(v) => onUpdate({ notifications: { ...settings.notifications, email: v } })} />
              </div>
              <div className="flex items-center justify-between group">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">WhatsApp</span>
                <Switch checked={settings.notifications.whatsapp} onCheckedChange={(v) => onUpdate({ notifications: { ...settings.notifications, whatsapp: v } })} />
              </div>
              <div className="flex items-center justify-between group">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Push App</span>
                <Switch checked={settings.notifications.push} onCheckedChange={(v) => onUpdate({ notifications: { ...settings.notifications, push: v } })} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-[2.5rem] border border-primary/10 p-8 bg-gradient-to-br from-primary/[0.03] to-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="h-32 w-32 -mr-12 -mt-12" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between gap-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest text-slate-900">Estado Estratégico</span>
                  <div className="mt-3 flex items-center gap-3">
                    <Badge variant="outline" className="bg-white text-primary border-primary/10 text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                      {activeCount} Canales activos
                    </Badge>
                    <div className="flex items-center gap-1.5 ml-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-emerald-600 uppercase">{strategyScore}% Salud</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-6 border-primary/10 hover:bg-white disabled:opacity-50" 
                    onClick={onGenerate}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        Regenerar
                      </>
                    )}
                  </Button>
                  <Button 
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8 shadow-xl shadow-primary/20 hover:scale-105 transition-transform disabled:opacity-50" 
                    onClick={onSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                        Guardar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-auto">
                {settings.stagger ? '• Algoritmo de escalonado activo' : '• Escalonado desactivado'}
                <span className="mx-2 opacity-30">|</span>
                Frecuencia: {settings.frequency.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
