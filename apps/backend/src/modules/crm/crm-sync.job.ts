import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { CRMSyncService } from './crm-sync.service';

@Injectable()
export class CRMSyncJob {
  private readonly logger = new Logger(CRMSyncJob.name);

  constructor(
    private prisma: PrismaService,
    private crmSyncService: CRMSyncService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllBusinesses() {
    this.logger.log('[CRMSyncJob] Starting sync for all businesses');

    const connections = await this.prisma.cRMConnection.findMany({
      where: {
        isActive: true,
        isConnected: true,
        syncEnabled: true,
      },
    });

    this.logger.log(`[CRMSyncJob] Found ${connections.length} active CRM connections`);

    for (const connection of connections) {
      try {
        // TODO: Implementar sincronización bidireccional completa
        // Por ahora solo log
        this.logger.debug(`[CRMSyncJob] Syncing business ${connection.businessId}`);

        // Actualizar última sincronización
        await this.prisma.cRMConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      } catch (error) {
        this.logger.error(`[CRMSyncJob] Error syncing business ${connection.businessId}: ${error.message}`);
      }
    }
  }
}










