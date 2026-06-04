import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOauthService } from '../oauth/google-oauth.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly regexEventId = /\[GoogleEventId:\s*([a-zA-Z0-9_\-]+)\]/;

  constructor(
    private readonly googleOauth: GoogleOauthService,
  ) {}

  /**
   * Extrae el ID del evento de Google Calendar de las notas del appointment
   */
  extractEventId(notes: string | null): string | null {
    if (!notes) return null;
    const match = notes.match(this.regexEventId);
    return match ? match[1] : null;
  }

  /**
   * Remueve la marca del ID del evento de las notas para no mostrarla al cliente
   */
  cleanNotes(notes: string | null): string {
    if (!notes) return '';
    return notes.replace(this.regexEventId, '').trim();
  }

  /**
   * Agrega la marca del ID del evento a las notas
   */
  embedEventId(notes: string | null, eventId: string): string {
    const cleaned = this.cleanNotes(notes);
    return `${cleaned}\n\n[GoogleEventId: ${eventId}]`.trim();
  }

  /**
   * Crea un evento en Google Calendar para un negocio y cita dados
   */
  async createEvent(businessId: string, appointment: any): Promise<string | null> {
    const auth = await this.googleOauth.getValidClientForBusiness(businessId);
    if (!auth) {
      this.logger.debug(`[GoogleCalendar] Google OAuth no configurado para negocio ${businessId}. Saltando sincronización.`);
      return null;
    }

    const calendar = google.calendar({ version: 'v3', auth });
    const startTime = new Date(appointment.appointmentDate);
    const endTime = new Date(startTime.getTime() + (appointment.duration || 60) * 60 * 1000);

    const displayNotes = this.cleanNotes(appointment.notes);

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `Reserva - ${appointment.customerName}`,
          description: `Paciente/Cliente: ${appointment.customerName}\nTeléfono: ${appointment.customerPhone}\nNotas: ${displayNotes}\nEspecialidad: ${appointment.specialty || 'General'}\nOrigen: ${appointment.origin}`,
          start: {
            dateTime: startTime.toISOString(),
          },
          end: {
            dateTime: endTime.toISOString(),
          },
          status: 'confirmed',
        },
      });

      const eventId = response.data.id || null;
      if (eventId) {
        this.logger.log(`[GoogleCalendar] Evento creado exitosamente en Google Calendar con ID: ${eventId}`);
      }
      return eventId;
    } catch (error: any) {
      this.logger.error(`[GoogleCalendar] Error al crear evento: ${error.message}`);
      return null;
    }
  }

  /**
   * Actualiza un evento existente en Google Calendar
   */
  async updateEvent(businessId: string, eventId: string, appointment: any): Promise<void> {
    const auth = await this.googleOauth.getValidClientForBusiness(businessId);
    if (!auth) return;

    const calendar = google.calendar({ version: 'v3', auth });
    const startTime = new Date(appointment.appointmentDate);
    const endTime = new Date(startTime.getTime() + (appointment.duration || 60) * 60 * 1000);

    const displayNotes = this.cleanNotes(appointment.notes);

    try {
      await calendar.events.update({
        calendarId: 'primary',
        eventId,
        requestBody: {
          summary: `Reserva [${appointment.status}] - ${appointment.customerName}`,
          description: `Paciente/Cliente: ${appointment.customerName}\nTeléfono: ${appointment.customerPhone}\nNotas: ${displayNotes}\nEspecialidad: ${appointment.specialty || 'General'}\nOrigen: ${appointment.origin}\nEstado Cita: ${appointment.status}`,
          start: {
            dateTime: startTime.toISOString(),
          },
          end: {
            dateTime: endTime.toISOString(),
          },
          status: appointment.status === 'CANCELLED' ? 'cancelled' : 'confirmed',
        },
      });
      this.logger.log(`[GoogleCalendar] Evento ${eventId} actualizado exitosamente.`);
    } catch (error: any) {
      this.logger.error(`[GoogleCalendar] Error al actualizar evento ${eventId}: ${error.message}`);
    }
  }

  /**
   * Elimina un evento de Google Calendar
   */
  async deleteEvent(businessId: string, eventId: string): Promise<void> {
    const auth = await this.googleOauth.getValidClientForBusiness(businessId);
    if (!auth) return;

    const calendar = google.calendar({ version: 'v3', auth });

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
      this.logger.log(`[GoogleCalendar] Evento ${eventId} eliminado de Google Calendar.`);
    } catch (error: any) {
      this.logger.error(`[GoogleCalendar] Error al eliminar evento ${eventId}: ${error.message}`);
    }
  }
}
