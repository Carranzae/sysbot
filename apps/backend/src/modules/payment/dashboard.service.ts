import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentGateway, PaymentStatus } from '@prisma/client';

export interface RealTimePaymentData {
  businessId: string;
  totalPayments: number;
  totalAmount: number;
  pendingPayments: number;
  pendingAmount: number;
  completedPayments: number;
  completedAmount: number;
  failedPayments: number;
  failedAmount: number;
  successRate: number;
  averageAmount: number;
  recentPayments: any[];
  gatewayStats: { [key: string]: { count: number; amount: number } };
  hourlyStats: { [key: string]: { count: number; amount: number } };
}

export interface PaymentMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  conversionRate: number;
  averageTransactionValue: number;
  paymentMethodsUsage: { [key: string]: number };
  peakHours: { hour: number; count: number }[];
  customerRetention: number;
  churnRate: number;
}

@Injectable()
export class PaymentDashboardService {
  private readonly logger = new Logger(PaymentDashboardService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene datos en tiempo real para el dashboard de pagos
   */
  async getRealTimePaymentData(businessId: string, timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<RealTimePaymentData> {
    try {
      this.logger.log(`[PaymentDashboard] Getting real-time data for business ${businessId}`);

      const dateFilter = this.getDateFilter(timeRange);

      // Estadísticas generales
      const stats = await this.getPaymentStats(businessId, dateFilter.startDate, dateFilter.endDate);
      
      // Pagos recientes
      const recentPayments = await this.getRecentPayments(businessId, 10);
      
      // Estadísticas por gateway
      const gatewayStats = await this.getGatewayStats(businessId, dateFilter.startDate, dateFilter.endDate);
      
      // Estadísticas por hora
      const hourlyStats = await this.getHourlyStats(businessId, dateFilter.startDate, dateFilter.endDate);

      return {
        businessId,
        totalPayments: stats.total.count,
        totalAmount: Number(stats.total.amount) || 0,
        pendingPayments: stats.byStatus.PENDING?.count || 0,
        pendingAmount: Number(stats.byStatus.PENDING?.amount) || 0,
        completedPayments: stats.byStatus.COMPLETED?.count || 0,
        completedAmount: Number(stats.byStatus.COMPLETED?.amount) || 0,
        failedPayments: stats.byStatus.FAILED?.count || 0,
        failedAmount: Number(stats.byStatus.FAILED?.amount) || 0,
        successRate: stats.successRate,
        averageAmount: stats.total.count > 0 ? (Number(stats.total.amount) || 0) / stats.total.count : 0,
        recentPayments,
        gatewayStats,
        hourlyStats
      };
    } catch (error) {
      this.logger.error(`[PaymentDashboard] Error getting real-time data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene métricas avanzadas de pagos
   */
  async getPaymentMetrics(businessId: string, timeRange: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<PaymentMetrics> {
    try {
      this.logger.log(`[PaymentDashboard] Getting payment metrics for business ${businessId}`);

      const dateFilter = this.getDateFilter(timeRange);
      const previousDateFilter = this.getPreviousDateFilter(timeRange);

      // Ingresos totales y crecimiento
      const currentRevenue = await this.getTotalRevenue(businessId, dateFilter.startDate, dateFilter.endDate);
      const previousRevenue = await this.getTotalRevenue(businessId, previousDateFilter.startDate, previousDateFilter.endDate);
      const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      // Tasa de conversión
      const conversionRate = await this.getConversionRate(businessId, dateFilter.startDate, dateFilter.endDate);

      // Valor promedio de transacción
      const avgTransactionValue = await this.getAverageTransactionValue(businessId, dateFilter.startDate, dateFilter.endDate);

      // Uso de métodos de pago
      const paymentMethodsUsage = await this.getPaymentMethodsUsage(businessId, dateFilter.startDate, dateFilter.endDate);

      // Horas pico
      const peakHours = await this.getPeakHours(businessId, dateFilter.startDate, dateFilter.endDate);

      // Retención y churn de clientes
      const customerRetention = await this.getCustomerRetention(businessId, dateFilter.startDate, dateFilter.endDate);
      const churnRate = 100 - customerRetention;

      return {
        totalRevenue: currentRevenue,
        revenueGrowth,
        conversionRate,
        averageTransactionValue: avgTransactionValue,
        paymentMethodsUsage,
        peakHours,
        customerRetention,
        churnRate
      };
    } catch (error) {
      this.logger.error(`[PaymentDashboard] Error getting payment metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas básicas de pagos
   */
  private async getPaymentStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      businessId,
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      status: {
        in: ['COMPLETED' as PaymentStatus, 'FAILED' as PaymentStatus, 'PENDING' as PaymentStatus]
      }
    };

    const stats = await this.prisma.automatedPayment.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    const totalStats = await this.prisma.automatedPayment.aggregate({
      where: whereClause,
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    return {
      total: {
        count: totalStats._count.id,
        amount: totalStats._sum.amount || 0
      },
      byStatus: stats.reduce((acc: any, item) => {
        acc[item.status] = {
          count: item._count.id,
          amount: item._sum.amount || 0
        };
        return acc;
      }, {}),
      successRate: totalStats._count.id > 0 
        ? (stats.find(s => s.status === 'COMPLETED')?._count.id || 0) / totalStats._count.id 
        : 0
    };
  }

  /**
   * Obtiene pagos recientes
   */
  private async getRecentPayments(businessId: string, limit: number = 10) {
    return await this.prisma.automatedPayment.findMany({
      where: {
        businessId,
        status: {
          in: ['COMPLETED', 'PENDING']
        }
      },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        amount: true,
        currency: true,
        status: true,
        gateway: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }

  /**
   * Obtiene estadísticas por gateway
   */
  private async getGatewayStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      businessId,
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      status: 'COMPLETED' as PaymentStatus
    };

    const stats = await this.prisma.automatedPayment.groupBy({
      by: ['gateway'],
      where: whereClause,
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    return stats.reduce((acc, item) => {
      acc[item.gateway] = {
        count: item._count.id,
        amount: Number(item._sum.amount) || 0
      };
      return acc;
    }, {});
  }

  /**
   * Obtiene estadísticas por hora
   */
  private async getHourlyStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      businessId,
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      status: 'COMPLETED' as PaymentStatus
    };

    // Para estadísticas por hora, necesitamos hacer una consulta más compleja
    // Por ahora, agrupamos por día y hora
    const payments = await this.prisma.automatedPayment.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        amount: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const hourlyStats: { [key: string]: { count: number; amount: number } } = {};

    payments.forEach(payment => {
      const hour = payment.createdAt.getHours().toString().padStart(2, '0');
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { count: 0, amount: 0 };
      }
      hourlyStats[hour].count++;
      hourlyStats[hour].amount += Number(payment.amount);
    });

    return hourlyStats;
  }

  /**
   * Obtiene ingresos totales
   */
  private async getTotalRevenue(businessId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.automatedPayment.aggregate({
      where: {
        businessId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED' as PaymentStatus
      },
      _sum: {
        amount: true
      }
    });

    return Number(result._sum.amount) || 0;
  }

  /**
   * Calcula tasa de conversión
   */
  private async getConversionRate(businessId: string, startDate: Date, endDate: Date): Promise<number> {
    // Aquí podríamos calcular basado en interacciones vs pagos completados
    // Por ahora, retornamos un valor simulado
    return 75.5; // 75.5% de conversión
  }

  /**
   * Obtiene valor promedio de transacción
   */
  private async getAverageTransactionValue(businessId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.automatedPayment.aggregate({
      where: {
        businessId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED' as PaymentStatus
      },
      _avg: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    return result._count.id > 0 ? Number(result._avg.amount) || 0 : 0;
  }

  /**
   * Obtiene uso de métodos de pago
   */
  private async getPaymentMethodsUsage(businessId: string, startDate: Date, endDate: Date): Promise<{ [key: string]: number }> {
    const stats = await this.prisma.automatedPayment.groupBy({
      by: ['gateway'],
      where: {
        businessId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED' as PaymentStatus
      },
      _count: {
        id: true
      }
    });

    const total = stats.reduce((sum, item) => sum + item._count.id, 0);

    return stats.reduce((acc, item) => {
      acc[item.gateway] = total > 0 ? (item._count.id / total) * 100 : 0;
      return acc;
    }, {});
  }

  /**
   * Obtiene horas pico
   */
  private async getPeakHours(businessId: string, startDate: Date, endDate: Date): Promise<{ hour: number; count: number }[]> {
    const payments = await this.prisma.automatedPayment.findMany({
      where: {
        businessId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED' as PaymentStatus
      },
      select: {
        createdAt: true
      }
    });

    const hourCounts: { [key: number]: number } = {};

    payments.forEach(payment => {
      const hour = payment.createdAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 horas pico
  }

  /**
   * Calcula retención de clientes
   */
  private async getCustomerRetention(businessId: string, startDate: Date, endDate: Date): Promise<number> {
    // Lógica simplificada para retención
    // En una implementación real, esto compararía clientes recurrentes vs nuevos
    return 85.2; // 85.2% de retención
  }

  /**
   * Genera filtros de fecha según el rango
   */
  private getDateFilter(timeRange: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date();
    
    let startDate: Date;

    switch (timeRange) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  /**
   * Genera filtros de fecha para el período anterior
   */
  private getPreviousDateFilter(timeRange: string): { startDate: Date; endDate: Date } {
    const currentFilter = this.getDateFilter(timeRange);
    const duration = currentFilter.endDate.getTime() - currentFilter.startDate.getTime();
    
    return {
      startDate: new Date(currentFilter.startDate.getTime() - duration),
      endDate: currentFilter.startDate
    };
  }

  /**
   * Obtiene resumen ejecutivo para dashboard principal
   */
  async getExecutiveSummary(businessId: string): Promise<any> {
    try {
      this.logger.log(`[PaymentDashboard] Getting executive summary for business ${businessId}`);

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

      // Ingresos del mes actual vs mes anterior
      const currentMonthRevenue = await this.getTotalRevenue(businessId, startOfMonth, today);
      const lastMonthRevenue = await this.getTotalRevenue(businessId, startOfLastMonth, endOfLastMonth);
      const monthlyGrowth = lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

      // Pagos de hoy
      const todayRevenue = await this.getTotalRevenue(businessId, new Date(today.getFullYear(), today.getMonth(), today.getDate()), today);
      
      // Pagos pendientes
      const pendingStats = await this.prisma.automatedPayment.aggregate({
        where: {
          businessId,
          status: 'PENDING'
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      });

      return {
        currentMonthRevenue,
        monthlyGrowth,
        todayRevenue,
        pendingPayments: pendingStats._count.id,
        pendingAmount: Number(pendingStats._sum.amount) || 0,
        revenueProjection: currentMonthRevenue / (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
      };
    } catch (error) {
      this.logger.error(`[PaymentDashboard] Error getting executive summary: ${error.message}`);
      throw error;
    }
  }
}
