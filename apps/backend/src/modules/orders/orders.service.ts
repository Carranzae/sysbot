import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { generateOrderNumber } from '@syst/shared';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, data: any) {
    return this.prisma.order.create({
      data: {
        businessId,
        orderNumber: generateOrderNumber(),
        ...data,
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.order.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.order.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.order.delete({
      where: { id },
    });
  }

  async getStats(businessId: string) {
    const [total, pending, completed, totalRevenue] = await Promise.all([
      this.prisma.order.count({ where: { businessId } }),
      this.prisma.order.count({ where: { businessId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { businessId, status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { businessId, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      total,
      pending,
      completed,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
    };
  }
}
