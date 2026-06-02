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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  RefreshCw,
  Crown,
  Zap,
  Shield,
  CreditCard,
  BarChart3,
  Activity,
  TrendingUp,
  DollarSign,
  UserCheck,
  PhoneCall,
  Mic,
  Headphones,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus
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
    activeSubscriptions: number;
    totalRevenue: number;
  };
}

interface Business {
  id: string;
  name: string;
  isActive: boolean;
  planType: string;
  owner: {
    email: string;
    name: string;
  };
  botConfig: {
    audioEnabled: boolean;
    autoReply: boolean;
    whatsappWebEnabled: boolean;
    callEnabled: boolean;
  };
}

interface AdminIndustryPanelEnhancedProps {
  onRefresh?: () => void;
}

export function AdminIndustryPanelEnhanced({ onRefresh }: AdminIndustryPanelEnhancedProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

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

  // Plan colors
  const planColors: Record<string, string> = {
    'BASIC': 'bg-gray-100 text-gray-800',
    'STANDARD': 'bg-blue-100 text-blue-800',
    'PREMIUM': 'bg-purple-100 text-purple-800',
    'ENTERPRISE': 'bg-orange-100 text-orange-800',
    'ULTIMATE': 'bg-red-100 text-red-800'
  };

  // Cargar datos de industrias
  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/industries');
      if (!response.ok) throw new Error('Error al cargar industrias');
      
      const data = await response.json();
      setIndustries(data);
      
    } catch (error) {
      console.error('Error loading industries:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las industrias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Funciones para activar/desactivar características por industria
  const toggleIndustryFeature = async (industryType: string, feature: string, enabled: boolean) => {
    try {
      setUpdating(`${industryType}-${feature}`);
      
      const endpoint = `/api/admin/industries/${industryType}/${feature}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [feature]: enabled }),
      });

      if (!response.ok) {
        throw new Error(`Error al actualizar ${feature}`);
      }

      // Actualizar estado local
      setIndustries(prev => prev.map(industry => {
        if (industry.type === industryType) {
          const updatedBusinesses = industry.businesses.map(business => ({
            ...business,
            botConfig: {
              ...business.botConfig,
              [feature]: enabled
            }
          }));

          const updatedStats = {
            ...industry.stats,
            withAudio: feature === 'audioEnabled' ? (enabled ? industry.stats.total : 0) : industry.stats.withAudio,
            withCalls: feature === 'callEnabled' ? (enabled ? industry.stats.total : 0) : industry.stats.withCalls,
            withAutoReply: feature === 'autoReply' ? (enabled ? industry.stats.total : 0) : industry.stats.withAutoReply,
            withWhatsApp: feature === 'whatsappWebEnabled' ? (enabled ? industry.stats.total : 0) : industry.stats.withWhatsApp
          };

          return {
            ...industry,
            businesses: updatedBusinesses,
            stats: updatedStats
          };
        }
        return industry;
      }));

      toast({
        title: 'Éxito',
        description: `${feature} ${enabled ? 'activado' : 'desactivado'} para ${industryNames[industryType]}`,
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo actualizar ${feature}`,
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Función para actualizar suscripción de un negocio
  const upgradeBusinessSubscription = async (businessId: string, planType: string) => {
    try {
      setUpdating(`subscription-${businessId}`);
      
      const response = await fetch(`/api/admin/subscriptions/${businessId}/upgrade`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planType }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar suscripción');
      }

      toast({
        title: 'Éxito',
        description: `Suscripción actualizada a ${planType}`,
      });

      loadIndustries(); // Recargar datos

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la suscripción',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Función para generar audio de prueba
  const generateTestAudio = async (text: string, voice?: string) => {
    try {
      const response = await fetch('/api/admin/audio/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        throw new Error('Error al generar audio');
      }

      const result = await response.json();
      
      toast({
        title: 'Audio Generado',
        description: `Audio generado exitosamente: ${result.audioUrl}`,
      });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el audio',
        variant: 'destructive'
      });
    }
  };

  // Calcular estadísticas globales
  const globalStats = {
    totalIndustries: industries.length,
    totalBusinesses: industries.reduce((sum, ind) => sum + ind.stats.total, 0),
    withAudio: industries.reduce((sum, ind) => sum + ind.stats.withAudio, 0),
    withCalls: industries.reduce((sum, ind) => sum + ind.stats.withCalls, 0),
    activeSubscriptions: industries.reduce((sum, ind) => sum + ind.stats.activeSubscriptions, 0),
    totalRevenue: industries.reduce((sum, ind) => sum + ind.stats.totalRevenue, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Panel de Control Administrativo</h2>
          <p className="text-muted-foreground">
            Gestión completa de industrias, suscripciones y servicios del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadIndustries} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Negocio
          </Button>
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="industries">Industrias</TabsTrigger>
          <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
        </TabsList>

        {/* Tab: Resumen General */}
        <TabsContent value="overview" className="space-y-6">
          {/* Métricas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Industrias</p>
                    <p className="text-2xl font-bold">{globalStats.totalIndustries}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Negocios Totales</p>
                    <p className="text-2xl font-bold">{globalStats.totalBusinesses}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Con Audio</p>
                    <p className="text-2xl font-bold">{globalStats.withAudio}</p>
                  </div>
                  <Volume2 className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Con Llamadas</p>
                    <p className="text-2xl font-bold">{globalStats.withCalls}</p>
                  </div>
                  <Phone className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Ingresos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Métricas de Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ${globalStats.totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Ingresos Totales/Mes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {globalStats.activeSubscriptions}
                  </div>
                  <div className="text-sm text-muted-foreground">Suscripciones Activas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    ${globalStats.totalRevenue > 0 ? (globalStats.totalRevenue / globalStats.activeSubscriptions).toFixed(0) : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Promedio por Suscripción</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Industrias */}
        <TabsContent value="industries" className="space-y-6">
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
                          {industry.stats.total} negocios • {industry.stats.activeSubscriptions} suscripciones activas
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
                        onCheckedChange={(enabled) => toggleIndustryFeature(industry.type, 'audioEnabled', enabled)}
                        disabled={updating === `${industry.type}-audioEnabled`}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">Llamadas Telefónicas</span>
                      </div>
                      <Switch
                        checked={industry.stats.withCalls === industry.stats.total}
                        onCheckedChange={(enabled) => toggleIndustryFeature(industry.type, 'callEnabled', enabled)}
                        disabled={updating === `${industry.type}-callEnabled`}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">Respuestas Automáticas</span>
                      </div>
                      <Switch
                        checked={industry.stats.withAutoReply === industry.stats.total}
                        onCheckedChange={(enabled) => toggleIndustryFeature(industry.type, 'autoReply', enabled)}
                        disabled={updating === `${industry.type}-autoReply`}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span className="text-sm">Integración WhatsApp</span>
                      </div>
                      <Switch
                        checked={industry.stats.withWhatsApp === industry.stats.total}
                        onCheckedChange={(enabled) => toggleIndustryFeature(industry.type, 'whatsappWebEnabled', enabled)}
                        disabled={updating === `${industry.type}-whatsappWebEnabled`}
                      />
                    </div>
                  </div>

                  {/* Lista de negocios */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Negocios en esta industria:</Label>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {industry.businesses.map((business) => (
                        <div key={business.id} className="flex items-center justify-between text-sm p-2 rounded border">
                          <div className="flex-1">
                            <div className="font-medium">{business.name}</div>
                            <div className="text-xs text-muted-foreground">{business.owner.email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={planColors[business.planType] || 'bg-gray-100'}>
                              {business.planType}
                            </Badge>
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
        </TabsContent>

        {/* Tab: Suscripciones */}
        <TabsContent value="subscriptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Gestión de Suscripciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {industries.flatMap(industry => 
                  industry.businesses.map(business => (
                    <div key={business.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-muted-foreground">{industry.name} • {business.owner.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={planColors[business.planType]}>
                            {business.planType}
                          </Badge>
                          {business.isActive ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Inactivo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="px-3 py-1 border rounded text-sm"
                          defaultValue={business.planType}
                          onChange={(e) => upgradeBusinessSubscription(business.id, e.target.value)}
                          disabled={updating === `subscription-${business.id}`}
                        >
                          <option value="BASIC">Básico</option>
                          <option value="STANDARD">Estándar</option>
                          <option value="PREMIUM">Premium</option>
                          <option value="ENTERPRISE">Empresarial</option>
                          <option value="ULTIMATE">Ultimate</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Servicios */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Test de Audio */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Test de Audio (TTS)
                </CardTitle>
                <CardDescription>
                  Genera audio de prueba para verificar el servicio Text-to-Speech
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-text">Texto de prueba</Label>
                  <textarea
                    id="test-text"
                    className="w-full p-2 border rounded"
                    rows={3}
                    placeholder="Hola, este es un mensaje de prueba del sistema de audio."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voice-select">Voz</Label>
                  <select id="voice-select" className="w-full p-2 border rounded">
                    <option value="es-US-Wavenet-D">Voz Femenina (Español)</option>
                    <option value="es-US-Wavenet-C">Voz Masculina (Español)</option>
                  </select>
                </div>
                <Button 
                  onClick={() => {
                    const text = (document.getElementById('test-text') as HTMLTextAreaElement)?.value;
                    const voice = (document.getElementById('voice-select') as HTMLSelectElement)?.value;
                    generateTestAudio(text, voice);
                  }}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Generar Audio de Prueba
                </Button>
              </CardContent>
            </Card>

            {/* Test de Llamadas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5" />
                  Test de Llamadas
                </CardTitle>
                <CardDescription>
                  Realiza una llamada de prueba para verificar el sistema telefónico
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-phone">Número de teléfono</Label>
                  <input
                    id="test-phone"
                    type="tel"
                    className="w-full p-2 border rounded"
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-business">Negocio</Label>
                  <select id="test-business" className="w-full p-2 border rounded">
                    {industries.flatMap(industry => 
                      industry.businesses.map(business => (
                        <option key={business.id} value={business.id}>
                          {business.name} ({industry.name})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <Button className="w-full" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Iniciar Llamada de Prueba
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Estado de Servicios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Estado de Servicios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-blue-600" />
                    <span>Text-to-Speech</span>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Activo
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-5 w-5 text-purple-600" />
                    <span>Speech-to-Text</span>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Activo
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-green-600" />
                    <span>Telefonía</span>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Activo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
