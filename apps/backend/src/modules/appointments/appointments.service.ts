import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlanService } from '../plan/plan.service';
import { GoogleCalendarService } from './google-calendar.service';
import axios from 'axios';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private planService: PlanService,
    private googleCalendar: GoogleCalendarService,
  ) {}

  /**
   * Valida que no haya conflictos de horarios antes de crear una cita
   */
  async validateNoConflicts(
    businessId: string,
    appointmentDate: Date,
    duration: number,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const startTime = new Date(appointmentDate);
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000); // duration en minutos

    const conflictingAppointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        status: { in: ['PENDING', 'CONFIRMED'] }, // Solo considerar citas activas
        appointmentDate: {
          gte: startTime,
          lt: endTime,
        },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      },
    });

    // Verificar también citas que terminan después de que esta empiece
    const overlappingAppointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        appointmentDate: {
          lt: startTime,
        },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      },
    });

    // Verificar si alguna cita existente se solapa
    for (const appointment of overlappingAppointments) {
      const existingEndTime = new Date(
        appointment.appointmentDate.getTime() + (appointment.duration || 60) * 60 * 1000,
      );
      if (existingEndTime > startTime) {
        return false; // Hay conflicto
      }
    }

    return conflictingAppointments.length === 0;
  }

  /**
   * Busca horarios disponibles por especialidad
   */
  async findAvailableSlotsBySpecialty(
    businessId: string,
    date: Date,
    specialty: string,
    duration: number = 60,
    startHour: number = 9,
    endHour: number = 18,
    customBusinessHours?: Record<string, { enabled: boolean; start: string; end: string }> | null,
  ): Promise<Date[]> {
    const allSlots = await this.findAvailableSlots(
      businessId,
      date,
      duration,
      startHour,
      endHour,
      customBusinessHours,
    );

    // Obtener citas ocupadas para esa especialidad ese día
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const occupiedAppointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        specialty: specialty ? { equals: specialty, mode: 'insensitive' } : undefined,
        appointmentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    // Filtrar slots que no están ocupados
    return allSlots.filter(slot => {
      const slotEnd = new Date(slot.getTime() + duration * 60 * 1000);
      return !occupiedAppointments.some(apt => {
        const aptStart = new Date(apt.appointmentDate);
        const aptEnd = new Date(aptStart.getTime() + apt.duration * 60 * 1000);
        return (slot >= aptStart && slot < aptEnd) || (slotEnd > aptStart && slotEnd <= aptEnd) || (slot <= aptStart && slotEnd >= aptEnd);
      });
    });
  }

  /**
   * Obtiene especialidades disponibles (desde citas existentes o archivos)
   */
  async getAvailableSpecialties(businessId: string): Promise<string[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        specialty: { not: null },
      },
      select: {
        specialty: true,
      },
      distinct: ['specialty'],
    });

    return appointments
      .map(apt => apt.specialty)
      .filter((s): s is string => s !== null && s.trim() !== '');
  }

  /**
   * Busca horarios disponibles en un rango de fechas
   */
  async findAvailableSlots(
    businessId: string,
    date: Date,
    duration: number = 60,
    startHour: number = 9,
    endHour: number = 18,
    customBusinessHours?: Record<string, { enabled: boolean; start: string; end: string }> | null,
  ): Promise<Date[]> {
    const availableSlots: Date[] = [];
    
    // Obtener el día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado)
    const dayOfWeek = date.getDay();
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const dayName = dayNames[dayOfWeek];
    
    // Si hay horarios personalizados para este día, usarlos
    let dayStartHour = startHour;
    let dayEndHour = endHour;
    let isDayEnabled = true;
    
    if (customBusinessHours && customBusinessHours[dayName]) {
      const dayConfig = customBusinessHours[dayName];
      isDayEnabled = dayConfig.enabled;
      if (dayConfig.enabled) {
        const [startH, startM] = dayConfig.start.split(':').map(Number);
        const [endH, endM] = dayConfig.end.split(':').map(Number);
        dayStartHour = startH;
        dayEndHour = endH;
      }
    }
    
    // Si el día está deshabilitado, retornar array vacío
    if (!isDayEnabled) {
      return [];
    }
    
    const startOfDay = new Date(date);
    startOfDay.setHours(dayStartHour, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(dayEndHour, 0, 0, 0);

    // Obtener todas las citas del día
    const dayStart = new Date(startOfDay);
    const dayEnd = new Date(endOfDay);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    // Generar slots cada 30 minutos
    const currentSlot = new Date(startOfDay);
    while (currentSlot < endOfDay) {
      const slotEnd = new Date(currentSlot.getTime() + duration * 60 * 1000);
      
      if (slotEnd <= endOfDay) {
        // Verificar si este slot está libre
        const hasConflict = existingAppointments.some((apt) => {
          const aptEnd = new Date(
            apt.appointmentDate.getTime() + (apt.duration || 60) * 60 * 1000,
          );
          return (
            (currentSlot >= apt.appointmentDate && currentSlot < aptEnd) ||
            (slotEnd > apt.appointmentDate && slotEnd <= aptEnd) ||
            (currentSlot <= apt.appointmentDate && slotEnd >= aptEnd)
          );
        });

        if (!hasConflict) {
          availableSlots.push(new Date(currentSlot));
        }
      }

      // Avanzar 30 minutos
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }

    return availableSlots;
  }

  async create(businessId: string, data: any) {
    console.log(`[AppointmentsService] create() llamado con businessId: ${businessId}`);
    console.log(`[AppointmentsService] Datos recibidos:`, JSON.stringify(data, null, 2));
    
    const appointmentDate = new Date(data.appointmentDate);
    const duration = data.duration || 60;

    console.log(`[AppointmentsService] Fecha procesada: ${appointmentDate.toISOString()}`);
    console.log(`[AppointmentsService] Duración: ${duration} minutos`);

    // --- PLAN CHECK: Limite mensual de citas ---
    const limitCheck = await this.planService.checkAppointmentLimit(businessId);
    if (!limitCheck.allowed) {
      console.log(`[AppointmentsService] ❌ LÍMITE ALCANZADO: ${limitCheck.message}`);
      throw new BadRequestException(limitCheck.message);
    }

    // Validar que no haya conflictos
    const isValid = await this.validateNoConflicts(businessId, appointmentDate, duration);
    if (!isValid) {
      console.log(`[AppointmentsService] ❌ CONFLICTO: Ya existe una cita en ese horario`);
      throw new ConflictException(
        'Ya existe una cita en ese horario. Por favor, elige otro horario.',
      );
    }

    console.log(`[AppointmentsService] ✅ Sin conflictos, creando cita en BD...`);
    
    // Try to create Google Calendar Event
    let finalNotes = data.notes || '';
    try {
      const eventId = await this.googleCalendar.createEvent(businessId, {
        ...data,
        appointmentDate,
        duration,
      });
      if (eventId) {
        finalNotes = this.googleCalendar.embedEventId(data.notes || '', eventId);
      }
    } catch (calErr: any) {
      console.error(`[AppointmentsService] Error al crear evento en Google Calendar: ${calErr.message}`);
    }

    try {
      const appointment = await this.prisma.appointment.create({
        data: {
          businessId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail || null,
          appointmentDate,
          duration,
          status: data.status || 'PENDING',
          notes: finalNotes || null,
          specialist: data.specialist || null,
          specialty: data.specialty || null,
          origin: data.origin || 'BOT',
        },
      });
      
      console.log(`[AppointmentsService] ✅ CITA CREADA EN BD:`);
      console.log(`  - ID: ${appointment.id}`);
      console.log(`  - BusinessId: ${appointment.businessId}`);
      console.log(`  - Cliente: ${appointment.customerName}`);
      console.log(`  - Teléfono: ${appointment.customerPhone}`);
      console.log(`  - Fecha: ${appointment.appointmentDate}`);
      console.log(`  - Estado: ${appointment.status}`);
      
      return appointment;
    } catch (error: any) {
      console.error(`[AppointmentsService] ❌ ERROR AL CREAR CITA EN BD:`, error);
      console.error(`[AppointmentsService] Stack:`, error.stack);
      throw error;
    }
  }

  async findAll(businessId: string) {
    console.log(`[AppointmentsService] findAll called for businessId: ${businessId}`);
    const appointments = await this.prisma.appointment.findMany({
      where: { businessId },
      orderBy: { appointmentDate: 'asc' },
    });
    console.log(`[AppointmentsService] Found ${appointments.length} appointments for businessId: ${businessId}`);
    return appointments;
  }

  async findUpcoming(businessId: string) {
    return this.prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { appointmentDate: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
      include: { business: true }
    });

    if (!existing) {
      throw new BadRequestException('La cita no existe');
    }

    let finalNotes = data.notes !== undefined ? data.notes : existing.notes;
    let eventId = this.googleCalendar.extractEventId(existing.notes);

    if (eventId) {
      // Sync update to Google Calendar
      try {
        const mergedAppointment = {
          ...existing,
          ...data,
          notes: finalNotes,
        };
        await this.googleCalendar.updateEvent(existing.businessId, eventId, mergedAppointment);
      } catch (calErr: any) {
        console.error(`[AppointmentsService] Error al actualizar Google Calendar: ${calErr.message}`);
      }
    } else {
      // If there wasn't an event, try to create one
      try {
        const mergedAppointment = {
          ...existing,
          ...data,
          notes: finalNotes,
        };
        const newEventId = await this.googleCalendar.createEvent(existing.businessId, mergedAppointment);
        if (newEventId) {
          finalNotes = this.googleCalendar.embedEventId(finalNotes, newEventId);
          data.notes = finalNotes; // Inject into data to be saved below
        }
      } catch (calErr: any) {
        console.error(`[AppointmentsService] Error al crear Google Calendar: ${calErr.message}`);
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data,
    });

    if (existing && existing.business.industryType === 'CLINIC') {
      // 1. Sincronizar con el EHR de Contact.metadata
      await this.syncWithEHR(existing.businessId, existing.customerPhone, updated.id, updated.status);

      // 2. Si cambia a CANCELLED, notificar lista de espera
      if (data.status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        await this.triggerSmartWaitlistNotification(existing);
      }
    }

    return updated;
  }

  /**
   * Sincroniza y almacena el estado e historial clínico en el expediente del paciente (Contact.metadata)
   */
  async syncWithEHR(businessId: string, customerPhone: string, appointmentId: string, status: string): Promise<void> {
    try {
      const contact = await this.prisma.contact.findFirst({
        where: { phone: customerPhone, businessId }
      });

      if (contact) {
        let metadataObj = contact.metadata ? (typeof contact.metadata === 'string' ? JSON.parse(contact.metadata) : contact.metadata) as any : {};
        if (!metadataObj.ehrHistory) {
          metadataObj.ehrHistory = [];
        }
        metadataObj.ehrHistory.push({
          appointmentId,
          status,
          updatedAt: new Date(),
          action: `Actualización de cita médica a estado: ${status}`,
        });

        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { metadata: metadataObj }
        });
        console.log(`[EHR Sync] Sincronización exitosa con expediente del paciente ${contact.phone}`);

        // Sincronización de regreso (Outbound Sync back to Clinic HIS Webhook)
        const business = await this.prisma.business.findUnique({
          where: { id: businessId },
          select: { paymentWebhookUrl: true }
        });

        if (business?.paymentWebhookUrl) {
          console.log(`[EHR Outbound Webhook] Sincronizando estado ${status} de cita ${appointmentId} al HIS de la clínica: ${business.paymentWebhookUrl}`);
          try {
            await axios.post(business.paymentWebhookUrl, {
              event: 'appointment.status_updated',
              appointmentId,
              customerPhone,
              status,
              updatedAt: new Date()
            }, {
              headers: { 'Content-Type': 'application/json' }
            });
            console.log(`[EHR Outbound Webhook] Webhook enviado con éxito.`);
          } catch (webhookErr: any) {
            console.error(`[EHR Outbound Webhook] Falló envío de webhook al HIS: ${webhookErr.message}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[EHR Sync] Error al sincronizar expediente: ${err.message}`);
    }
  }

  /**
   * Dispara notificaciones automatizadas a la lista de espera al liberarse un cupo
   */
  private async triggerSmartWaitlistNotification(appointment: any): Promise<void> {
    console.log(`[Waitlist] Disparando lista de espera inteligente para la cita cancelada ${appointment.id}`);
    
    // 1. Encontrar contactos con el tag 'LISTA_DE_ESPERA'
    const matchingContacts = await this.prisma.contact.findMany({
      where: {
        businessId: appointment.businessId,
        tags: {
          some: {
            label: {
              in: ['LISTA_DE_ESPERA', 'lista_de_espera', 'waitlist', 'Waitlist']
            }
          }
        }
      },
      include: {
        tags: true
      }
    });

    if (matchingContacts.length === 0) {
      console.log(`[Waitlist] No hay pacientes en lista de espera para el negocio ${appointment.businessId}`);
      return;
    }

    // Filtrar contactos que coincidan con la especialidad (si está guardada en sus tags o notas)
    const specialty = appointment.specialty ? appointment.specialty.toLowerCase() : '';
    const candidates = matchingContacts.filter(c => {
      return c.tags.some(t => t.label.toLowerCase().includes(specialty) || t.label.toLowerCase() === 'lista_de_espera');
    });

    if (candidates.length === 0) {
      console.log(`[Waitlist] No hay pacientes en la lista de espera con tag específico para la especialidad ${specialty}`);
      return;
    }

    console.log(`[Waitlist] Encontrados ${candidates.length} candidatos para ocupar el turno de ${appointment.specialty}`);

    // Enviar mensaje automático (registrándolo en la tabla Message para que figure en el panel del admin)
    for (const cand of candidates.slice(0, 3)) { // Notificar a los 3 primeros
      const notificationContent = `¡Hola ${cand.name || 'Paciente'}! Se ha liberado un turno para la especialidad de ${appointment.specialty} el día ${appointment.appointmentDate.toLocaleDateString('es-ES')} a las ${appointment.appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}. Si deseas tomar este turno, responde *TOMAR TURNO* inmediatamente.`;
      
      await this.prisma.message.create({
        data: {
          businessId: appointment.businessId,
          direction: 'OUTBOUND',
          content: notificationContent,
          from: '',
          to: cand.phone,
          platform: 'WHATSAPP_WEB',
          status: 'SENT',
        }
      });
      console.log(`[Waitlist] Notificación de lista de espera enviada al contacto ${cand.phone}`);
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (existing) {
      const eventId = this.googleCalendar.extractEventId(existing.notes);
      if (eventId) {
        try {
          await this.googleCalendar.deleteEvent(existing.businessId, eventId);
        } catch (calErr: any) {
          console.error(`[AppointmentsService] Error al eliminar Google Calendar: ${calErr.message}`);
        }
      }
    }

    return this.prisma.appointment.delete({
      where: { id },
    });
  }

  /**
   * Normaliza un número de teléfono para búsqueda precisa
   * Remueve espacios, guiones, paréntesis, @, +, y deja solo dígitos
   */
  private normalizePhone(phone: string): string {
    if (!phone) return '';
    // Remover todo excepto dígitos
    let normalized = phone.replace(/[^\d]/g, '').trim();
    // Si empieza con 0, removerlo (puede ser código de país mal formateado)
    if (normalized.startsWith('0') && normalized.length > 9) {
      normalized = normalized.substring(1);
    }
    return normalized;
  }

  /**
   * Compara dos teléfonos normalizados con diferentes estrategias de coincidencia
   */
  private phoneMatches(phone1: string, phone2: string): boolean {
    const norm1 = this.normalizePhone(phone1);
    const norm2 = this.normalizePhone(phone2);
    
    if (!norm1 || !norm2) return false;
    
    // Coincidencia exacta
    if (norm1 === norm2) return true;
    
    // Coincidencia por últimos 9 dígitos (para manejar diferentes formatos de código de país)
    if (norm1.length >= 9 && norm2.length >= 9) {
      const last9_1 = norm1.slice(-9);
      const last9_2 = norm2.slice(-9);
      if (last9_1 === last9_2) return true;
    }
    
    // Coincidencia por últimos 8 dígitos (para números locales)
    if (norm1.length >= 8 && norm2.length >= 8) {
      const last8_1 = norm1.slice(-8);
      const last8_2 = norm2.slice(-8);
      if (last8_1 === last8_2 && norm1.length === norm2.length) return true;
    }
    
    return false;
  }

  /**
   * Busca citas por número de teléfono del cliente
   * Búsqueda precisa en la base de datos usando normalización mejorada
   */
  async findByPhone(businessId: string, phone: string) {
    if (!phone || !phone.trim()) {
      return [];
    }

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      console.log(`[AppointmentsService] Teléfono inválido o muy corto: ${phone} -> ${normalizedPhone}`);
      return [];
    }

    console.log(`[AppointmentsService] Buscando citas para teléfono normalizado: ${normalizedPhone} (original: ${phone})`);
    
    // Obtener todas las citas del negocio
    const allAppointments = await this.prisma.appointment.findMany({
      where: { businessId },
      orderBy: { appointmentDate: 'desc' },
    });
    
    console.log(`[AppointmentsService] Total de citas en BD para businessId ${businessId}: ${allAppointments.length}`);
    
    // Filtrar por teléfono normalizado con comparación precisa
    const matchingAppointments = allAppointments.filter(apt => {
      if (!apt.customerPhone) return false;
      const matches = this.phoneMatches(apt.customerPhone, normalizedPhone);
      if (matches) {
        console.log(`[AppointmentsService] Cita encontrada: ID=${apt.id}, Cliente=${apt.customerName}, Teléfono=${apt.customerPhone}, Fecha=${apt.appointmentDate}`);
      }
      return matches;
    });
    
    console.log(`[AppointmentsService] Citas encontradas: ${matchingAppointments.length}`);
    return matchingAppointments;
  }

  /**
   * Normaliza un nombre para búsqueda (remueve acentos, espacios extra, convierte a minúsculas)
   */
  private normalizeName(name: string): string {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/\s+/g, ' '); // Normalizar espacios
  }

  /**
   * Compara dos nombres con coincidencia flexible pero precisa
   */
  private nameMatches(name1: string, name2: string): boolean {
    const norm1 = this.normalizeName(name1);
    const norm2 = this.normalizeName(name2);
    
    if (!norm1 || !norm2) return false;
    
    // Coincidencia exacta
    if (norm1 === norm2) return true;
    
    // Coincidencia parcial: si uno contiene al otro (para nombres completos vs parciales)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      // Verificar que la coincidencia sea significativa (al menos 3 caracteres)
      const minLength = Math.min(norm1.length, norm2.length);
      if (minLength >= 3) return true;
    }
    
    // Coincidencia por palabras: si todas las palabras de uno están en el otro
    const words1 = norm1.split(' ').filter(w => w.length >= 2);
    const words2 = norm2.split(' ').filter(w => w.length >= 2);
    
    if (words1.length > 0 && words2.length > 0) {
      // Verificar que al menos 2 palabras coincidan (para nombres completos)
      const matchingWords = words1.filter(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)));
      if (matchingWords.length >= Math.min(2, Math.min(words1.length, words2.length))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Busca citas por nombre y/o teléfono del cliente
   * Búsqueda precisa en la base de datos con verificación cruzada
   */
  async findByNameAndPhone(businessId: string, name?: string, phone?: string) {
    if ((!name || !name.trim()) && (!phone || !phone.trim())) {
      console.log(`[AppointmentsService] findByNameAndPhone: No se proporcionó nombre ni teléfono`);
      return [];
    }

    console.log(`[AppointmentsService] Buscando citas por nombre: "${name}" y teléfono: "${phone}"`);
    
    const allAppointments = await this.prisma.appointment.findMany({
      where: { businessId },
      orderBy: { appointmentDate: 'desc' },
    });

    console.log(`[AppointmentsService] Total de citas en BD para businessId ${businessId}: ${allAppointments.length}`);

    const matchingAppointments = allAppointments.filter(apt => {
      let matches = true;

      // Si se proporciona nombre, verificar coincidencia
      if (name && name.trim()) {
        const nameMatch = this.nameMatches(apt.customerName || '', name);
        if (!nameMatch) {
          console.log(`[AppointmentsService] Nombre no coincide: "${apt.customerName}" vs "${name}"`);
        }
        matches = matches && nameMatch;
      }

      // Si se proporciona teléfono, verificar coincidencia
      if (phone && phone.trim()) {
        const phoneMatch = this.phoneMatches(apt.customerPhone || '', phone);
        if (!phoneMatch) {
          console.log(`[AppointmentsService] Teléfono no coincide: "${apt.customerPhone}" vs "${phone}"`);
        }
        matches = matches && phoneMatch;
      }

      if (matches) {
        console.log(`[AppointmentsService] Cita encontrada: ID=${apt.id}, Cliente=${apt.customerName}, Teléfono=${apt.customerPhone}, Fecha=${apt.appointmentDate}`);
      }

      return matches;
    });

    console.log(`[AppointmentsService] Citas encontradas por nombre y teléfono: ${matchingAppointments.length}`);
    return matchingAppointments;
  }

  /**
   * Obtiene citas disponibles para mostrar al cliente
   */
  async getAvailableAppointmentsInfo(businessId: string, daysAhead: number = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: {
          gte: today,
          lte: endDate,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { appointmentDate: 'asc' },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        appointmentDate: true,
        duration: true,
        status: true,
        notes: true,
      },
    });

    return appointments;
  }
}
