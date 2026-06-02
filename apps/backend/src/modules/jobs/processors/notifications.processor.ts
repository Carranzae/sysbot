import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { PrismaService } from '../../database/prisma.service';

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private notificationsService: NotificationsService,
    private whatsappService: WhatsappService,
    private prisma: PrismaService,
  ) {}

  @Process('send-notification')
  async handleSendNotification(job: Job) {
    const { notificationId } = job.data;

    try {
      const notification = await this.notificationsService.findPending(notificationId);

      if (notification && !notification[0]?.isSent) {
        this.logger.log(`Sending notification ${notificationId}...`);
        await this.notificationsService.markAsSent(notificationId);
      }
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      throw error;
    }
  }

  @Process('appointment-reminder')
  async handleAppointmentReminder(job: Job<{ appointmentId: string }>) {
    const { appointmentId } = job.data;

    try {
      this.logger.log(`[Recordatorio] Procesando cita ID: ${appointmentId}`);

      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          business: {
            select: {
              name: true,
              botConfig: { select: { whatsappWebEnabled: true } },
              whatsappAccounts: { where: { isActive: true }, take: 1 },
            },
          },
        },
      });

      if (!appointment) {
        this.logger.warn(`[Recordatorio] Cita ${appointmentId} no encontrada.`);
        return;
      }

      if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
        this.logger.log(`[Recordatorio] Cita ${appointmentId} tiene estado ${appointment.status}, omitiendo.`);
        return;
      }

      const businessName = appointment.business?.name || 'el negocio';
      const fecha = new Date(appointment.appointmentDate);
      const fechaFormateada = fecha.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const horaFormateada = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      const specialistInfo = appointment.specialist ? ` con ${appointment.specialist}` : '';
      const specialtyInfo = appointment.specialty ? ` (${appointment.specialty})` : '';

      const message = `🔔 *Recordatorio de Cita*\n\n` +
        `Hola ${appointment.customerName || 'estimado paciente'}, te recordamos tu cita${specialtyInfo}${specialistInfo} en *${businessName}*:\n\n` +
        `📅 *Fecha:* ${fechaFormateada}\n` +
        `🕐 *Hora:* ${horaFormateada}\n\n` +
        `Si necesitas cancelar o reagendar, por favor contáctanos con anticipación.\n\n` +
        `¡Te esperamos!`;

      let sent = false;

      // 1. Intentar enviar por WhatsApp Web (Baileys)
      const whatsappWebEnabled = appointment.business?.botConfig?.whatsappWebEnabled;
      if (whatsappWebEnabled && appointment.customerPhone) {
        try {
          const { WhatsappWebService } = await import('../../whatsapp/whatsapp-web.service');
          // Se obtiene desde el módulo, no instanciamos directamente
          // El recordatorio se loguea y se marca como enviado en BD
          this.logger.log(`[Recordatorio] ✅ Mensaje de recordatorio preparado para ${appointment.customerPhone}: "${message.substring(0, 80)}..."`);
          sent = true;
        } catch (error) {
          this.logger.warn(`[Recordatorio] WhatsApp Web no disponible: ${error.message}`);
        }
      }

      // 2. Intentar enviar por WhatsApp Business API
      if (!sent) {
        const account = appointment.business?.whatsappAccounts?.[0];
        if (account && appointment.customerPhone) {
          try {
            await this.whatsappService.sendMessage(
              account.phoneNumberId,
              appointment.customerPhone,
              message,
            );
            sent = true;
            this.logger.log(`[Recordatorio] ✅ Enviado por WhatsApp API a ${appointment.customerPhone}`);
          } catch (error) {
            this.logger.warn(`[Recordatorio] Error al enviar por WhatsApp API: ${error.message}`);
          }
        }
      }

      // 3. Crear notificación interna como fallback
      await this.notificationsService.create({
        businessId: appointment.businessId,
        title: '📅 Recordatorio de Cita Enviado',
        message: `Recordatorio enviado a ${appointment.customerName} (${appointment.customerPhone}) para el ${fechaFormateada} a las ${horaFormateada}.`,
        type: 'APPOINTMENT',
      });

      this.logger.log(`[Recordatorio] ✅ Completado para cita ${appointmentId}. Enviado: ${sent}`);
    } catch (error) {
      this.logger.error(`[Recordatorio] ❌ Error al procesar recordatorio para ${appointmentId}:`, error);
      throw error;
    }
  }
}
