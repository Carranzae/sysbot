import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentFactoryService } from './payment-factory.service';
import { PaymentGateway } from '@prisma/client';
import { PaymentRequest, PaymentResponse } from './interfaces/payment-gateway.interface';

export interface CreatePaymentDto {
  businessId: string;
  customerId?: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentAutomationService {
  private readonly logger = new Logger(PaymentAutomationService.name);

  constructor(
    private prisma: PrismaService,
    private paymentFactory: PaymentFactoryService
  ) {}

  /**
   * Crear un pago automatizado usando el gateway configurado del negocio
   */
  async createPayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
    try {
      this.logger.log(`[PaymentAutomation] Creating payment for business ${dto.businessId} - Amount: ${dto.amount}`);

      // Obtener configuración del negocio
      const business = await this.prisma.business.findUnique({
        where: { id: dto.businessId },
        select: {
          paymentGateway: true,
          paymentConfig: true,
          name: true
        }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      if (business.paymentGateway === PaymentGateway.NONE) {
        throw new Error('No payment gateway configured for this business');
      }

      // Obtener gateway
      const gateway = await this.paymentFactory.getGateway(business.paymentGateway);

      // Crear solicitud de pago
      const paymentRequest: PaymentRequest = {
        amount: dto.amount,
        currency: dto.currency || 'PEN',
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        customerName: dto.customerName,
        description: dto.description || `Pago ${business.name}`,
        metadata: {
          businessId: dto.businessId,
          businessName: business.name,
          customerId: dto.customerId,
          source: 'SYST_AUTOMATION',
          ...dto.metadata
        }
      };

      // Crear pago en el gateway
      const paymentResponse = await gateway.createPayment(paymentRequest);

      // Guardar en nuestra base de datos
      const automatedPayment = await this.prisma.automatedPayment.create({
        data: {
          businessId: dto.businessId,
          customerId: dto.customerId,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          customerName: dto.customerName,
          amount: dto.amount,
          currency: dto.currency || 'PEN',
          gateway: business.paymentGateway,
          gatewayPaymentId: paymentResponse.paymentId,
          status: 'PENDING',
          paymentUrl: paymentResponse.paymentUrl,
          qrCode: paymentResponse.qrCode,
          metadata: paymentRequest.metadata,
          expiresAt: paymentResponse.expiresAt
        }
      });

      this.logger.log(`[PaymentAutomation] Payment created successfully: ${automatedPayment.id}`);

      return {
        ...paymentResponse,
        // Agregar información adicional
        paymentUrl: paymentResponse.paymentUrl,
        qrCode: paymentResponse.qrCode,
        status: paymentResponse.status,
        expiresAt: paymentResponse.expiresAt
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error creating payment:', error.message);
      throw error;
    }
  }

  /**
   * Verificar el estado de un pago
   */
  async verifyPayment(paymentId: string): Promise<any> {
    try {
      this.logger.log(`[PaymentAutomation] Verifying payment: ${paymentId}`);

      const automatedPayment = await this.prisma.automatedPayment.findUnique({
        where: { id: paymentId },
        include: {
          business: {
            select: {
              paymentGateway: true
            }
          }
        }
      });

      if (!automatedPayment) {
        throw new Error('Payment not found');
      }

      // Obtener gateway
      const gateway = await this.paymentFactory.getGateway(automatedPayment.business.paymentGateway);

      // Verificar en el gateway externo
      const paymentStatus = await gateway.verifyPayment(automatedPayment.gatewayPaymentId);

      // Actualizar estado en nuestra BD
      const newStatus = paymentStatus.valid ? 'COMPLETED' : 'FAILED';
      
      await this.prisma.automatedPayment.update({
        where: { id: paymentId },
        data: {
          status: newStatus,
          updatedAt: new Date()
        }
      });

      this.logger.log(`[PaymentAutomation] Payment ${paymentId} status updated to: ${newStatus}`);

      return {
        paymentId,
        status: newStatus,
        gatewayStatus: paymentStatus,
        valid: paymentStatus.valid
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error verifying payment:', error.message);
      throw error;
    }
  }

  /**
   * Obtener pagos pendientes de un negocio
   */
  async getPendingPayments(businessId: string, limit: number = 50): Promise<any[]> {
    try {
      const payments = await this.prisma.automatedPayment.findMany({
        where: {
          businessId,
          status: 'PENDING'
        },
        include: {
          business: {
            select: {
              name: true,
              paymentGateway: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return payments.map(payment => ({
        ...payment,
        isExpired: payment.expiresAt && new Date() > payment.expiresAt
      }));
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error getting pending payments:', error.message);
      throw error;
    }
  }

  /**
   * Cancelar un pago expirado
   */
  async cancelExpiredPayments(): Promise<number> {
    try {
      this.logger.log('[PaymentAutomation] Checking for expired payments...');

      const expiredPayments = await this.prisma.automatedPayment.findMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: new Date()
          }
        }
      });

      let cancelledCount = 0;

      for (const payment of expiredPayments) {
        try {
          await this.prisma.automatedPayment.update({
            where: { id: payment.id },
            data: {
              status: 'CANCELLED',
              updatedAt: new Date()
            }
          });

          cancelledCount++;
          this.logger.log(`[PaymentAutomation] Cancelled expired payment: ${payment.id}`);
        } catch (error) {
          this.logger.error(`[PaymentAutomation] Error cancelling payment ${payment.id}:`, error.message);
        }
      }

      this.logger.log(`[PaymentAutomation] Cancelled ${cancelledCount} expired payments`);
      return cancelledCount;
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error cancelling expired payments:', error.message);
      return 0;
    }
  }

  /**
   * Obtener estadísticas de pagos de un negocio
   */
  async getPaymentStats(businessId: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const whereClause: any = {
        businessId
      };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const stats = await this.prisma.automatedPayment.groupBy({
        by: ['status', 'gateway'],
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
        byStatus: stats.reduce((acc, item) => {
          acc[item.status] = {
            count: item._count.id,
            amount: item._sum.amount || 0
          };
          return acc;
        }, {}),
        byGateway: stats.reduce((acc, item) => {
          if (!acc[item.gateway]) {
            acc[item.gateway] = { count: 0, amount: 0 };
          }
          acc[item.gateway].count += item._count.id;
          acc[item.gateway].amount += item._sum.amount || 0;
          return acc;
        }, {})
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error getting payment stats:', error.message);
      throw error;
    }
  }
}
