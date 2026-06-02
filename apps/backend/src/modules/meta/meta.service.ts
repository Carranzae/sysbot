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
    return this.prisma.metaPlatformConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        ...data,
      },
      update: data,
    });
  }
}










