import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  PlanType,
  PlanInterval,
  PlanConfig,
  BusinessSubscription,
  DEFAULT_PLANS,
  getPlanByType,
  calculatePlanPrice,
  checkPlanLimit,
  hasFeature,
  getFeatureValue,
} from './entities/plan.entity';

export interface CheckLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  current: number;
  message?: string;
}

export interface SubscriptionCreateInput {
  businessId: string;
  planType: PlanType;
  interval: PlanInterval;
  industryType?: string;
  trialDays?: number;
}

export interface SubscriptionUpdateInput {
  planType?: PlanType;
  interval?: PlanInterval;
  cancelAtPeriodEnd?: boolean;
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== PLANES ====================

  async getAllPlans(): Promise<PlanConfig[]> {
    return DEFAULT_PLANS.filter(plan => plan.isActive);
  }

  async getPlanByType(type: PlanType): Promise<PlanConfig | null> {
    return getPlanByType(type) || null;
  }

  async getPlanPrice(
    planType: PlanType,
    interval: PlanInterval,
    industryType?: string,
  ): Promise<number> {
    return calculatePlanPrice(planType, interval, industryType);
  }

  // ==================== SUSCRIPCIONES ====================

  async getBusinessSubscription(businessId: string): Promise<BusinessSubscription | null> {
    try {
      const subscription = await this.prisma.businessSubscription.findFirst({
        where: {
          businessId,
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        // Crear suscripción FREE por defecto
        return this.createDefaultSubscription(businessId);
      }

      // Verificar si expiró
      if (new Date() > subscription.currentPeriodEnd) {
        await this.expireSubscription(subscription.id);
        return this.createDefaultSubscription(businessId);
      }

      return subscription as BusinessSubscription;
    } catch (error) {
      this.logger.error(`Error getting subscription for business ${businessId}:`, error);
      return this.createDefaultSubscription(businessId);
    }
  }

  async createSubscription(input: SubscriptionCreateInput): Promise<BusinessSubscription> {
    const { businessId, planType, interval, industryType, trialDays = 0 } = input;

    const plan = getPlanByType(planType);
    if (!plan) {
      throw new NotFoundException(`Plan ${planType} not found`);
    }

    // Calcular fechas
    const now = new Date();
    const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : undefined;
    const periodEnd = new Date(now.getTime() + (interval === PlanInterval.YEARLY ? 365 : 30) * 24 * 60 * 60 * 1000);

    // Cancelar suscripción activa anterior si existe
    await this.cancelActiveSubscriptions(businessId);

    const subscription = await this.prisma.businessSubscription.create({
      data: {
        businessId,
        planId: plan.id,
        planType,
        interval,
        status: 'ACTIVE',
        startDate: now,
        endDate: periodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        price: calculatePlanPrice(planType, interval, industryType),
        currency: 'USD',
      },
    });

    // Sincronizar con el modelo Business
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        planExpiresAt: periodEnd,
        isActive: true,
      },
    });

