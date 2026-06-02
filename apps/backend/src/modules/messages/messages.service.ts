import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async createMessage(data: any) {
    return this.prisma.message.create({
      data,
    });
  }

  async findAll(businessId: string, limit: number = 50) {
    return this.prisma.message.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        whatsappAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.message.findUnique({
      where: { id },
    });
  }

  async updateMessageStatus(externalId: string, status: string) {
    return this.prisma.message.updateMany({
      where: { externalId },
      data: { status: status as any },
    });
  }

  async getConversationHistory(businessId: string, phoneNumber: string, limit: number = 10) {
    return this.prisma.message.findMany({
      where: {
        businessId,
        OR: [
          { from: phoneNumber },
          { to: phoneNumber },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getMessageStats(businessId: string) {
    const [total, aiHandled, avgProcessingTime] = await Promise.all([
      this.prisma.message.count({
        where: { businessId },
      }),
      this.prisma.message.count({
        where: { businessId, aiResponse: true },
      }),
      this.prisma.message.aggregate({
        where: {
          businessId,
          aiResponse: true,
          processingTime: { not: null },
        },
        _avg: {
          processingTime: true,
        },
      }),
    ]);

    return {
      total,
      aiHandled,
      avgProcessingTime: avgProcessingTime._avg.processingTime || 0,
      aiPercentage: total > 0 ? (aiHandled / total) * 100 : 0,
    };
  }
}
