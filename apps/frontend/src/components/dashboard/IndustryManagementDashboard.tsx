'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useBusinessStore } from '@/store/business';
import {
  Search,
  Plus,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  Users,
  Stethoscope,
  Activity,
  FileText,
  CreditCard,
  MessageSquare,
  Building2,
  MapPin,
  Star,
  TrendingUp,
  TrendingDown,
  CalendarPlus,
  CalendarX,
  Copy,
  Share2,
  Printer,
  Save,
  CheckSquare
} from 'lucide-react';

interface Appointment {
  id: number;
  patientName: string;
  patientContact: string;
  date: string;
  time: string;
  duration: string;
  professional: string;
  service: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  payment: 'pending' | 'paid' | 'partial';
  reminder: boolean;
  notes?: string;
}

interface Staff {
  id: number;
  name: string;
  role: string;
  specialty: string;
  patients: number;
  rating: number;
  status: 'available' | 'busy' | 'off';
}

interface Service {
  id: number;
  name: string;
  price: number;
  duration: string;
  description: string;
  category: string;
}

export default function IndustryManagementDashboard() {
  const { toast } = useToast();
  const { selectedBusiness } = useBusinessStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('appointments');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewAppointmentOpen, setViewAppointmentOpen] = useState(false);
  const [editAppointmentOpen, setEditAppointmentOpen] = useState(false);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editFormData, setEditFormData] = useState<Appointment | null>(null);
  const [newAppointmentData, setNewAppointmentData] = useState<Partial<Appointment>>({
    patientName: '',
    patientContact: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: '30 min',
    professional: 'Dr. Carlos Rodríguez',
    service: 'Consulta General',
    status: 'scheduled',
    payment: 'pending',
    reminder: true,
    notes: ''
  });
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    professional: 'all',
    service: 'all',
    payment: 'all',
    dateFrom: '',
    dateTo: '',
    reminder: 'all'
  });
  const filtersRef = useRef<HTMLDivElement>(null);

  // Estados para modales de servicios
  const [viewServiceOpen, setViewServiceOpen] = useState(false);
  const [editServiceOpen, setEditServiceOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editServiceData, setEditServiceData] = useState<Service | null>(null);
  const [newServiceData, setNewServiceData] = useState<Partial<Service>>({
    name: '',
    price: 0,
    duration: '30 min',
    description: '',
    category: 'Consulta'
  });

  // Estados para modales del personal
  const [viewStaffOpen, setViewStaffOpen] = useState(false);
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [newStaffOpen, setNewStaffOpen] = useState(false);
  const [messageStaffOpen, setMessageStaffOpen] = useState(false);
  const [scheduleStaffOpen, setScheduleStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [editStaffData, setEditStaffData] = useState<Staff | null>(null);
  const [newStaffData, setNewStaffData] = useState<Partial<Staff>>({
    name: '',
    role: '',
    specialty: 'Medicina Interna',
    patients: 0,
    rating: 4.5,
    status: 'available'
  });
  const [messageData, setMessageData] = useState({
    subject: '',
    message: ''
  });

  // Cerrar filtros al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };

    if (filtersOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filtersOpen]);

  // Cerrar dropdown de servicios al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen !== null) {
        const target = event.target as HTMLElement;
        const dropdownButton = target.closest('[data-dropdown-button]');
        
        if (!dropdownButton) {
          setDropdownOpen(null);
        }
      }
    };

    if (dropdownOpen !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Datos mock para gestión de salud
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: 1,
      patientName: 'María González',
      patientContact: '+1 234-567-8900',
      date: '2026-04-09',
      time: '09:00',
      duration: '30 min',
      professional: 'Dr. Carlos Rodríguez',
      service: 'Consulta General',
      status: 'confirmed',
      payment: 'paid',
      reminder: true,
      notes: 'Paciente con hipertensión'
    },
    {
      id: 2,
      patientName: 'Juan Pérez',
      patientContact: '+1 234-567-8901',
      date: '2026-04-09',
      time: '10:30',
      duration: '45 min',
      professional: 'Dra. Ana Martínez',
      service: 'Chequeo Dental',
      status: 'scheduled',
      payment: 'pending',
      reminder: true
    },
    {
      id: 3,
      patientName: 'Laura Sánchez',
      patientContact: '+1 234-567-8902',
      date: '2026-04-09',
      time: '14:00',
      duration: '60 min',
      professional: 'Dr. Carlos Rodríguez',
      service: 'Control Embarazo',
      status: 'completed',
      payment: 'paid',
      reminder: false
    },
    {
      id: 4,
      patientName: 'Carlos Mendoza',
      patientContact: '+1 234-567-8903',
      date: '2026-04-09',
      time: '15:30',
      duration: '30 min',
      professional: 'Dra. Elena Castro',
      service: 'Consulta Pediátrica',
      status: 'scheduled',
      payment: 'pending',
      reminder: true,
      notes: 'Primera consulta pediátrica'
    },
    {
      id: 5,
      patientName: 'Ana Rodríguez',
      patientContact: '+1 234-567-8904',
      date: '2026-04-09',
      time: '16:00',
      duration: '45 min',
      professional: 'Dr. Miguel Torres',
      service: 'Evaluación Cardíaca',
      status: 'confirmed',
      payment: 'partial',
      reminder: true
    },
    {
      id: 6,
      patientName: 'Roberto Silva',
      patientContact: '+1 234-567-8905',
      date: '2026-04-09',
      time: '17:00',
      duration: '20 min',
      professional: 'Dr. Luis Fernández',
      service: 'Electrocardiograma',
      status: 'completed',
      payment: 'paid',
      reminder: false
    },
    {
      id: 7,
      patientName: 'Patricia Vargas',
      patientContact: '+1 234-567-8906',
      date: '2026-04-10',
      time: '08:00',
      duration: '90 min',
      professional: 'Dr. Luis Fernández',
      service: 'Cirugía Menor',
      status: 'scheduled',
      payment: 'pending',
      reminder: true,
      notes: 'Cirugía ambulatoria programada'
    },
    {
      id: 8,
      patientName: 'Miguel Torres',
      patientContact: '+1 234-567-8907',
      date: '2026-04-10',
      time: '09:30',
      duration: '30 min',
      professional: 'Lic. Sofía López',
      service: 'Consulta General',
      status: 'confirmed',
      payment: 'paid',
      reminder: true
    },
    {
      id: 9,
      patientName: 'Elena Castro',
      patientContact: '+1 234-567-8908',
      date: '2026-04-10',
      time: '11:00',
      duration: '15 min',
      professional: 'Lic. Roberto Silva',
      service: 'Análisis de Sangre',
      status: 'scheduled',
      payment: 'pending',
      reminder: false
    },
    {
      id: 10,
      patientName: 'Luis Fernández',
      patientContact: '+1 234-567-8909',
      date: '2026-04-10',
      time: '13:00',
      duration: '25 min',
      professional: 'Dra. Ana Martínez',
      service: 'Rayos X',
      status: 'confirmed',
      payment: 'paid',
      reminder: true
    },
    {
      id: 11,
      patientName: 'Sofía López',
      patientContact: '+1 234-567-8910',
      date: '2026-04-10',
      time: '14:30',
      duration: '15 min',
      professional: 'Dra. Elena Castro',
      service: 'Vacunación',
      status: 'scheduled',
      payment: 'pending',
      reminder: true,
      notes: 'Vacuna influenza anual'
    },
    {
      id: 12,
      patientName: 'Roberto Silva',
      patientContact: '+1 234-567-8911',
      date: '2026-04-10',
      time: '15:00',
      duration: '60 min',
      professional: 'Dr. Carlos Rodríguez',
      service: 'Consulta General',
      status: 'cancelled',
      payment: 'pending',
      reminder: false,
      notes: 'Cancelado por paciente'
    }
  ]);

  const staff: Staff[] = [
    {
      id: 1,
      name: 'Dr. Carlos Rodríguez',
      role: 'Médico General',
      specialty: 'Medicina Interna',
      patients: 156,
      rating: 4.8,
      status: 'available'
    },
    {
      id: 2,
      name: 'Dra. Ana Martínez',
      role: 'Dentista',
      specialty: 'Odontología General',
      patients: 89,
      rating: 4.9,
      status: 'busy'
    },
    {
      id: 3,
      name: 'Lic. Sofía López',
      role: 'Enfermera',
      specialty: 'Cuidados Intensivos',
      patients: 234,
      rating: 4.7,
      status: 'available'
    },
    {
      id: 4,
      name: 'Dr. Miguel Torres',
      role: 'Cardiólogo',
      specialty: 'Cardiología',
      patients: 98,
      rating: 4.9,
      status: 'busy'
    },
    {
      id: 5,
      name: 'Dra. Elena Castro',
      role: 'Pediatra',
      specialty: 'Pediatría',
      patients: 167,
      rating: 4.8,
      status: 'available'
    },
    {
      id: 6,
      name: 'Lic. Roberto Silva',
      role: 'Enfermero',
      specialty: 'Urgencias',
      patients: 189,
      rating: 4.6,
      status: 'off'
    },
    {
      id: 7,
      name: 'Dra. Patricia Vargas',
      role: 'Ginecóloga',
      specialty: 'Ginecología',
      patients: 145,
      rating: 4.7,
      status: 'available'
    },
    {
      id: 8,
      name: 'Dr. Luis Fernández',
      role: 'Cirujano',
      specialty: 'Cirugía General',
      patients: 78,
      rating: 4.9,
      status: 'busy'
    }
  ];

  const services: Service[] = [
    {
      id: 1,
      name: 'Consulta General',
      price: 80,
      duration: '30 min',
      description: 'Consulta médica general para evaluación y diagnóstico',
      category: 'Consulta'
    },
    {
      id: 2,
      name: 'Chequeo Dental',
      price: 120,
      duration: '45 min',
      description: 'Evaluación dental completa y limpieza',
      category: 'Dental'
    },
    {
      id: 3,
      name: 'Control Embarazo',
      price: 100,
      duration: '60 min',
      description: 'Seguimiento prenatal y evaluación fetal',
      category: 'Ginecología'
    },
    {
      id: 4,
      name: 'Evaluación Cardíaca',
      price: 150,
      duration: '45 min',
      description: 'Evaluación completa del sistema cardiovascular',
      category: 'Cardiología'
    },
    {
      id: 5,
      name: 'Consulta Pediátrica',
      price: 90,
      duration: '30 min',
      description: 'Evaluación del desarrollo y salud infantil',
      category: 'Pediatría'
    },
    {
      id: 6,
      name: 'Cirugía Menor',
      price: 200,
      duration: '90 min',
      description: 'Procedimientos quirúrgicos menores ambulatorios',
      category: 'Cirugía'
    },
    {
      id: 7,
      name: 'Electrocardiograma',
      price: 60,
      duration: '20 min',
      description: 'Estudio eléctrico del corazón',
      category: 'Diagnóstico'
    },
    {
      id: 8,
      name: 'Análisis de Sangre',
      price: 45,
      duration: '15 min',
      description: 'Panel completo de análisis sanguíneos',
      category: 'Laboratorio'
    },
    {
      id: 9,
      name: 'Rayos X',
      price: 80,
      duration: '25 min',
      description: 'Estudios radiográficos diagnósticos',
      category: 'Diagnóstico'
    },
    {
      id: 10,
      name: 'Vacunación',
      price: 35,
      duration: '15 min',
      description: 'Aplicación de vacunas y seguimiento',
      category: 'Prevención'
    }
  ];

  const stats = [
    {
      title: 'Total Citas',
      value: appointments.length,
      change: '+12%',
      trend: 'up',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Pacientes Hoy',
      value: appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length,
      change: '+8%',
      trend: 'up',
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Ingresos',
      value: `$${appointments.filter(a => a.payment === 'paid').reduce((sum, a) => sum + 80, 0)}`,
      change: '+23%',
      trend: 'up',
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Tasa Ocupación',
      value: '78%',
      change: '+5%',
      trend: 'up',
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  // Función para normalizar texto (quitar tildes y caracteres especiales)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Elimina diacríticos (tildes, acentos, etc.)
  };

  // Funciones para manejo de citas
  const handleStatusChange = (appointmentId: number, newStatus: Appointment['status']) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      )
    );
    toast({
      title: 'Estado actualizado',
      description: 'El estado de la cita ha sido actualizado',
    });
  };

  const handleReminderToggle = (appointmentId: number) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId ? { ...apt, reminder: !apt.reminder } : apt
      )
    );
    toast({
      title: 'Recordatorio actualizado',
      description: 'El estado del recordatorio ha sido cambiado',
    });
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setViewAppointmentOpen(true);
    setDropdownOpen(null);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditFormData({ ...appointment });
    setEditAppointmentOpen(true);
    setDropdownOpen(null);
  };

  const handleSaveEdit = () => {
    if (editFormData) {
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === editFormData.id
            ? editFormData
            : apt
        )
      );
      toast({
        title: 'Cita actualizada',
        description: 'La cita ha sido actualizada exitosamente',
      });
      setEditAppointmentOpen(false);
      setEditFormData(null);
    }
  };

  const handleDeleteAppointment = (appointmentId: number) => {
    setAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
    toast({
      title: 'Cita eliminada',
      description: 'La cita ha sido eliminada exitosamente',
      variant: 'destructive',
    });
    setDropdownOpen(null);
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    // Cerrar dropdown primero
    setDropdownOpen(null);
    
    // Abrir modal de edición con foco en fecha y hora
    setSelectedAppointment(appointment);
    setEditFormData({ ...appointment });
    
    // Usar setTimeout para asegurar que el modal se abra después de cerrar el dropdown
    setTimeout(() => {
      setEditAppointmentOpen(true);
      toast({
        title: 'Reprogramar cita',
        description: 'Modifica la fecha y hora de la cita',
      });
    }, 100);
  };

  const handleDuplicateAppointment = (appointment: Appointment) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: Math.max(...appointments.map(a => a.id)) + 1,
      status: 'scheduled',
      payment: 'pending'
    };
    setAppointments(prev => [...prev, newAppointment]);
    toast({
      title: 'Cita duplicada',
      description: 'La cita ha sido duplicada exitosamente',
    });
    setDropdownOpen(null);
  };

  const handlePrintAppointment = (appointment: Appointment) => {
    // Simular impresión generando un texto formateado
    const appointmentText = `
CITA MÉDICA - #${appointment.id}
===============================
Paciente: ${appointment.patientName}
Contacto: ${appointment.patientContact}
Fecha: ${appointment.date}
Hora: ${appointment.time}
Duración: ${appointment.duration}
Profesional: ${appointment.professional}
Servicio: ${appointment.service}
Estado: ${appointment.status}
Pago: ${appointment.payment}
${appointment.notes ? `Notas: ${appointment.notes}` : ''}
===============================
    `.trim();
    
    // Crear una ventana temporal para imprimir
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cita Médica #${appointment.id}</title>
            <style>
              body { font-family: monospace; white-space: pre; padding: 20px; }
            </style>
          </head>
          <body>${appointmentText}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    
    toast({
      title: 'Imprimiendo cita',
      description: `Preparando impresión para ${appointment.patientName}`,
    });
    setDropdownOpen(null);
  };

  const handleShareAppointment = (appointment: Appointment) => {
    // Generar un enlace para compartir
    const shareUrl = `${window.location.origin}/cita/${appointment.id}`;
    
    // Copiar al portapapeles
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: 'Enlace copiado',
        description: `Enlace de la cita #${appointment.id} copiado al portapapeles`,
      });
    }).catch(() => {
      // Fallback si clipboard API no está disponible
      toast({
        title: 'Compartir cita',
        description: `Enlace: ${shareUrl}`,
      });
    });
    
    setDropdownOpen(null);
  };

  const handleConfirmAppointment = (appointment: Appointment) => {
    setAppointments(prev => 
      prev.map(apt => 
        apt.id === appointment.id 
          ? { ...apt, status: 'confirmed' as Appointment['status'] }
          : apt
      )
    );
    toast({
      title: 'Cita confirmada',
      description: `Cita con ${appointment.patientName} ha sido confirmada`,
    });
    setDropdownOpen(null);
  };

  const handleCompleteAppointment = (appointment: Appointment) => {
    setAppointments(prev => 
      prev.map(apt => 
        apt.id === appointment.id 
          ? { ...apt, status: 'completed' as Appointment['status'] }
          : apt
      )
    );
    toast({
      title: 'Cita completada',
      description: `Cita con ${appointment.patientName} ha sido marcada como completada`,
    });
    setDropdownOpen(null);
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    setAppointments(prev => 
      prev.map(apt => 
        apt.id === appointment.id 
          ? { ...apt, status: 'cancelled' as Appointment['status'] }
          : apt
      )
    );
    toast({
      title: 'Cita cancelada',
      description: `Cita con ${appointment.patientName} ha sido cancelada`,
      variant: 'destructive',
    });
    setDropdownOpen(null);
  };

  const handleSendReminder = (appointment: Appointment) => {
    toast({
      title: 'Recordatorio enviado',
      description: `Recordatorio enviado a ${appointment.patientName} para ${appointment.date} a las ${appointment.time}`,
    });
    setDropdownOpen(null);
  };

  const handleNewAppointment = () => {
    setNewAppointmentData({
      patientName: '',
      patientContact: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: '30 min',
      professional: 'Dr. Carlos Rodríguez',
      service: 'Consulta General',
      status: 'scheduled',
      payment: 'pending',
      reminder: true,
      notes: ''
    });
    setNewAppointmentOpen(true);
  };

  const handleSaveNewAppointment = () => {
    if (newAppointmentData.patientName && newAppointmentData.patientContact && newAppointmentData.date && newAppointmentData.time) {
      const newAppointment: Appointment = {
        id: Math.max(...appointments.map(a => a.id)) + 1,
        patientName: newAppointmentData.patientName,
        patientContact: newAppointmentData.patientContact,
        date: newAppointmentData.date,
        time: newAppointmentData.time,
        duration: newAppointmentData.duration || '30 min',
        professional: newAppointmentData.professional || 'Dr. Carlos Rodríguez',
        service: newAppointmentData.service || 'Consulta General',
        status: newAppointmentData.status || 'scheduled',
        payment: newAppointmentData.payment || 'pending',
        reminder: newAppointmentData.reminder || true,
        notes: newAppointmentData.notes || ''
      };
      
      toast({
        title: 'Cita agendada',
        description: `Cita agendada para ${newAppointmentData.patientName} el ${newAppointmentData.date} a las ${newAppointmentData.time}`,
      });
      
      setNewAppointmentOpen(false);
      setNewAppointmentData({
        patientName: '',
        patientContact: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: '30 min',
        professional: 'Dr. Carlos Rodríguez',
        service: 'Consulta General',
        status: 'scheduled',
        payment: 'pending',
        reminder: true,
        notes: ''
      });
    } else {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos obligatorios',
        variant: 'destructive',
      });
    }
  };

  // Funciones para manejo de servicios
  const handleViewService = (service: Service) => {
    setSelectedService(service);
    setViewServiceOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setEditServiceData({ ...service });
    setEditServiceOpen(true);
  };

  const handleSaveService = () => {
    if (editServiceData) {
      toast({
        title: 'Servicio actualizado',
        description: 'El servicio ha sido actualizado exitosamente',
      });
      setEditServiceOpen(false);
      setEditServiceData(null);
    }
  };

  const handleScheduleService = (service: Service) => {
    toast({
      title: 'Agendar desde servicio',
      description: `Agendando cita para: ${service.name}`,
    });
  };

  const handleDeleteService = (service: Service) => {
    toast({
      title: 'Servicio eliminado',
      description: 'El servicio ha sido eliminado exitosamente',
      variant: 'destructive',
    });
  };

  const handleDuplicateService = (service: Service) => {
    toast({
      title: 'Servicio duplicado',
      description: 'El servicio ha sido duplicado exitosamente',
    });
  };

  // Funciones para manejo de personal
  const handleViewStaff = (member: Staff) => {
    setSelectedStaff(member);
    setViewStaffOpen(true);
    setDropdownOpen(null);
  };

  const handleEditStaff = (member: Staff) => {
    setSelectedStaff(member);
    setEditStaffData({ ...member });
    setEditStaffOpen(true);
    setDropdownOpen(null);
  };

  const handleScheduleStaff = (member: Staff) => {
    setSelectedStaff(member);
    setScheduleStaffOpen(true);
    setDropdownOpen(null);
  };

  const handleMessageStaff = (member: Staff) => {
    setSelectedStaff(member);
    setMessageData({ subject: '', message: '' });
    setMessageStaffOpen(true);
    setDropdownOpen(null);
  };

  const handleViewScheduleStaff = (member: Staff) => {
    setSelectedStaff(member);
    setScheduleStaffOpen(true);
    setDropdownOpen(null);
  };

  const handleDeleteStaff = (member: Staff) => {
    toast({
      title: 'Eliminar personal',
      description: `Eliminando a: ${member.name}`,
      variant: 'destructive',
    });
    setDropdownOpen(null);
  };

  const handleSaveStaff = () => {
    if (editStaffData) {
      toast({
        title: 'Personal actualizado',
        description: `Los datos de ${editStaffData.name} han sido actualizados`,
      });
      setEditStaffOpen(false);
      setEditStaffData(null);
    }
  };

  const handleSendMessage = () => {
    if (selectedStaff && messageData.subject && messageData.message) {
      toast({
        title: 'Mensaje enviado',
        description: `Mensaje enviado a ${selectedStaff.name}`,
      });
      setMessageStaffOpen(false);
      setMessageData({ subject: '', message: '' });
      setSelectedStaff(null);
    } else {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive',
      });
    }
  };

  const handleScheduleFromStaff = () => {
    if (selectedStaff) {
      toast({
        title: 'Cita agendada',
        description: `Cita agendada con ${selectedStaff.name}`,
      });
      setScheduleStaffOpen(false);
      setSelectedStaff(null);
    }
  };

  const handleNewStaff = () => {
    setNewStaffData({
      name: '',
      role: '',
      specialty: 'Medicina Interna',
      patients: 0,
      rating: 4.5,
      status: 'available'
    });
    setNewStaffOpen(true);
  };

  const handleSaveNewStaff = () => {
    if (newStaffData.name && newStaffData.role) {
      const newStaff: Staff = {
        id: Math.max(...staff.map(s => s.id)) + 1,
        name: newStaffData.name,
        role: newStaffData.role,
        specialty: newStaffData.specialty || 'Medicina Interna',
        patients: newStaffData.patients || 0,
        rating: newStaffData.rating || 4.5,
        status: newStaffData.status || 'available'
      };
      
      toast({
        title: 'Personal agregado',
        description: `${newStaffData.name} ha sido agregado exitosamente al equipo`,
      });
      
      setNewStaffOpen(false);
      setNewStaffData({
        name: '',
        role: '',
        specialty: 'Medicina Interna',
        patients: 0,
        rating: 4.5,
        status: 'available'
      });
    } else {
      toast({
        title: 'Error',
        description: 'Por favor completa el nombre y el rol del personal',
        variant: 'destructive',
      });
    }
  };

  const handleNewService = () => {
    setNewServiceData({
      name: '',
      price: 0,
      duration: '30 min',
      description: '',
      category: 'Consulta'
    });
    setNewServiceOpen(true);
  };

  const handleSaveNewService = () => {
    if (newServiceData.name && newServiceData.price && newServiceData.description) {
      const newService: Service = {
        id: Math.max(...services.map(s => s.id)) + 1,
        name: newServiceData.name,
        price: newServiceData.price,
        duration: newServiceData.duration || '30 min',
        description: newServiceData.description,
        category: newServiceData.category || 'Consulta'
      };
      
      toast({
        title: 'Servicio creado',
        description: 'El nuevo servicio ha sido creado exitosamente',
      });
      
      setNewServiceOpen(false);
      setNewServiceData({
        name: '',
        price: 0,
        duration: '30 min',
        description: '',
        category: 'Consulta'
      });
    } else {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos',
        variant: 'destructive',
      });
    }
  };

  // Funciones auxiliares
  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no-show':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentColor = (payment: Appointment['payment']) => {
    switch (payment) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderHealthManagement = () => {
    // Filtrar citas basadas en el término de búsqueda y filtros
    const filteredAppointments = appointments.filter(appointment => {
      const normalizedSearch = normalizeText(searchTerm);
      
      // Filtro de búsqueda con normalización
      const matchesSearch = !searchTerm || (
        normalizeText(appointment.patientName).includes(normalizedSearch) ||
        normalizeText(appointment.patientContact).includes(normalizedSearch) ||
        normalizeText(appointment.professional).includes(normalizedSearch) ||
        normalizeText(appointment.service).includes(normalizedSearch) ||
        normalizeText(appointment.status).includes(normalizedSearch) ||
        (appointment.notes && normalizeText(appointment.notes).includes(normalizedSearch)) ||
        appointment.id.toString().includes(normalizedSearch)
      );
      
      // Filtros avanzados
      const matchesStatus = filters.status === 'all' || appointment.status === filters.status;
      const matchesProfessional = filters.professional === 'all' || appointment.professional === filters.professional;
      const matchesService = filters.service === 'all' || appointment.service === filters.service;
      const matchesPayment = filters.payment === 'all' || appointment.payment === filters.payment;
      const matchesReminder = filters.reminder === 'all' || 
        (filters.reminder === 'true' && appointment.reminder) || 
        (filters.reminder === 'false' && !appointment.reminder);
      
      const matchesDateFrom = !filters.dateFrom || appointment.date >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || appointment.date <= filters.dateTo;
      const matchesSelectedDate = !selectedDate || appointment.date === selectedDate;
      
      return matchesSearch && matchesStatus && matchesProfessional && matchesService && 
             matchesPayment && matchesReminder && matchesDateFrom && matchesDateTo && matchesSelectedDate;
    });

    const handleFilterChange = (field: string, value: string) => {
      setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
      setFilters({
        status: 'all',
        professional: 'all',
        service: 'all',
        payment: 'all',
        dateFrom: '',
        dateTo: '',
        reminder: 'all'
      });
      toast({
        title: 'Filtros limpiados',
        description: 'Todos los filtros han sido eliminados',
      });
    };

    const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== 'all');

    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión Médica</h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedBusiness?.name} - Gestión de citas y pacientes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar paciente, profesional, servicio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              <div className="relative">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="ml-1 h-2 w-2 bg-blue-500 rounded-full"></span>
                  )}
                </Button>
                
                {/* Panel de Filtros */}
                {filtersOpen && (
                  <div ref={filtersRef} className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Filtros Avanzados</h3>
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          Limpiar
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Estado</Label>
                          <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="scheduled">Agendada</SelectItem>
                              <SelectItem value="confirmed">Confirmada</SelectItem>
                              <SelectItem value="completed">Completada</SelectItem>
                              <SelectItem value="cancelled">Cancelada</SelectItem>
                              <SelectItem value="no-show">No Show</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Pago</Label>
                          <Select value={filters.payment} onValueChange={(value) => handleFilterChange('payment', value)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="partial">Parcial</SelectItem>
                              <SelectItem value="paid">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-700">Profesional</Label>
                        <Select value={filters.professional} onValueChange={(value) => handleFilterChange('professional', value)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="Dr. Carlos Rodríguez">Dr. Carlos Rodríguez</SelectItem>
                            <SelectItem value="Dra. Ana Martínez">Dra. Ana Martínez</SelectItem>
                            <SelectItem value="Lic. Sofía López">Lic. Sofía López</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-700">Servicio</Label>
                        <Select value={filters.service} onValueChange={(value) => handleFilterChange('service', value)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="Consulta General">Consulta General</SelectItem>
                            <SelectItem value="Chequeo Dental">Chequeo Dental</SelectItem>
                            <SelectItem value="Control Embarazo">Control Embarazo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-700">Recordatorio</Label>
                        <Select value={filters.reminder} onValueChange={(value) => handleFilterChange('reminder', value)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="true">Activado</SelectItem>
                            <SelectItem value="false">Desactivado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Fecha Desde</Label>
                          <Input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Fecha Hasta</Label>
                          <Input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {stats.map((stat, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      <div className="flex items-center mt-2">
                        {stat.trend === 'up' && (
                          <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                        )}
                        {stat.trend === 'down' && (
                          <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${
                          stat.trend === 'up' ? 'text-green-600' : 
                          stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {stat.change}
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="appointments">Citas</TabsTrigger>
              <TabsTrigger value="staff">Personal</TabsTrigger>
              <TabsTrigger value="services">Servicios</TabsTrigger>
              <TabsTrigger value="analytics">Análisis</TabsTrigger>
            </TabsList>

            {/* Appointments Tab */}
            <TabsContent value="appointments" className="flex-1 overflow-auto">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Gestión de Citas</CardTitle>
                      <CardDescription>
                        Administra todas las citas médicas
                        {(searchTerm || selectedDate || hasActiveFilters) && (
                          <span className="ml-2 text-sm text-blue-600">
                            ({filteredAppointments.length} resultados)
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                      <Button onClick={handleNewAppointment}>
                        <Plus className="h-4 w-4 mr-2" />
                        Agendar Cita
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white z-10 border-b">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">ID</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Paciente</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Contacto</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Fecha</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Hora</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Duración</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Profesional</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Servicio</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Estado</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Pago</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Recordatorio</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppointments.map((appointment) => (
                          <tr key={appointment.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-900">#{appointment.id}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="font-medium text-gray-900">{appointment.patientName}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4" />
                                {appointment.patientContact}
                              </div>
                            </td>
                            <td className="p-3 text-gray-900">{appointment.date}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 text-gray-900">
                                <Clock className="h-4 w-4" />
                                {appointment.time}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2 text-gray-900">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-900">{appointment.duration}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Stethoscope className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-900">{appointment.professional}</span>
                              </div>
                            </td>
                            <td className="p-3 text-gray-900">{appointment.service}</td>
                            <td className="p-3">
                              <Select
                                value={appointment.status}
                                onValueChange={(value) => handleStatusChange(appointment.id, value as Appointment['status'])}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scheduled">
                                    <Badge className="bg-blue-100 text-blue-800">Agendada</Badge>
                                  </SelectItem>
                                  <SelectItem value="confirmed">
                                    <Badge className="bg-green-100 text-green-800">Confirmada</Badge>
                                  </SelectItem>
                                  <SelectItem value="completed">
                                    <Badge className="bg-gray-100 text-gray-800">Completada</Badge>
                                  </SelectItem>
                                  <SelectItem value="cancelled">
                                    <Badge className="bg-red-100 text-red-800">Cancelada</Badge>
                                  </SelectItem>
                                  <SelectItem value="no-show">
                                    <Badge className="bg-yellow-100 text-yellow-800">No Show</Badge>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Badge className={getPaymentColor(appointment.payment)}>
                                {appointment.payment === 'paid' ? 'Pagado' :
                                 appointment.payment === 'partial' ? 'Parcial' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={appointment.reminder}
                                  onCheckedChange={() => handleReminderToggle(appointment.id)}
                                />
                                <Bell className={`h-4 w-4 ${appointment.reminder ? 'text-blue-600' : 'text-gray-400'}`} />
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleViewAppointment(appointment)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditAppointment(appointment)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <div className="relative">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    data-dropdown-button
                                    onClick={() => setDropdownOpen(dropdownOpen === `appointment-${appointment.id}` ? null : `appointment-${appointment.id}`)}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                  {dropdownOpen === `appointment-${appointment.id}` && (
                                    <div className="absolute right-0 top-8 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                      <div className="py-1">
                                        <button
                                          onClick={() => handleViewAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Eye className="h-4 w-4" />
                                          Ver detalles
                                        </button>
                                        <button
                                          onClick={() => handleEditAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Edit className="h-4 w-4" />
                                          Editar cita
                                        </button>
                                        <button
                                          onClick={() => handleRescheduleAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <CalendarPlus className="h-4 w-4" />
                                          Reprogramar
                                        </button>
                                        <button
                                          onClick={() => handleDuplicateAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Copy className="h-4 w-4" />
                                          Duplicar
                                        </button>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                          onClick={() => handleConfirmAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                          Confirmar cita
                                        </button>
                                        <button
                                          onClick={() => handleCompleteAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <CheckSquare className="h-4 w-4" />
                                          Marcar completada
                                        </button>
                                        <button
                                          onClick={() => handleCancelAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <XCircle className="h-4 w-4" />
                                          Cancelar cita
                                        </button>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                          onClick={() => handlePrintAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Printer className="h-4 w-4" />
                                          Imprimir
                                        </button>
                                        <button
                                          onClick={() => handleShareAppointment(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Share2 className="h-4 w-4" />
                                          Compartir
                                        </button>
                                        <button
                                          onClick={() => handleSendReminder(appointment)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Bell className="h-4 w-4" />
                                          Enviar recordatorio
                                        </button>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                          onClick={() => handleDeleteAppointment(appointment.id)}
                                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Staff Tab */}
            <TabsContent value="staff" className="flex-1 overflow-auto">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Personal Médico</CardTitle>
                      <CardDescription>
                        Gestiona el equipo de profesionales de salud
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleNewStaff}>
                        <Users className="h-4 w-4 mr-2" />
                        Agregar Personal
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white z-10 border-b">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Personal</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Rol</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Especialidad</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Pacientes</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Calificación</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Estado</th>
                          <th className="text-left p-3 font-medium text-gray-700 bg-white">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((member) => (
                          <tr key={member.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Stethoscope className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{member.name}</p>
                                  <p className="text-sm text-gray-500">ID: #{member.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-sm font-medium text-gray-900">{member.role}</span>
                            </td>
                            <td className="p-3">
                              <Badge className="bg-purple-100 text-purple-800">
                                {member.specialty}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">{member.patients}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-400" />
                                <span className="text-sm font-medium text-gray-900">{member.rating}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge className={
                                member.status === 'available' ? 'bg-green-100 text-green-800' :
                                member.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {member.status === 'available' ? 'Disponible' :
                                 member.status === 'busy' ? 'Ocupado' : 'No disponible'}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleViewStaff(member)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEditStaff(member)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleScheduleStaff(member)}
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                                <div className="relative">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    data-dropdown-button
                                    onClick={() => setDropdownOpen(dropdownOpen === `staff-${member.id}` ? null : `staff-${member.id}`)}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                  {dropdownOpen === `staff-${member.id}` && (
                                    <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                      <div className="py-1">
                                        <button
                                          onClick={() => handleViewStaff(member)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Eye className="h-4 w-4" />
                                          Ver perfil
                                        </button>
                                        <button
                                          onClick={() => handleMessageStaff(member)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                          Enviar mensaje
                                        </button>
                                        <button
                                          onClick={() => handleViewScheduleStaff(member)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Calendar className="h-4 w-4" />
                                          Ver agenda
                                        </button>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                          onClick={() => handleEditStaff(member)}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Edit className="h-4 w-4" />
                                          Editar
                                        </button>
                                        <button
                                          onClick={() => handleDeleteStaff(member)}
                                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="flex-1 overflow-auto">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Servicios Médicos</CardTitle>
                      <CardDescription>
                        Administra los servicios y tratamientos disponibles
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleNewService}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Servicio
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {services.map((service) => (
                      <Card key={service.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 
                                className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors"
                                onClick={() => handleViewService(service)}
                              >
                                {service.name}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{service.description}</p>
                            </div>
                            <div className="ml-4">
                              <Badge className="bg-blue-100 text-blue-800">
                                {service.category}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-sm font-medium text-gray-900">${service.price}</span>
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-sm text-gray-600">{service.duration}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleEditService(service)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleScheduleService(service)}
                            >
                              <Calendar className="h-3 w-3" />
                            </Button>
                            <div className="relative">
                              <Button 
                                variant="outline" 
                                size="sm"
                                data-dropdown-button
                                onClick={() => setDropdownOpen(dropdownOpen === `service-${service.id}` ? null : `service-${service.id}`)}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                              {dropdownOpen === `service-${service.id}` && (
                                <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleViewService(service)}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Eye className="h-4 w-4" />
                                      Ver detalles
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateService(service)}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Copy className="h-4 w-4" />
                                      Duplicar
                                    </button>
                                    <div className="border-t border-gray-200 my-1"></div>
                                    <button
                                      onClick={() => handleDeleteService(service)}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="flex-1 overflow-auto">
              <div className="space-y-6 h-full">
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Citas del Mes</p>
                          <p className="text-2xl font-bold text-gray-900">247</p>
                          <p className="text-xs text-green-600">+12% vs mes anterior</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Ingresos</p>
                          <p className="text-2xl font-bold text-gray-900">$18,450</p>
                          <p className="text-xs text-green-600">+23% vs mes anterior</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Users className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Pacientes Nuevos</p>
                          <p className="text-2xl font-bold text-gray-900">43</p>
                          <p className="text-xs text-green-600">+8% vs mes anterior</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Activity className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Tasa Ocupación</p>
                          <p className="text-2xl font-bold text-gray-900">78%</p>
                          <p className="text-xs text-green-600">+5% vs mes anterior</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tendencia de Citas</CardTitle>
                      <CardDescription>Evolución mensual de citas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between">
                          {[0, 50, 100, 150, 200, 250].map((value) => (
                            <div key={value} className="flex items-center">
                              <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
                              <div className="flex-1 border-t border-gray-200"></div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Bars */}
                        <div className="absolute inset-0 flex items-end justify-between px-10 pb-8">
                          {[
                            { mes: 'Ene', valor: 180, color: 'bg-blue-400' },
                            { mes: 'Feb', valor: 195, color: 'bg-blue-500' },
                            { mes: 'Mar', valor: 210, color: 'bg-blue-500' },
                            { mes: 'Abr', valor: 225, color: 'bg-blue-600' },
                            { mes: 'May', valor: 240, color: 'bg-blue-600' },
                            { mes: 'Jun', valor: 247, color: 'bg-blue-700' }
                          ].map((item, index) => {
                            const altura = (item.valor / 250) * 100;
                            return (
                              <div key={item.mes} className="flex-1 flex flex-col items-center max-w-20">
                                <div className="relative w-full">
                                  <div 
                                    className={`${item.color} rounded-t-lg transition-all duration-300 hover:opacity-80 relative`}
                                    style={{height: `${altura}%`, minHeight: '20px'}}
                                  >
                                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                                      {item.valor}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* X-axis labels */}
                        <div className="absolute bottom-0 left-0 right-0 flex justify-around px-10 pb-2">
                          {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'].map((mes) => (
                            <span key={mes} className="text-sm font-medium text-gray-700">{mes}</span>
                          ))}
                        </div>
                        
                        {/* Trend line */}
                        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                          <defs>
                            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 50 180 L 150 165 L 250 150 L 350 135 L 450 120 L 550 115"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray="5,5"
                          />
                          <circle cx="50" cy="180" r="4" fill="#3B82F6" />
                          <circle cx="150" cy="165" r="4" fill="#3B82F6" />
                          <circle cx="250" cy="150" r="4" fill="#3B82F6" />
                          <circle cx="350" cy="135" r="4" fill="#3B82F6" />
                          <circle cx="450" cy="120" r="4" fill="#3B82F6" />
                          <circle cx="550" cy="115" r="4" fill="#3B82F6" />
                        </svg>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex items-center justify-center mt-4 space-x-6">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                          <span className="text-sm text-gray-600">Citas mensuales</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 border-2 border-blue-500 border-dashed rounded mr-2"></div>
                          <span className="text-sm text-gray-600">Tendencia</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribución por Servicio</CardTitle>
                      <CardDescription>Citas por tipo de servicio</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <div className="space-y-3">
                          {[
                            { servicio: 'Consulta General', citas: 85, color: 'bg-blue-500' },
                            { servicio: 'Chequeo Dental', citas: 45, color: 'bg-green-500' },
                            { servicio: 'Control Embarazo', citas: 32, color: 'bg-purple-500' },
                            { servicio: 'Evaluación Cardíaca', citas: 28, color: 'bg-orange-500' },
                            { servicio: 'Otros', citas: 57, color: 'bg-gray-500' }
                          ].map((item, index) => (
                            <div key={item.servicio} className="flex items-center">
                              <div className="w-24 text-sm text-gray-600">{item.servicio}</div>
                              <div className="flex-1 mx-3">
                                <div className="w-full bg-gray-200 rounded-full h-4">
                                  <div 
                                    className={`${item.color} h-4 rounded-full`} 
                                    style={{width: `${(item.citas / 247) * 100}%`}}
                                  ></div>
                                </div>
                              </div>
                              <span className="text-sm font-medium w-12 text-right">{item.citas}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Métricas de Rendimiento</CardTitle>
                      <CardDescription>Indicadores clave de desempeño</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Tasa de Asistencia</p>
                            <p className="text-2xl font-bold text-gray-900">92%</p>
                          </div>
                          <div className="w-24">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-green-600 h-3 rounded-full" style={{width: '92%'}}></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Satisfacción del Paciente</p>
                            <p className="text-2xl font-bold text-gray-900">4.8/5</p>
                          </div>
                          <div className="w-24">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-blue-600 h-3 rounded-full" style={{width: '96%'}}></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Tiempo Espera Promedio</p>
                            <p className="text-2xl font-bold text-gray-900">15 min</p>
                          </div>
                          <div className="w-24">
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-orange-600 h-3 rounded-full" style={{width: '35%'}}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Rendimiento por Profesional</CardTitle>
                      <CardDescription>Métricas individuales del personal</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { nombre: 'Dr. Carlos Rodríguez', citas: 68, satisfaccion: 4.9, color: 'bg-blue-500' },
                          { nombre: 'Dra. Ana Martínez', citas: 52, satisfaccion: 4.8, color: 'bg-green-500' },
                          { nombre: 'Dra. Elena Castro', citas: 45, satisfaccion: 4.7, color: 'bg-purple-500' },
                          { nombre: 'Dr. Miguel Torres', citas: 38, satisfaccion: 4.9, color: 'bg-orange-500' }
                        ].map((profesional, index) => (
                          <div key={profesional.nombre} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900">{profesional.nombre}</span>
                              <div className="flex items-center gap-2">
                                <Star className="h-3 w-3 text-yellow-400" />
                                <span className="text-xs text-gray-600">{profesional.satisfaccion}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-16">{profesional.citas} citas</span>
                              <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`${profesional.color} h-2 rounded-full`} 
                                    style={{width: `${(profesional.citas / 68) * 100}%`}}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Ingresos Promedio por Cita</p>
                          <p className="text-xl font-bold text-gray-900">$74.70</p>
                          <p className="text-xs text-green-600">+5% vs mes anterior</p>
                        </div>
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Cancelaciones</p>
                          <p className="text-xl font-bold text-gray-900">8%</p>
                          <p className="text-xs text-red-600">+2% vs mes anterior</p>
                        </div>
                        <div className="p-2 bg-red-100 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Utilización del Tiempo</p>
                          <p className="text-xl font-bold text-gray-900">82%</p>
                          <p className="text-xs text-green-600">+3% vs mes anterior</p>
                        </div>
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  };

  // Modal para crear nueva cita
  const NewAppointmentModal = () => {
    return (
      <Dialog open={newAppointmentOpen} onOpenChange={setNewAppointmentOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Agendar Nueva Cita
            </DialogTitle>
            <DialogDescription>
              Programa una nueva cita médica
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newPatientName">Nombre del Paciente *</Label>
                <Input
                  id="newPatientName"
                  value={newAppointmentData.patientName || ''}
                  onChange={(e) => setNewAppointmentData({...newAppointmentData, patientName: e.target.value})}
                  placeholder="Ej: María González"
                />
              </div>
              <div>
                <Label htmlFor="newPatientContact">Contacto *</Label>
                <Input
                  id="newPatientContact"
                  value={newAppointmentData.patientContact || ''}
                  onChange={(e) => setNewAppointmentData({...newAppointmentData, patientContact: e.target.value})}
                  placeholder="Ej: +1 234-567-8900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newAppointmentDate">Fecha *</Label>
                <Input
                  id="newAppointmentDate"
                  type="date"
                  value={newAppointmentData.date || ''}
                  onChange={(e) => setNewAppointmentData({...newAppointmentData, date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="newAppointmentTime">Hora *</Label>
                <Select
                  value={newAppointmentData.time || '09:00'}
                  onValueChange={(value) => setNewAppointmentData({...newAppointmentData, time: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">09:00</SelectItem>
                    <SelectItem value="09:30">09:30</SelectItem>
                    <SelectItem value="10:00">10:00</SelectItem>
                    <SelectItem value="10:30">10:30</SelectItem>
                    <SelectItem value="11:00">11:00</SelectItem>
                    <SelectItem value="11:30">11:30</SelectItem>
                    <SelectItem value="14:00">14:00</SelectItem>
                    <SelectItem value="14:30">14:30</SelectItem>
                    <SelectItem value="15:00">15:00</SelectItem>
                    <SelectItem value="15:30">15:30</SelectItem>
                    <SelectItem value="16:00">16:00</SelectItem>
                    <SelectItem value="16:30">16:30</SelectItem>
                    <SelectItem value="17:00">17:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newProfessional">Profesional *</Label>
                <Select
                  value={newAppointmentData.professional || 'Dr. Carlos Rodríguez'}
                  onValueChange={(value) => setNewAppointmentData({...newAppointmentData, professional: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr. Carlos Rodríguez">Dr. Carlos Rodríguez</SelectItem>
                    <SelectItem value="Dra. Ana Martínez">Dra. Ana Martínez</SelectItem>
                    <SelectItem value="Dra. Elena Castro">Dra. Elena Castro</SelectItem>
                    <SelectItem value="Dr. Miguel Torres">Dr. Miguel Torres</SelectItem>
                    <SelectItem value="Dr. Luis Fernández">Dr. Luis Fernández</SelectItem>
                    <SelectItem value="Lic. Sofía López">Lic. Sofía López</SelectItem>
                    <SelectItem value="Lic. Roberto Silva">Lic. Roberto Silva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="newService">Servicio *</Label>
                <Select
                  value={newAppointmentData.service || 'Consulta General'}
                  onValueChange={(value) => setNewAppointmentData({...newAppointmentData, service: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta General">Consulta General</SelectItem>
                    <SelectItem value="Chequeo Dental">Chequeo Dental</SelectItem>
                    <SelectItem value="Control Embarazo">Control Embarazo</SelectItem>
                    <SelectItem value="Evaluación Cardíaca">Evaluación Cardíaca</SelectItem>
                    <SelectItem value="Consulta Pediátrica">Consulta Pediátrica</SelectItem>
                    <SelectItem value="Electrocardiograma">Electrocardiograma</SelectItem>
                    <SelectItem value="Cirugía Menor">Cirugía Menor</SelectItem>
                    <SelectItem value="Análisis de Sangre">Análisis de Sangre</SelectItem>
                    <SelectItem value="Rayos X">Rayos X</SelectItem>
                    <SelectItem value="Vacunación">Vacunación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newDuration">Duración</Label>
                <Select
                  value={newAppointmentData.duration || '30 min'}
                  onValueChange={(value) => setNewAppointmentData({...newAppointmentData, duration: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15 min">15 min</SelectItem>
                    <SelectItem value="20 min">20 min</SelectItem>
                    <SelectItem value="25 min">25 min</SelectItem>
                    <SelectItem value="30 min">30 min</SelectItem>
                    <SelectItem value="45 min">45 min</SelectItem>
                    <SelectItem value="60 min">60 min</SelectItem>
                    <SelectItem value="90 min">90 min</SelectItem>
                    <SelectItem value="120 min">120 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="newPayment">Estado de Pago</Label>
                <Select
                  value={newAppointmentData.payment || 'pending'}
                  onValueChange={(value) => setNewAppointmentData({...newAppointmentData, payment: value as Appointment['payment']})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="newNotes">Notas (opcional)</Label>
              <textarea
                id="newNotes"
                className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newAppointmentData.notes || ''}
                onChange={(e) => setNewAppointmentData({...newAppointmentData, notes: e.target.value})}
                placeholder="Añade notas adicionales sobre la cita..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="newReminder"
                checked={newAppointmentData.reminder || false}
                onChange={(e) => setNewAppointmentData({...newAppointmentData, reminder: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <Label htmlFor="newReminder" className="text-sm text-gray-700">
                Enviar recordatorio al paciente
              </Label>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Información:</strong> Los campos marcados con * son obligatorios. La cita será agendada automáticamente y se enviará una confirmación al paciente.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewAppointmentOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNewAppointment}>
                <Plus className="h-4 w-4 mr-2" />
                Agendar Cita
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para ver cita
  const ViewAppointmentModal = () => {
    if (!selectedAppointment) return null;

    return (
      <Dialog open={viewAppointmentOpen} onOpenChange={setViewAppointmentOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Detalles de la Cita
            </DialogTitle>
            <DialogDescription>
              Información completa de la cita médica
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">ID de Cita</Label>
                <p className="text-lg font-semibold">#{selectedAppointment.id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Estado</Label>
                <Badge className={getStatusColor(selectedAppointment.status)}>
                  {selectedAppointment.status === 'scheduled' ? 'Agendada' :
                   selectedAppointment.status === 'confirmed' ? 'Confirmada' :
                   selectedAppointment.status === 'completed' ? 'Completada' :
                   selectedAppointment.status === 'cancelled' ? 'Cancelada' : 'No Show'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Paciente</Label>
                <p className="text-lg font-semibold">{selectedAppointment.patientName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Contacto</Label>
                <p className="text-lg">{selectedAppointment.patientContact}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Fecha</Label>
                <p className="text-lg">{selectedAppointment.date}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Hora</Label>
                <p className="text-lg">{selectedAppointment.time}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Duración</Label>
                <p className="text-lg">{selectedAppointment.duration}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Recordatorio</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={selectedAppointment.reminder} disabled />
                  <span>{selectedAppointment.reminder ? 'Activado' : 'Desactivado'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Profesional</Label>
                <p className="text-lg">{selectedAppointment.professional}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Servicio</Label>
                <p className="text-lg">{selectedAppointment.service}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Estado de Pago</Label>
                <Badge className={getPaymentColor(selectedAppointment.payment)}>
                  {selectedAppointment.payment === 'paid' ? 'Pagado' :
                   selectedAppointment.payment === 'partial' ? 'Parcial' : 'Pendiente'}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Notas</Label>
                <p className="text-lg">{selectedAppointment.notes || 'Sin notas'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setViewAppointmentOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={() => {
                setViewAppointmentOpen(false);
                handleEditAppointment(selectedAppointment);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para editar cita
  const EditAppointmentModal = () => {
    if (!editFormData) return null;

    return (
      <Dialog open={editAppointmentOpen} onOpenChange={setEditAppointmentOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Cita
            </DialogTitle>
            <DialogDescription>
              Modifica la información de la cita médica
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patientName">Nombre del Paciente</Label>
                <Input
                  id="patientName"
                  value={editFormData.patientName}
                  onChange={(e) => setEditFormData({...editFormData, patientName: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="patientContact">Contacto</Label>
                <Input
                  id="patientContact"
                  value={editFormData.patientContact}
                  onChange={(e) => setEditFormData({...editFormData, patientContact: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={editFormData.time}
                  onChange={(e) => setEditFormData({...editFormData, time: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="duration">Duración</Label>
                <Select
                  value={editFormData.duration}
                  onValueChange={(value) => setEditFormData({...editFormData, duration: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15 min">15 min</SelectItem>
                    <SelectItem value="30 min">30 min</SelectItem>
                    <SelectItem value="45 min">45 min</SelectItem>
                    <SelectItem value="60 min">60 min</SelectItem>
                    <SelectItem value="90 min">90 min</SelectItem>
                    <SelectItem value="120 min">120 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="professional">Profesional</Label>
                <Select
                  value={editFormData.professional}
                  onValueChange={(value) => setEditFormData({...editFormData, professional: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr. Carlos Rodríguez">Dr. Carlos Rodríguez</SelectItem>
                    <SelectItem value="Dra. Ana Martínez">Dra. Ana Martínez</SelectItem>
                    <SelectItem value="Lic. Sofía López">Lic. Sofía López</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="service">Servicio</Label>
                <Select
                  value={editFormData.service}
                  onValueChange={(value) => setEditFormData({...editFormData, service: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta General">Consulta General</SelectItem>
                    <SelectItem value="Chequeo Dental">Chequeo Dental</SelectItem>
                    <SelectItem value="Control Embarazo">Control Embarazo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({...editFormData, status: value as Appointment['status']})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendada</SelectItem>
                    <SelectItem value="confirmed">Confirmada</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="no-show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment">Estado de Pago</Label>
                <Select
                  value={editFormData.payment}
                  onValueChange={(value) => setEditFormData({...editFormData, payment: value as Appointment['payment']})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={editFormData.notes || ''}
                onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                placeholder="Añadir notas sobre la cita..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={editFormData.reminder}
                onCheckedChange={(checked) => setEditFormData({...editFormData, reminder: checked})}
              />
              <Label>Activar recordatorio</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditAppointmentOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Renderizar diferentes tipos de gestión según el rubro
  const renderManagementByIndustry = () => {
    if (!selectedBusiness) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Selecciona un Negocio</h2>
            <p className="text-gray-600">Por favor selecciona un negocio para ver la gestión específica</p>
          </div>
        </div>
      );
    }

    switch (selectedBusiness.industryType) {
      case 'CLINIC':
      case 'ACADEMY':
        return renderHealthManagement();
      case 'RESTAURANT':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión Restaurantes</h2>
              <p className="text-gray-600">Próximamente: Gestión de mesas, pedidos y cocina</p>
            </div>
          </div>
        );
      case 'RETAIL':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión Retail</h2>
              <p className="text-gray-600">Próximamente: Gestión de inventario y ventas</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión General</h2>
              <p className="text-gray-600">Sistema de gestión adaptado a tu negocio</p>
            </div>
          </div>
        );
    }
  };

  // Modal para ver servicio
  const ViewServiceModal = () => {
    if (!selectedService) return null;

    return (
      <Dialog open={viewServiceOpen} onOpenChange={setViewServiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalles del Servicio
            </DialogTitle>
            <DialogDescription>
              Información completa del servicio médico
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">ID del Servicio</Label>
                <p className="text-lg font-semibold">#{selectedService.id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Categoría</Label>
                <Badge className="bg-blue-100 text-blue-800 mt-1">
                  {selectedService.category}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600">Nombre del Servicio</Label>
              <p className="text-lg font-semibold text-gray-900 mt-1">{selectedService.name}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600">Descripción</Label>
              <p className="text-gray-700 mt-1">{selectedService.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Precio</Label>
                <div className="flex items-center mt-1">
                  <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                  <p className="text-lg font-semibold text-gray-900">${selectedService.price}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Duración</Label>
                <div className="flex items-center mt-1">
                  <Clock className="h-5 w-5 text-gray-400 mr-2" />
                  <p className="text-lg font-semibold text-gray-900">{selectedService.duration}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setViewServiceOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={() => {
                setViewServiceOpen(false);
                handleEditService(selectedService);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button onClick={() => {
                setViewServiceOpen(false);
                handleScheduleService(selectedService);
              }}>
                <Calendar className="h-4 w-4 mr-2" />
                Agendar Cita
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para editar servicio
  const EditServiceModal = () => {
    if (!editServiceData) return null;

    return (
      <Dialog open={editServiceOpen} onOpenChange={setEditServiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Servicio
            </DialogTitle>
            <DialogDescription>
              Modifica la información del servicio médico
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceName">Nombre del Servicio</Label>
                <Input
                  id="serviceName"
                  value={editServiceData.name}
                  onChange={(e) => setEditServiceData({...editServiceData, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="serviceCategory">Categoría</Label>
                <Select
                  value={editServiceData.category}
                  onValueChange={(value) => setEditServiceData({...editServiceData, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta">Consulta</SelectItem>
                    <SelectItem value="Dental">Dental</SelectItem>
                    <SelectItem value="Ginecología">Ginecología</SelectItem>
                    <SelectItem value="Cardiología">Cardiología</SelectItem>
                    <SelectItem value="Pediatría">Pediatría</SelectItem>
                    <SelectItem value="Cirugía">Cirugía</SelectItem>
                    <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                    <SelectItem value="Laboratorio">Laboratorio</SelectItem>
                    <SelectItem value="Prevención">Prevención</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="serviceDescription">Descripción</Label>
              <Input
                id="serviceDescription"
                value={editServiceData.description}
                onChange={(e) => setEditServiceData({...editServiceData, description: e.target.value})}
                placeholder="Describe el servicio..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="servicePrice">Precio</Label>
                <Input
                  id="servicePrice"
                  type="number"
                  value={editServiceData.price}
                  onChange={(e) => setEditServiceData({...editServiceData, price: parseInt(e.target.value)})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="serviceDuration">Duración</Label>
                <Select
                  value={editServiceData.duration}
                  onValueChange={(value) => setEditServiceData({...editServiceData, duration: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15 min">15 min</SelectItem>
                    <SelectItem value="20 min">20 min</SelectItem>
                    <SelectItem value="25 min">25 min</SelectItem>
                    <SelectItem value="30 min">30 min</SelectItem>
                    <SelectItem value="45 min">45 min</SelectItem>
                    <SelectItem value="60 min">60 min</SelectItem>
                    <SelectItem value="90 min">90 min</SelectItem>
                    <SelectItem value="120 min">120 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditServiceOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveService}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para crear nuevo servicio
  const NewServiceModal = () => {
    return (
      <Dialog open={newServiceOpen} onOpenChange={setNewServiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nuevo Servicio Médico
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo servicio para tu clínica
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newServiceName">Nombre del Servicio *</Label>
                <Input
                  id="newServiceName"
                  value={newServiceData.name || ''}
                  onChange={(e) => setNewServiceData({...newServiceData, name: e.target.value})}
                  placeholder="Ej: Consulta de seguimiento"
                />
              </div>
              <div>
                <Label htmlFor="newServiceCategory">Categoría *</Label>
                <Select
                  value={newServiceData.category || 'Consulta'}
                  onValueChange={(value) => setNewServiceData({...newServiceData, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta">Consulta</SelectItem>
                    <SelectItem value="Dental">Dental</SelectItem>
                    <SelectItem value="Ginecología">Ginecología</SelectItem>
                    <SelectItem value="Cardiología">Cardiología</SelectItem>
                    <SelectItem value="Pediatría">Pediatría</SelectItem>
                    <SelectItem value="Cirugía">Cirugía</SelectItem>
                    <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                    <SelectItem value="Laboratorio">Laboratorio</SelectItem>
                    <SelectItem value="Prevención">Prevención</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="newServiceDescription">Descripción *</Label>
              <Input
                id="newServiceDescription"
                value={newServiceData.description || ''}
                onChange={(e) => setNewServiceData({...newServiceData, description: e.target.value})}
                placeholder="Describe brevemente el servicio..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newServicePrice">Precio ($) *</Label>
                <Input
                  id="newServicePrice"
                  type="number"
                  value={newServiceData.price || 0}
                  onChange={(e) => setNewServiceData({...newServiceData, price: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="newServiceDuration">Duración *</Label>
                <Select
                  value={newServiceData.duration || '30 min'}
                  onValueChange={(value) => setNewServiceData({...newServiceData, duration: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15 min">15 min</SelectItem>
                    <SelectItem value="20 min">20 min</SelectItem>
                    <SelectItem value="25 min">25 min</SelectItem>
                    <SelectItem value="30 min">30 min</SelectItem>
                    <SelectItem value="45 min">45 min</SelectItem>
                    <SelectItem value="60 min">60 min</SelectItem>
                    <SelectItem value="90 min">90 min</SelectItem>
                    <SelectItem value="120 min">120 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Información:</strong> Los campos marcados con * son obligatorios. El nuevo servicio estará disponible para agendar citas inmediatamente después de ser creado.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewServiceOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNewService}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Servicio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para ver personal
  const ViewStaffModal = () => {
    if (!selectedStaff) return null;

    return (
      <Dialog open={viewStaffOpen} onOpenChange={setViewStaffOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Perfil del Personal
            </DialogTitle>
            <DialogDescription>
              Información completa del profesional de salud
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Stethoscope className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedStaff.name}</h3>
                <p className="text-gray-600">{selectedStaff.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">ID del Personal</Label>
                <p className="text-lg font-semibold">#{selectedStaff.id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Estado</Label>
                <Badge className={
                  selectedStaff.status === 'available' ? 'bg-green-100 text-green-800' :
                  selectedStaff.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {selectedStaff.status === 'available' ? 'Disponible' :
                   selectedStaff.status === 'busy' ? 'Ocupado' : 'No disponible'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Especialidad</Label>
                <Badge className="bg-purple-100 text-purple-800 mt-1">
                  {selectedStaff.specialty}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Pacientes Activos</Label>
                <div className="flex items-center mt-1">
                  <Users className="h-5 w-5 text-gray-400 mr-2" />
                  <p className="text-lg font-semibold text-gray-900">{selectedStaff.patients}</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600">Calificación</Label>
              <div className="flex items-center mt-1">
                <Star className="h-5 w-5 text-yellow-400 mr-2" />
                <span className="text-lg font-semibold text-gray-900">{selectedStaff.rating}</span>
                <span className="text-gray-600 ml-2">/5.0</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setViewStaffOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={() => {
                setViewStaffOpen(false);
                handleEditStaff(selectedStaff);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button onClick={() => {
                setViewStaffOpen(false);
                handleScheduleStaff(selectedStaff);
              }}>
                <Calendar className="h-4 w-4 mr-2" />
                Agendar Cita
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para editar personal
  const EditStaffModal = () => {
    if (!editStaffData) return null;

    return (
      <Dialog open={editStaffOpen} onOpenChange={setEditStaffOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Personal
            </DialogTitle>
            <DialogDescription>
              Modifica la información del profesional de salud
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffName">Nombre Completo</Label>
                <Input
                  id="staffName"
                  value={editStaffData.name}
                  onChange={(e) => setEditStaffData({...editStaffData, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="staffRole">Rol</Label>
                <Input
                  id="staffRole"
                  value={editStaffData.role}
                  onChange={(e) => setEditStaffData({...editStaffData, role: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffSpecialty">Especialidad</Label>
                <Select
                  value={editStaffData.specialty}
                  onValueChange={(value) => setEditStaffData({...editStaffData, specialty: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medicina Interna">Medicina Interna</SelectItem>
                    <SelectItem value="Odontología General">Odontología General</SelectItem>
                    <SelectItem value="Cuidados Intensivos">Cuidados Intensivos</SelectItem>
                    <SelectItem value="Cardiología">Cardiología</SelectItem>
                    <SelectItem value="Pediatría">Pediatría</SelectItem>
                    <SelectItem value="Urgencias">Urgencias</SelectItem>
                    <SelectItem value="Ginecología">Ginecología</SelectItem>
                    <SelectItem value="Cirugía General">Cirugía General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="staffStatus">Estado</Label>
                <Select
                  value={editStaffData.status}
                  onValueChange={(value) => setEditStaffData({...editStaffData, status: value as Staff['status']})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="busy">Ocupado</SelectItem>
                    <SelectItem value="off">No disponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffPatients">Número de Pacientes</Label>
                <Input
                  id="staffPatients"
                  type="number"
                  value={editStaffData.patients}
                  onChange={(e) => setEditStaffData({...editStaffData, patients: parseInt(e.target.value)})}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="staffRating">Calificación</Label>
                <Select
                  value={editStaffData.rating.toString()}
                  onValueChange={(value) => setEditStaffData({...editStaffData, rating: parseFloat(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4.0">4.0</SelectItem>
                    <SelectItem value="4.1">4.1</SelectItem>
                    <SelectItem value="4.2">4.2</SelectItem>
                    <SelectItem value="4.3">4.3</SelectItem>
                    <SelectItem value="4.4">4.4</SelectItem>
                    <SelectItem value="4.5">4.5</SelectItem>
                    <SelectItem value="4.6">4.6</SelectItem>
                    <SelectItem value="4.7">4.7</SelectItem>
                    <SelectItem value="4.8">4.8</SelectItem>
                    <SelectItem value="4.9">4.9</SelectItem>
                    <SelectItem value="5.0">5.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditStaffOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveStaff}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para enviar mensaje
  const MessageStaffModal = () => {
    if (!selectedStaff) return null;

    return (
      <Dialog open={messageStaffOpen} onOpenChange={setMessageStaffOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Enviar Mensaje
            </DialogTitle>
            <DialogDescription>
              Envía un mensaje a {selectedStaff.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedStaff.name}</p>
                <p className="text-sm text-gray-600">{selectedStaff.role}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="messageSubject">Asunto *</Label>
              <Input
                id="messageSubject"
                value={messageData.subject}
                onChange={(e) => setMessageData({...messageData, subject: e.target.value})}
                placeholder="Ej: Consulta de seguimiento"
              />
            </div>

            <div>
              <Label htmlFor="messageContent">Mensaje *</Label>
              <textarea
                id="messageContent"
                className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={messageData.message}
                onChange={(e) => setMessageData({...messageData, message: e.target.value})}
                placeholder="Escribe tu mensaje aquí..."
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> El mensaje será enviado directamente al profesional y aparecerá en su bandeja de entrada.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setMessageStaffOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendMessage}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar Mensaje
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para crear nuevo personal
  const NewStaffModal = () => {
    return (
      <Dialog open={newStaffOpen} onOpenChange={setNewStaffOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agregar Nuevo Personal
            </DialogTitle>
            <DialogDescription>
              Agrega un nuevo profesional de salud al equipo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newStaffName">Nombre Completo *</Label>
                <Input
                  id="newStaffName"
                  value={newStaffData.name || ''}
                  onChange={(e) => setNewStaffData({...newStaffData, name: e.target.value})}
                  placeholder="Ej: Dr. Juan Pérez"
                />
              </div>
              <div>
                <Label htmlFor="newStaffRole">Rol/Posición *</Label>
                <Input
                  id="newStaffRole"
                  value={newStaffData.role || ''}
                  onChange={(e) => setNewStaffData({...newStaffData, role: e.target.value})}
                  placeholder="Ej: Médico General"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newStaffSpecialty">Especialidad *</Label>
                <Select
                  value={newStaffData.specialty || 'Medicina Interna'}
                  onValueChange={(value) => setNewStaffData({...newStaffData, specialty: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medicina Interna">Medicina Interna</SelectItem>
                    <SelectItem value="Odontología General">Odontología General</SelectItem>
                    <SelectItem value="Cuidados Intensivos">Cuidados Intensivos</SelectItem>
                    <SelectItem value="Cardiología">Cardiología</SelectItem>
                    <SelectItem value="Pediatría">Pediatría</SelectItem>
                    <SelectItem value="Urgencias">Urgencias</SelectItem>
                    <SelectItem value="Ginecología">Ginecología</SelectItem>
                    <SelectItem value="Cirugía General">Cirugía General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="newStaffStatus">Estado Inicial *</Label>
                <Select
                  value={newStaffData.status || 'available'}
                  onValueChange={(value) => setNewStaffData({...newStaffData, status: value as Staff['status']})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="busy">Ocupado</SelectItem>
                    <SelectItem value="off">No disponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newStaffPatients">Pacientes Iniciales</Label>
                <Input
                  id="newStaffPatients"
                  type="number"
                  value={newStaffData.patients || 0}
                  onChange={(e) => setNewStaffData({...newStaffData, patients: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="newStaffRating">Calificación Inicial</Label>
                <Select
                  value={newStaffData.rating?.toString() || '4.5'}
                  onValueChange={(value) => setNewStaffData({...newStaffData, rating: parseFloat(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4.0">4.0</SelectItem>
                    <SelectItem value="4.1">4.1</SelectItem>
                    <SelectItem value="4.2">4.2</SelectItem>
                    <SelectItem value="4.3">4.3</SelectItem>
                    <SelectItem value="4.4">4.4</SelectItem>
                    <SelectItem value="4.5">4.5</SelectItem>
                    <SelectItem value="4.6">4.6</SelectItem>
                    <SelectItem value="4.7">4.7</SelectItem>
                    <SelectItem value="4.8">4.8</SelectItem>
                    <SelectItem value="4.9">4.9</SelectItem>
                    <SelectItem value="5.0">5.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Información:</strong> Los campos marcados con * son obligatorios. El nuevo personal será agregado inmediatamente al sistema y estará disponible para asignar citas.
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Próximos pasos:</strong> Después de agregar al personal, podrás asignarle citas, enviar mensajes y gestionar su horario desde la tabla de personal.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewStaffOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNewStaff}>
                <Users className="h-4 w-4 mr-2" />
                Agregar Personal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Modal para agendar cita
  const ScheduleStaffModal = () => {
    if (!selectedStaff) return null;

    return (
      <Dialog open={scheduleStaffOpen} onOpenChange={setScheduleStaffOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendar Cita
            </DialogTitle>
            <DialogDescription>
              Agenda una cita con {selectedStaff.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedStaff.name}</p>
                <p className="text-sm text-gray-600">{selectedStaff.role} - {selectedStaff.specialty}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appointmentDate">Fecha *</Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label htmlFor="appointmentTime">Hora *</Label>
                <Select defaultValue="09:00">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">09:00</SelectItem>
                    <SelectItem value="09:30">09:30</SelectItem>
                    <SelectItem value="10:00">10:00</SelectItem>
                    <SelectItem value="10:30">10:30</SelectItem>
                    <SelectItem value="11:00">11:00</SelectItem>
                    <SelectItem value="11:30">11:30</SelectItem>
                    <SelectItem value="14:00">14:00</SelectItem>
                    <SelectItem value="14:30">14:30</SelectItem>
                    <SelectItem value="15:00">15:00</SelectItem>
                    <SelectItem value="15:30">15:30</SelectItem>
                    <SelectItem value="16:00">16:00</SelectItem>
                    <SelectItem value="16:30">16:30</SelectItem>
                    <SelectItem value="17:00">17:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="appointmentService">Servicio *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consulta General">Consulta General</SelectItem>
                  <SelectItem value="Chequeo Dental">Chequeo Dental</SelectItem>
                  <SelectItem value="Control Embarazo">Control Embarazo</SelectItem>
                  <SelectItem value="Evaluación Cardíaca">Evaluación Cardíaca</SelectItem>
                  <SelectItem value="Consulta Pediátrica">Consulta Pediátrica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="appointmentNotes">Notas (opcional)</Label>
              <textarea
                id="appointmentNotes"
                className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Añade notas adicionales sobre la cita..."
              />
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Confirmación:</strong> La cita será agendada automáticamente y se enviará una notificación al profesional.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setScheduleStaffOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleScheduleFromStaff}>
                <Calendar className="h-4 w-4 mr-2" />
                Agendar Cita
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      {renderManagementByIndustry()}
      <ViewAppointmentModal />
      <EditAppointmentModal />
      <NewAppointmentModal />
      <ViewServiceModal />
      <EditServiceModal />
      <NewServiceModal />
      <ViewStaffModal />
      <EditStaffModal />
      <NewStaffModal />
      <MessageStaffModal />
      <ScheduleStaffModal />
    </>
  );
}
