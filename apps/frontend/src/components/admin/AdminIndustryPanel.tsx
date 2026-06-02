'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Users,
  MessageSquare,
  Phone,
  Volume2,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Power,
  PowerOff,
  RefreshCw
} from 'lucide-react';

interface Industry {
  type: string;
  name: string;
  icon: React.ReactNode;
  businesses: Business[];
  stats: {
    total: number;
    withAudio: number;
    withAutoReply: number;
    withWhatsApp: number;
    withCalls: number;
  };
}

interface Business {
  id: string;
  name: string;
  isActive: boolean;
  botConfig: {
    audioEnabled: boolean;
    autoReply: boolean;
    whatsappWebEnabled: boolean;
    callEnabled: boolean;
  };
}

interface AdminIndustryPanelProps {
  onRefresh?: () => void;
}

export function AdminIndustryPanel({ onRefresh }: AdminIndustryPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  // Mapeo de industrias a nombres amigables
  const industryNames: Record<string, string> = {
    'RESTAURANT': 'Restaurantes',
    'CLINIC': 'Clínicas',
    'REAL_ESTATE': 'Inmobiliarias',
    'ACADEMY': 'Academias',
    'RETAIL': 'Retail',
    'SERVICES': 'Servicios',
    'OTHER': 'Otros'
  };

  // Iconos por industria
  const industryIcons: Record<string, React.ReactNode> = {
    'RESTAURANT': <Building2 className="h-5 w-5" />,
    'CLINIC': <Users className="h-5 w-5" />,
    'REAL_ESTATE': <Building2 className="h-5 w-5" />,
    'ACADEMY': <Users className="h-5 w-5" />,
    'RETAIL': <Building2 className="h-5 w-5" />,
    'SERVICES': <Settings className="h-5 w-5" />,
    'OTHER': <Building2 className="h-5 w-5" />
  };

  // Cargar datos de industrias
  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      
      // Simulación de datos - en producción vendría de la API
      const mockIndustries: Industry[] = [
        {
          type: 'RESTAURANT',
          name: 'Restaurantes',
          icon: industryIcons['RESTAURANT'],
          businesses: [
            {
              id: '1',
              name: 'Restaurante Central',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        },
        {
          type: 'CLINIC',
          name: 'Clínicas',
          icon: industryIcons['CLINIC'],
          businesses: [
            {
              id: '2',
              name: 'Clínica Salud',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        },
        {
          type: 'REAL_ESTATE',
          name: 'Inmobiliarias',
          icon: industryIcons['REAL_ESTATE'],
          businesses: [
            {
              id: '3',
              name: 'Inmobiliaria Casa',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        },
        {
          type: 'ACADEMY',
          name: 'Academias',
          icon: industryIcons['ACADEMY'],
          businesses: [
            {
              id: '4',
              name: 'Academia Estudios',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        },
        {
          type: 'RETAIL',
          name: 'Retail',
          icon: industryIcons['RETAIL'],
          businesses: [
            {
              id: '5',
              name: 'Tienda Central',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        },
        {
          type: 'SERVICES',
          name: 'Servicios',
          icon: industryIcons['SERVICES'],
          businesses: [
            {
              id: '6',
              name: 'Servicios Profesionales',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        },
        {
          type: 'OTHER',
          name: 'Otros',
          icon: industryIcons['OTHER'],
          businesses: [
            {
              id: '7',
              name: 'Negocio General',
              isActive: true,
              botConfig: {
                audioEnabled: true,
                autoReply: true,
                whatsappWebEnabled: true,
                callEnabled: false
              }
            }
          ],
          stats: {
            total: 1,
            withAudio: 1,
            withAutoReply: 1,
            withWhatsApp: 1,
            withCalls: 0
          }
        }
      ];

      setIndustries(mockIndustries);
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las industrias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para activar/desactivar audio para toda una industria
  const toggleIndustryAudio = async (industryType: string, enabled: boolean) => {
    try {
      setUpdating(industryType);
      
      // Llamar a la API para actualizar todos los negocios de la industria
      const response = await fetch(`/api/admin/industries/${industryType}/audio`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioEnabled: enabled }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar audio');
      }

      // Actualizar estado local
      setIndustries(prev => prev.map(industry => {
        if (industry.type === industryType) {
          return {
            ...industry,
            businesses: industry.businesses.map(business => ({
              ...business,
              botConfig: {
                ...business.botConfig,
                audioEnabled: enabled
              }
            })),
            stats: {
              ...industry.stats,
              withAudio: enabled ? industry.stats.total : 0
            }
          };
        }
        return industry;
      }));

      toast({
        title: 'Éxito',
        description: `Audio ${enabled ? 'activado' : 'desactivado'} para ${industryNames[industryType]}`,
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el audio',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Función para activar/desactivar llamadas para toda una industria
  const toggleIndustryCalls = async (industryType: string, enabled: boolean) => {
    try {
      setUpdating(industryType);
      
      // Llamar a la API para actualizar todos los negocios de la industria
      const response = await fetch(`/api/admin/industries/${industryType}/calls`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callEnabled: enabled }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar llamadas');
      }

      // Actualizar estado local
      setIndustries(prev => prev.map(industry => {
        if (industry.type === industryType) {
          return {
            ...industry,
            businesses: industry.businesses.map(business => ({
              ...business,
              botConfig: {
                ...business.botConfig,
                callEnabled: enabled
              }
            })),
            stats: {
              ...industry.stats,
              withCalls: enabled ? industry.stats.total : 0
            }
          };
        }
        return industry;
      }));

      toast({
        title: 'Éxito',
        description: `Llamadas ${enabled ? 'activadas' : 'desactivadas'} para ${industryNames[industryType]}`,
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar las llamadas',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Función para activar/desactivar auto-reply para toda una industria
  const toggleIndustryAutoReply = async (industryType: string, enabled: boolean) => {
    try {
      setUpdating(industryType);
      
      // Llamar a la API para actualizar todos los negocios de la industria
      const response = await fetch(`/api/admin/industries/${industryType}/autoreply`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoReply: enabled }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar auto-reply');
      }

      // Actualizar estado local
      setIndustries(prev => prev.map(industry => {
        if (industry.type === industryType) {
          return {
            ...industry,
            businesses: industry.businesses.map(business => ({
              ...business,
              botConfig: {
                ...business.botConfig,
                autoReply: enabled
              }
            })),
            stats: {
              ...industry.stats,
              withAutoReply: enabled ? industry.stats.total : 0
            }
          };
        }
        return industry;
      }));

      toast({
        title: 'Éxito',
        description: `Auto-reply ${enabled ? 'activado' : 'desactivado'} para ${industryNames[industryType]}`,
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el auto-reply',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Función para activar/desactivar WhatsApp para toda una industria
  const toggleIndustryWhatsApp = async (industryType: string, enabled: boolean) => {
    try {
      setUpdating(industryType);
      
      // Llamar a la API para actualizar todos los negocios de la industria
      const response = await fetch(`/api/admin/industries/${industryType}/whatsapp`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ whatsappEnabled: enabled }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar WhatsApp');
      }

      // Actualizar estado local
      setIndustries(prev => prev.map(industry => {
        if (industry.type === industryType) {
          return {
            ...industry,
            businesses: industry.businesses.map(business => ({
              ...business,
              botConfig: {
                ...business.botConfig,
                whatsappWebEnabled: enabled
              }
            })),
            stats: {
              ...industry.stats,
              withWhatsApp: enabled ? industry.stats.total : 0
            }
          };
        }
        return industry;
      }));

      toast({
        title: 'Éxito',
        description: `WhatsApp ${enabled ? 'activado' : 'desactivado'} para ${industryNames[industryType]}`,
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar WhatsApp',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Panel de Industrias</h2>
          <p className="text-muted-foreground">
            Administra servicios por rubro - activa/desactiva audio, llamadas y más para todas las empresas de una categoría
          </p>
        </div>
        <Button onClick={loadIndustries} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Resumen General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Resumen General
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{industries.length}</div>
              <div className="text-sm text-muted-foreground">Industrias</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {industries.reduce((sum, ind) => sum + ind.stats.total, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Negocios Totales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {industries.reduce((sum, ind) => sum + ind.stats.withAudio, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Con Audio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {industries.reduce((sum, ind) => sum + ind.stats.withCalls, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Con Llamadas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de Industrias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {industries.map((industry) => (
          <Card key={industry.type} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {industry.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{industry.name}</CardTitle>
                    <CardDescription>
                      {industry.stats.total} negocios en esta categoría
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={industry.stats.total === industry.stats.withAudio ? 'default' : 'secondary'}>
                  {industry.stats.withAudio === industry.stats.total ? 'Completo' : 'Parcial'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estadísticas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-blue-600" />
                  <span>Audio: {industry.stats.withAudio}/{industry.stats.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-600" />
                  <span>Llamadas: {industry.stats.withCalls}/{industry.stats.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <span>Auto-reply: {industry.stats.withAutoReply}/{industry.stats.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-600" />
                  <span>WhatsApp: {industry.stats.withWhatsApp}/{industry.stats.total}</span>
                </div>
              </div>

              <Separator />

              {/* Controles de Activación Masiva */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Activar para toda la industria:</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    <span className="text-sm">Respuestas de Audio</span>
                  </div>
                  <Switch
                    checked={industry.stats.withAudio === industry.stats.total}
                    onCheckedChange={(enabled) => toggleIndustryAudio(industry.type, enabled)}
                    disabled={updating === industry.type}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">Llamadas Telefónicas</span>
                  </div>
                  <Switch
                    checked={industry.stats.withCalls === industry.stats.total}
                    onCheckedChange={(enabled) => toggleIndustryCalls(industry.type, enabled)}
                    disabled={updating === industry.type}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">Respuestas Automáticas</span>
                  </div>
                  <Switch
                    checked={industry.stats.withAutoReply === industry.stats.total}
                    onCheckedChange={(enabled) => toggleIndustryAutoReply(industry.type, enabled)}
                    disabled={updating === industry.type}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="text-sm">Integración WhatsApp</span>
                  </div>
                  <Switch
                    checked={industry.stats.withWhatsApp === industry.stats.total}
                    onCheckedChange={(enabled) => toggleIndustryWhatsApp(industry.type, enabled)}
                    disabled={updating === industry.type}
                  />
                </div>
              </div>

              {/* Estado de actualización */}
              {updating === industry.type && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Actualizando...</span>
                </div>
              )}

              {/* Lista de negocios */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Negocios en esta industria:</Label>
                <div className="space-y-1">
                  {industry.businesses.map((business) => (
                    <div key={business.id} className="flex items-center justify-between text-sm p-2 rounded border">
                      <span className="font-medium">{business.name}</span>
                      <div className="flex items-center gap-2">
                        {business.botConfig.audioEnabled && <Volume2 className="h-3 w-3 text-blue-600" />}
                        {business.botConfig.callEnabled && <Phone className="h-3 w-3 text-green-600" />}
                        {business.botConfig.autoReply && <MessageSquare className="h-3 w-3 text-purple-600" />}
                        {business.botConfig.whatsappWebEnabled && <Settings className="h-3 w-3 text-orange-600" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
