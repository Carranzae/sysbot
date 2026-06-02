import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlanService } from '../plan/plan.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planService: PlanService,
  ) {}

  async createKey(businessId: string, name: string) {
    // --- PLAN CHECK ---
    const hasAccess = await this.planService.hasFeatureAccess(businessId, 'hasCustomApiKeys');
    if (!hasAccess) {
      throw new Error('Your plan does not include custom API keys.');
    }

    const key = `syst_${crypto.randomBytes(24).toString('hex')}`;
    const secret = crypto.randomBytes(32).toString('hex');

    return this.prisma.apiKey.create({
      data: {
        businessId,
        name,
        key,
        secret,
      },
    });
  }

  async validateKey(key: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key, isActive: true },
      include: { business: true },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API Key has expired');
    }

    // Update last used
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKey.business;
  }

  async findAll(businessId: string) {
    return this.prisma.apiKey.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        key: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
      },
    });
  }

  async revoke(id: string, businessId: string) {
    return this.prisma.apiKey.update({
      where: { id, businessId },
      data: { isActive: false },
    });
  }
}
