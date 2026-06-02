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
import { 
  RefreshCw, 
  CreditCard, 
  DollarSign, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileText
} from 'lucide-react';
import { useBusinessStore } from '@/store/business';
import { ordersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Order {
  id: string;
  total: number;
  status: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const { selectedBusiness } = useBusinessStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = async () => {
    if (!selectedBusiness?.id) return;
    setLoading(true);
    try {
      const { data } = await ordersApi.getAll(selectedBusiness.id);
      setOrders(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las transacciones.',
        variant: 'destructive',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedBusiness?.id]);

  const stats = {
    totalRevenue: orders.reduce((acc, curr) => acc + (curr.status === 'COMPLETED' ? curr.total : 0), 0),
    completedCount: orders.filter(o => o.status === 'COMPLETED').length,
    pendingCount: orders.filter(o => o.status === 'PENDING').length,
    failedCount: orders.filter(o => o.status === 'FAILED').length,
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    if (s === 'COMPLETED') return <Badge className="bg-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" /> Completado</Badge>;
    if (s === 'PENDING') return <Badge className="bg-amber-500"><Clock className="mr-1 h-3 w-3" /> Pendiente</Badge>;
    if (s === 'FAILED') return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Fallido</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (!selectedBusiness) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        Selecciona un negocio para ver el historial de pagos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pagos y Transacciones</h2>
          <p className="text-muted-foreground">
            Historial completo de ventas y estados de pago de {selectedBusiness.name}.
          </p>
        </div>
        <Button variant="outline" onClick={loadOrders} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Solo pagos completados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Total de intentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
            <p className="text-xs text-muted-foreground">Por validar o procesar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Éxito</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.length > 0 ? Math.round((stats.completedCount / orders.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Tasa de conversión</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Ventas</CardTitle>
          <CardDescription>
            Detalle de las últimas órdenes procesadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Recibo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Cargando transacciones...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No se encontraron transacciones registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs uppercase">{order.id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customerName || 'Cliente Web'}</div>
                        <div className="text-xs text-muted-foreground">{order.customerEmail || '-'}</div>
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        S/ {order.total.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.createdAt ? format(new Date(order.createdAt), "dd MMM, HH:mm", { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <FileText className="h-4 w-4" />
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
