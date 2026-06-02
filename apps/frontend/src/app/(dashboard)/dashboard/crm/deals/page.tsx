'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, Target, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';
import { useBusinessStore } from '@/store/business';
import { leadsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  source: string;
  createdAt: string;
}

export default function DealsPage() {
  const { selectedBusiness } = useBusinessStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  const loadLeads = async () => {
    if (!selectedBusiness?.id) return;
    setLoading(true);
    try {
      const { data } = await leadsApi.getAll(selectedBusiness.id);
      setLeads(data);
    } catch (error) {
      toast({
        title: 'Atención',
        description: 'No se pudieron cargar los leads, o el módulo está en configuración.',
        variant: 'destructive',
      });
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [selectedBusiness?.id]);

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'NEW' || l.status === 'NUEVO').length,
    inProgress: leads.filter(l => l.status === 'IN_PROGRESS' || l.status === 'CONTACTADO').length,
    won: leads.filter(l => l.status === 'WON' || l.status === 'CONVERTIDO').length,
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    if (s === 'NEW' || s === 'NUEVO') return <Badge className="bg-blue-500">Nuevo</Badge>;
    if (s === 'IN_PROGRESS' || s === 'CONTACTADO') return <Badge className="bg-amber-500">En Progreso</Badge>;
    if (s === 'WON' || s === 'CONVERTIDO') return <Badge className="bg-emerald-500">Convertido</Badge>;
    if (s === 'LOST' || s === 'PERDIDO') return <Badge variant="destructive">Perdido</Badge>;
    return <Badge variant="outline">{status || 'Desconocido'}</Badge>;
  };

  if (!selectedBusiness) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        Selecciona un negocio para ver sus oportunidades.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Oportunidades y Leads</h2>
          <p className="text-muted-foreground">
            Sigue el estado de tus prospectos y conviértelos en ventas.
          </p>
        </div>
        <Button variant="outline" onClick={loadLeads} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos</CardTitle>
            <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50">NEW</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.won}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Leads</CardTitle>
          <CardDescription>
            Prospectos capturados por los bots y canales de venta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospecto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha de Ingreso</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Cargando leads...
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No tienes leads activos en este momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-medium">{lead.name || 'Sin nombre'}</div>
                        <div className="text-xs text-muted-foreground">{lead.phone || lead.email}</div>
                      </TableCell>
                      <TableCell className="capitalize">{lead.source}</TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.createdAt ? format(new Date(lead.createdAt), "dd MMM, HH:mm", { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-2">
                          Ver <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