    this.logger.log(`Created ${planType} subscription for business ${businessId}`);
    return subscription as BusinessSubscription;
  }

  async updateSubscription(
    subscriptionId: string,
    input: SubscriptionUpdateInput,
    industryType?: string,
  ): Promise<BusinessSubscription> {
    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const updates: any = {};

    // Cambio de plan
    if (input.planType && input.planType !== subscription.planType) {
      const newPlan = getPlanByType(input.planType);
      if (!newPlan) {
        throw new NotFoundException(`Plan ${input.planType} not found`);
      }

      updates.planId = newPlan.id;
      updates.planType = input.planType;
      updates.price = calculatePlanPrice(input.planType, subscription.interval as PlanInterval, industryType);
    }

    // Cambio de intervalo
    if (input.interval && input.interval !== subscription.interval) {
      updates.interval = input.interval;
      updates.price = calculatePlanPrice(
        subscription.planType as PlanType,
        input.interval,
        industryType,
      );
    }

    // Cancelar al final del período
    if (input.cancelAtPeriodEnd !== undefined) {
      updates.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
    }

    updates.updatedAt = new Date();

    const updated = await this.prisma.businessSubscription.update({
      where: { id: subscriptionId },
      data: updates,
    });

    // Si cambió la fecha de fin, actualizar Business
    if (updates.endDate) {
      await this.prisma.business.update({
        where: { id: updated.businessId },
        data: { planExpiresAt: updates.endDate },
      });
    }

    this.logger.log(`Updated subscription ${subscriptionId}`);
    return updated as BusinessSubscription;
  }

  async cancelSubscription(subscriptionId: string): Promise<BusinessSubscription> {
    const subscription = await this.prisma.businessSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Cancelled subscription ${subscriptionId}`);
    return subscription as BusinessSubscription;
  }

  async expireSubscription(subscriptionId: string): Promise<void> {
    await this.prisma.businessSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'EXPIRED',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Expired subscription ${subscriptionId}`);
  }

  // ==================== LÍMITES Y CARACTERÍSTICAS ====================

  async checkUserLimit(businessId: string, currentUsers: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxUsers = getFeatureValue(subscription.planType, 'maxUsers') as number;

    if (maxUsers === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentUsers };
    }

    const result = checkPlanLimit(currentUsers, maxUsers);
    return {
      ...result,
      limit: maxUsers,
      current: currentUsers,
      message: result.allowed 
        ? `Puedes agregar ${result.remaining} usuario(s) más`
        : `Has alcanzado el límite de ${maxUsers} usuarios. Actualiza tu plan para agregar más.`,
    };
  }

  async checkBranchLimit(businessId: string, currentBranches: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxBranches = getFeatureValue(subscription.planType, 'maxBranches') as number;

    if (maxBranches === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentBranches };
    }

    const result = checkPlanLimit(currentBranches, maxBranches);
    return {
      ...result,
      limit: maxBranches,
      current: currentBranches,
      message: result.allowed
        ? `Puedes agregar ${result.remaining} sucursal(es) más`
        : `Has alcanzado el límite de ${maxBranches} sucursales. Actualiza tu plan para agregar más.`,
    };
  }

  async checkProductLimit(businessId: string, currentProducts: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxProducts = getFeatureValue(subscription.planType, 'maxProducts') as number;

    if (maxProducts === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentProducts };
    }

    const result = checkPlanLimit(currentProducts, maxProducts);
    return {
      ...result,
      limit: maxProducts,
      current: currentProducts,
      message: result.allowed
        ? `Puedes agregar ${result.remaining} producto(s) más`
        : `Has alcanzado el límite de ${maxProducts} productos. Actualiza tu plan para agregar más.`,
    };
  }

  async checkStudentLimit(businessId: string, currentStudents: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxStudents = getFeatureValue(subscription.planType, 'maxStudents') as number;

    if (maxStudents === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentStudents };
    }

    const result = checkPlanLimit(currentStudents, maxStudents);
    return {
      ...result,
      limit: maxStudents,
      current: currentStudents,
      message: result.allowed
        ? `Puedes agregar ${result.remaining} estudiante(s) más`
        : `Has alcanzado el límite de ${maxStudents} estudiantes. Actualiza tu plan para agregar más.`,
    };
  }

  async checkPropertyLimit(businessId: string, currentProperties: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxProperties = getFeatureValue(subscription.planType, 'maxProperties') as number;

    if (maxProperties === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentProperties };
    }

    const result = checkPlanLimit(currentProperties, maxProperties);
    return {
      ...result,
      limit: maxProperties,
      current: currentProperties,
      message: result.allowed
        ? `Puedes agregar ${result.remaining} propiedad(es) más`
        : `Has alcanzado el límite de ${maxProperties} propiedades. Actualiza tu plan para agregar más.`,
    };
  }

  async checkServiceLimit(businessId: string, currentServices: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxServices = getFeatureValue(subscription.planType, 'maxServices') as number;

    if (maxServices === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentServices };
    }

    const result = checkPlanLimit(currentServices, maxServices);
    return {
      ...result,
      limit: maxServices,
      current: currentServices,
      message: result.allowed
        ? `Puedes agregar ${result.remaining} servicio(s) más`
        : `Has alcanzado el límite de ${maxServices} servicios. Actualiza tu plan para agregar más.`,
    };
  }

  async checkCourseLimit(businessId: string, currentCourses: number): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxCourses = getFeatureValue(subscription.planType, 'maxCourses') as number;

    if (maxCourses === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentCourses };
    }

    const result = checkPlanLimit(currentCourses, maxCourses);
    return {
      ...result,
      limit: maxCourses,
      current: currentCourses,
      message: result.allowed
        ? `Puedes agregar ${result.remaining} curso(s) más`
        : `Has alcanzado el límite de ${maxCourses} cursos. Actualiza tu plan para agregar más.`,
    };
  }

  async checkConversationLimit(businessId: string, currentConversations: number = 0): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxConversations = getFeatureValue(subscription.planType, 'maxConversations') as number;

    // Si es FREE, verificar límite mensual
    if (subscription.planType === PlanType.FREE) {
      const currentMonthConversations = await this.getCurrentMonthConversations(businessId);
      const result = checkPlanLimit(currentMonthConversations, maxConversations);
      
      return {
        ...result,
        limit: maxConversations,
        current: currentMonthConversations,
        message: result.allowed
          ? `Te quedan ${result.remaining} conversaciones este mes`
          : `Has alcanzado el límite de ${maxConversations} conversaciones del plan FREE. Actualiza tu plan para continuar.`,
      };
    }

    if (maxConversations === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: currentConversations };
    }

    return {
      allowed: true,
      remaining: -1,
      limit: maxConversations,
      current: currentConversations,
    };
  }

  async hasFeatureAccess(businessId: string, feature: string): Promise<boolean> {
    const subscription = await this.getBusinessSubscription(businessId);
    return hasFeature(subscription.planType, feature as any);
  }

  async getPlanFeatures(businessId: string): Promise<Record<string, any>> {
    const subscription = await this.getBusinessSubscription(businessId);
    const plan = getPlanByType(subscription.planType);
    return plan?.features || {};
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private async createDefaultSubscription(businessId: string): Promise<BusinessSubscription> {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.businessSubscription.create({
      data: {
        businessId,
        planId: 'plan-free',
        planType: PlanType.FREE,
        interval: PlanInterval.MONTHLY,
        status: 'ACTIVE',
        startDate: now,
        endDate: periodEnd,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        price: 0,
        currency: 'USD',
        cancelAtPeriodEnd: false,
      },
    });

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        planExpiresAt: periodEnd,
        isActive: true,
      },
    });

    this.logger.log(`Created default FREE subscription for business ${businessId}`);
    return subscription as BusinessSubscription;
  }

  private async cancelActiveSubscriptions(businessId: string): Promise<void> {
    await this.prisma.businessSubscription.updateMany({
      where: {
        businessId,
        status: 'ACTIVE',
      },
      data: {
        status: 'CANCELLED',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      },
    });
  }

  private async getCurrentMonthConversations(businessId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Esta función usa el modelo Conversation
    const count = await this.prisma.conversation.count({
      where: {
        businessId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    return count;
  }

  async checkAppointmentLimit(businessId: string): Promise<CheckLimitResult> {
    const subscription = await this.getBusinessSubscription(businessId);
    const maxAppointments = getFeatureValue(subscription.planType, 'maxAppointmentsPerMonth') as number;

    if (maxAppointments === -1) {
      return { allowed: true, remaining: -1, limit: -1, current: 0 };
    }

    const currentMonthAppointments = await this.getCurrentMonthAppointments(businessId);
    const result = checkPlanLimit(currentMonthAppointments, maxAppointments);
    
    return {
      ...result,
      limit: maxAppointments,
      current: currentMonthAppointments,
      message: result.allowed
        ? `Te quedan ${result.remaining} citas este mes`
        : `Has alcanzado el límite de ${maxAppointments} citas de tu plan. Actualiza tu plan para continuar agendando.`,
    };
  }

  private async getCurrentMonthAppointments(businessId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return await this.prisma.appointment.count({
      where: {
        businessId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });
  }
}
