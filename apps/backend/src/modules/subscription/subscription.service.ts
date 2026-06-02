import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async createSubscription(businessId: string, planType: string) {
    const plans = {
      BASIC: {
        features: ['WHATSAPP_WEB', 'AUTO_REPLY'],
        limits: { businesses: 1, messages: 100, aiTokens: 0, calls: 0, callMinutes: 0 }
      },
      STANDARD: {
        features: ['WHATSAPP_WEB', 'WHATSAPP_API', 'AUTO_REPLY', 'AI_BASIC'],
        limits: { businesses: 3, messages: 500, aiTokens: 10000, calls: 0, callMinutes: 0 }
      },
      PREMIUM: {
        features: ['WHATSAPP_WEB', 'WHATSAPP_API', 'AUTO_REPLY', 'AI_UNLIMITED', 'AUDIO_BASIC', 'CALLS_BASIC'],
        limits: { businesses: 10, messages: 1000, aiTokens: 50000, calls: 100, callMinutes: 300 }
      },
      ENTERPRISE: {
        features: ['WHATSAPP_WEB', 'WHATSAPP_API', 'AUTO_REPLY', 'AI_UNLIMITED', 'AUDIO_ADVANCED', 'CALLS_AI', 'CRM_INTEGRATION'],
        limits: { businesses: -1, messages: -1, aiTokens: -1, calls: -1, callMinutes: -1 }
      },
      ULTIMATE: {
        features: ['ALL_FEATURES'],
        limits: { businesses: -1, messages: -1, aiTokens: -1, calls: -1, callMinutes: -1 }
      }
    };

    const plan = plans[planType];
    const expiresAt = planType === 'BASIC' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.create({
      data: {
        businessId,
        planType,
        status: 'ACTIVE',
        expiresAt,
        features: plan.features,
        limits: plan.limits
      }
    });
  }

  async getSubscription(businessId: string) {
    return this.prisma.subscription.findFirst({
      where: { businessId, status: 'ACTIVE' }
    });
  }

  async canUseFeature(businessId: string, feature: string): Promise<boolean> {
    const subscription = await this.getSubscription(businessId);
    return subscription ? subscription.features.includes(feature) : false;
  }

  async checkLimits(businessId: string, resource: string, amount: number): Promise<boolean> {
    const subscription = await this.getSubscription(businessId);
    if (!subscription) return false;

    const limit = subscription.limits[resource];
    if (limit === -1) return true; // Ilimitado

    // Aquí iría la lógica para verificar el uso actual vs límite
    // Por ahora, retornamos true para simplificar
    return true;
  }

  async upgradeSubscription(businessId: string, newPlanType: string) {
    const currentSubscription = await this.getSubscription(businessId);
    
    if (currentSubscription) {
      return this.prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planType: newPlanType,
          updatedAt: new Date()
        }
      });
    }

    return this.createSubscription(businessId, newPlanType);
  }

  async cancelSubscription(businessId: string) {
    return this.prisma.subscription.updateMany({
      where: { businessId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    });
  }
}
