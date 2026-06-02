import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('campaigns') private readonly campaignsQueue: Queue,
    @InjectQueue('whatsapp-messages') private readonly whatsappQueue: Queue,
    @InjectQueue('social') private readonly socialQueue: Queue,
  ) {}

  async scheduleNotification(notificationId: string, scheduledAt: Date) {
    const delay = scheduledAt.getTime() - Date.now();

    if (delay > 0) {
      await this.notificationsQueue.add(
        'send-notification',
        { notificationId },
        { delay },
      );
    } else {
      await this.notificationsQueue.add('send-notification', { notificationId });
    }
  }

  async scheduleAppointmentReminder(appointmentId: string, appointmentDate: Date) {
    const reminderTime = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
    const now = Date.now();
    const delay = reminderTime.getTime() - now;

    // Si la cita es en el futuro
    if (appointmentDate.getTime() > now) {
      await this.notificationsQueue.add(
        'appointment-reminder',
        { appointmentId },
        { 
          delay: Math.max(0, delay),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          }
        },
      );
    }
  }

  async queueCampaignDispatch(campaignId: string, scheduledAt?: Date) {
    const delay = scheduledAt ? scheduledAt.getTime() - Date.now() : 0;
    const options = delay > 0 ? { delay } : undefined;

    await this.campaignsQueue.add('dispatch-campaign', { campaignId }, options);
  }

  async queueWhatsappMessage(businessId: string, message: any) {
    // Usar businessId como llave de grupo (si BullMQ lo soporta o vía data) 
    // para mantener orden relativo si fuera necesario
    await this.whatsappQueue.add('process-message', { businessId, message }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });
  }

  async queueSocialPost(postId: string, scheduledAt?: Date) {
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
    
    await this.socialQueue.add('publish-social-post', { postId }, { 
      delay,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1 minuto inicial
      },
      removeOnComplete: true,
    });
  }
}
