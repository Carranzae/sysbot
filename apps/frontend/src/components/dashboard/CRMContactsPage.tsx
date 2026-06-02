'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Plus,
  Download,
  RefreshCw,
  MoreHorizontal,
  User,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Smartphone,
  Mail,
  Tablet,
  Send
} from 'lucide-react';
import { useBusinessStore } from '@/store/business';
import { contactsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Contact {
  id: string;
  name?: string;
  email?: string;
  phone: string;
  source?: string;
  tags?: { label: string }[];
  lastIncomingAt?: string;
  lastOutgoingAt?: string;
  createdAt: string;
}

export default function CRMContactsPage() {
  const { selectedBusiness } = useBusinessStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    source: 'all',
  });

  const loadContacts = async () => {
    if (!selectedBusiness?.id) return;
    setLoading(true);
    try {
      const { data } = await contactsApi.getAll(selectedBusiness.id);
      setContacts(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los contactos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [selectedBusiness?.id]);

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = 
      contact.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      contact.phone.includes(filters.search) ||
      contact.email?.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesSource = filters.source === 'all' || contact.source?.toLowerCase() === filters.source;

    return matchesSearch && matchesSource;
  });

  const stats = {
    total: contacts.length,
    whatsapp: contacts.filter(c => c.source?.toLowerCase() === 'whatsapp').length,
    email: contacts.filter(c => c.source?.toLowerCase() === 'email').length,
    recent: contacts.filter(c => {
      if (!c.createdAt) return false;
      const daysDiff = (new Date().getTime() - new Date(c.createdAt).getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    }).length
  };

  const getSourceIcon = (source?: string) => {
    const s = source?.toLowerCase() || 'desconocido';
    switch (s) {
      case 'whatsapp': return <Smartphone className="h-4 w-4 text-emerald-500" />;
      case 'email': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'push': return <Tablet className="h-4 w-4 text-purple-500" />;
      case 'sms': return <Send className="h-4 w-4 text-yellow-500" />;
      default: return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!selectedBusiness) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        Selecciona un negocio para ver sus contactos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Directorio de Contactos</h2>
          <p className="text-muted-foreground">
            Gestiona todos los clientes y leads de {selectedBusiness.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadContacts} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contactos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Registrados en el sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vía WhatsApp</CardTitle>
            <Smartphone className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.whatsapp}</div>
            <p className="text-xs text-muted-foreground">Leads con número validado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vía Email</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.email}</div>
            <p className="text-xs text-muted-foreground">Suscritos por correo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent}</div>
            <p className="text-xs text-muted-foreground">En los últimos 7 días</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, teléfono o email..."
                  className="pl-8"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <Select value={filters.source} onValueChange={(val) => setFilters(prev => ({ ...prev, source: val }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los canales</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Etiquetas</TableHead>
                  <TableHead>Última Actividad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Cargando contactos...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No se encontraron contactos.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{contact.name || 'Sin nombre'}</span>
                            <span className="text-xs text-muted-foreground">{contact.phone || contact.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 capitalize">
                          {getSourceIcon(contact.source)}
                          <span className="text-sm">{contact.source || 'Desconocido'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px] uppercase">
                                {tag.label}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {contact.lastIncomingAt || contact.lastOutgoingAt || contact.createdAt ? 
                            format(new Date(contact.lastIncomingAt || contact.lastOutgoingAt || contact.createdAt), "dd MMM yyyy, HH:mm", { locale: es }) 
                            : 'Nunca'
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
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
