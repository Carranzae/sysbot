import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminService } from '../admin/admin.service';
import { JobsService } from './jobs.service';
import { PrismaService } from '../database/prisma.service';
import { PlanService } from '../plan/plan.service';

@Injectable()
export class TaskSchedulerService {
    private readonly logger = new Logger(TaskSchedulerService.name);

    constructor(
        private readonly adminService: AdminService,
        private readonly jobsService: JobsService,
        private readonly prisma: PrismaService,
        private readonly planService: PlanService,
    ) { }

    // Verificar expiración de planes cada día a medianoche
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handlePlanExpirations() {
        this.logger.log('Starting automated plan expiration check...');
        try {
            await this.adminService.checkPlanExpirations();
            this.logger.log('Plan expiration check completed successfully.');
        } catch (error) {
            this.logger.error('Error during automated plan expiration check:', error);
        }
    }

    // Enviar recordatorios de citas cada día a las 9:00 AM
    @Cron('0 9 * * *')
    async handleAppointmentReminders() {
        this.logger.log('[Scheduler] Buscando citas para recordatorio del día de mañana...');
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            const upcomingAppointments = await this.prisma.appointment.findMany({
                where: {
                    appointmentDate: {
                        gte: tomorrow,
                        lt: dayAfterTomorrow,
                    },
                    status: { in: ['PENDING', 'CONFIRMED'] },
                },
                select: { id: true, customerName: true, appointmentDate: true, businessId: true },
            });

            this.logger.log(`[Scheduler] Encontradas ${upcomingAppointments.length} citas para mañana. Verificando planes y encolando recordatorios...`);

            let queuedCount = 0;
            for (const appointment of upcomingAppointments as any) {
                const hasReminders = await this.planService.hasFeatureAccess(appointment.businessId, 'hasReminders');
                
                if (hasReminders) {
                    await this.jobsService.scheduleAppointmentReminder(appointment.id, appointment.appointmentDate);
                    this.logger.log(`[Scheduler] Recordatorio encolado para: ${appointment.customerName} (${appointment.id})`);
                    queuedCount++;
                } else {
                    this.logger.log(`[Scheduler] Negocio ${appointment.businessId} NO tiene habilitados los recordatorios. Saltando.`);
                }
            }

            this.logger.log(`[Scheduler] ✅ ${queuedCount} recordatorios encolados con éxito.`);
        } catch (error) {
            this.logger.error('[Scheduler] Error al encolar recordatorios de citas:', error);
        }
    }
}
