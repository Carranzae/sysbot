import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlanService } from '../plan/plan.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planService: PlanService,
    @InjectQueue('webhooks') private readonly webhookQueue: Queue,
  ) {}

  async triggerEvent(businessId: string, event: string, payload: any) {
    // --- PLAN CHECK ---
    const hasAccess = await this.planService.hasFeatureAccess(businessId, 'hasAdvancedWebhooks');
    if (!hasAccess) {
      this.logger.log(`[Webhooks] Skip triggerEvent for business ${businessId}: plan does not include webhooks.`);
      return;
    }

    const configs = await this.prisma.webhookConfig.findMany({
      where: {
        businessId,
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    if (configs.length === 0) return;

    for (const config of configs) {
      const timestamp = Date.now();
      const signature = this.generateSignature(config.secret || '', timestamp, payload);

      await this.webhookQueue.add('send-webhook', {
        url: config.url,
        event,
        payload,
        timestamp,
        signature,
        businessId,
      }, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      });
    }
  }

  private generateSignature(secret: string, timestamp: number, payload: any): string {
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  async create(businessId: string, data: { url: string; events: string[]; secret?: string }) {
    // --- PLAN CHECK ---
    const hasAccess = await this.planService.hasFeatureAccess(businessId, 'hasAdvancedWebhooks');
    if (!hasAccess) {
      throw new Error('Your plan does not include advanced webhooks.');
    }

    return this.prisma.webhookConfig.create({
      data: {
        businessId,
        ...data,
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.webhookConfig.findMany({
      where: { businessId },
    });
  }

  async remove(id: string, businessId: string) {
    return this.prisma.webhookConfig.delete({
      where: { id, businessId },
    });
  }
}
