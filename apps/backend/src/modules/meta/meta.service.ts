import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(private prisma: PrismaService) {}

  async getBusinessIdFromPageId(pageId: string): Promise<string | null> {
    const connection = await this.prisma.metaPlatformConnection.findFirst({
      where: {
        OR: [
          { messengerPageId: pageId },
          { instagramAccountId: pageId },
        ],
      },
      include: {
        business: true,
      },
    });

    return connection?.businessId || null;
  }

  async getMetaConnection(businessId: string) {
    return this.prisma.metaPlatformConnection.findUnique({
      where: { businessId },
    });
  }

  async createOrUpdateMetaConnection(businessId: string, data: any) {
    const normalized = { ...data };

    if (
      data.messengerConnected !== undefined ||
      data.messengerEnabled !== undefined ||
      data.messengerPageId !== undefined ||
      data.messengerAccessToken !== undefined
    ) {
      normalized.messengerConnected = data.messengerConnected ?? Boolean(data.messengerEnabled && data.messengerPageId && data.messengerAccessToken);
    }

    if (
      data.instagramConnected !== undefined ||
      data.instagramEnabled !== undefined ||
      data.instagramAccountId !== undefined ||
      data.instagramAccessToken !== undefined
    ) {
      normalized.instagramConnected = data.instagramConnected ?? Boolean(data.instagramEnabled && data.instagramAccountId && data.instagramAccessToken);
    }

    return this.prisma.metaPlatformConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        ...normalized,
      },
      update: normalized,
    });
  }

  async isValidVerifyToken(token?: string) {
    if (!token) {
      return false;
    }

    if (token === process.env.META_VERIFY_TOKEN) {
      return true;
    }

    const connection = await this.prisma.metaPlatformConnection.findFirst({
      where: {
        OR: [
          { messengerVerifyToken: token },
          { webhookVerified: true, messengerVerifyToken: token },
        ],
      },
      select: { id: true },
    });

    return Boolean(connection);
  }
}








