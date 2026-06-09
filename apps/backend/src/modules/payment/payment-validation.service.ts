import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentFactoryService } from './payment-factory.service';
import { CRMFactoryService } from '../crm/crm-factory.service';
import { PaymentGateway, PaymentStatus } from '@prisma/client';
import { PaymentAutomationService } from './payment-automation.service';

export interface PaymentValidationRequest {
  businessId: string;
  paymentId: string;
  gatewayPaymentId: string;
  amount: number;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  metadata?: Record<string, any>;
}

export interface PaymentValidationResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  validatedAt: Date;
  gatewayData?: any;
  crmSynced?: boolean;
  crmData?: any;
  error?: string;
}

export interface CRMIntegrationData {
  contactId?: string;
  dealId?: string;
  taskId?: string;
  labels: string[];
  notes: string[];
}

@Injectable()
export class PaymentValidationService {
  private readonly logger = new Logger(PaymentValidationService.name);

  constructor(
    private prisma: PrismaService,
    private paymentFactory: PaymentFactoryService,
    private crmFactory: CRMFactoryService,
    private paymentAutomationService: PaymentAutomationService
  ) {}

  /**
   * Valida un pago y sincroniza con CRM automáticamente
   */
  async validateAndSyncPayment(request: PaymentValidationRequest): Promise<PaymentValidationResult> {
    try {
      this.logger.log(`[PaymentValidation] Validating payment ${request.paymentId} for business ${request.businessId}`);

      // 1. Obtener configuración del negocio
      const business = await this.prisma.business.findUnique({
        where: { id: request.businessId },
        select: {
          paymentGateway: true,
          crmProvider: true,
          name: true,
        }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // 2. Validar pago con el gateway
      const gatewayValidation = await this.validateWithGateway(
        business.paymentGateway,
        request.gatewayPaymentId
      );

      if (!gatewayValidation.valid) {
        this.logger.warn(`[PaymentValidation] Payment validation failed: ${gatewayValidation.reason}`);
        
        return {
          success: false,
          paymentId: request.paymentId,
          status: 'FAILED',
          amount: request.amount,
          currency: 'PEN',
          validatedAt: new Date(),
          error: gatewayValidation.reason
        };
      }

      // 3. Actualizar estado del pago en nuestra BD
      await this.updatePaymentStatus(request.paymentId, 'COMPLETED');

      // 4. Sincronizar con CRM si está configurado
      let crmSynced = false;
      let crmData: CRMIntegrationData | undefined;

      if (business.crmProvider && business.crmProvider !== 'NONE') {
        try {
          crmData = await this.syncToCRM(
            business.crmProvider,
            request.businessId,
            request,
            gatewayValidation
          );
          crmSynced = true;
        } catch (crmError) {
          this.logger.error(`[PaymentValidation] CRM sync failed: ${crmError.message}`);
          crmSynced = false;
        }
      }

      // 5. Enviar notificaciones
      await this.sendNotifications(request, gatewayValidation, crmSynced);

      this.logger.log(`[PaymentValidation] Payment ${request.paymentId} validated and synced successfully`);

      return {
        success: true,
        paymentId: request.paymentId,
        status: 'COMPLETED',
        amount: gatewayValidation.amount,
        currency: gatewayValidation.currency || 'PEN',
        validatedAt: new Date(),
        gatewayData: gatewayValidation.gatewayData,
        crmSynced,
        crmData
      };

    } catch (error) {
      this.logger.error(`[PaymentValidation] Error validating payment: ${error.message}`, error.stack);
      
      return {
        success: false,
        paymentId: request.paymentId,
        status: 'FAILED',
        amount: request.amount,
        currency: 'PEN',
        validatedAt: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Valida el pago directamente con el gateway externo
   */
  private async validateWithGateway(gateway: PaymentGateway, gatewayPaymentId: string): Promise<any> {
    try {
      const paymentGateway = await this.paymentFactory.getGateway(gateway);
      return await paymentGateway.verifyPayment(gatewayPaymentId);
    } catch (error) {
      this.logger.error(`[PaymentValidation] Gateway validation failed: ${error.message}`);
      return {
        valid: false,
        reason: error.message
      };
    }
  }

  /**
   * Actualiza el estado del pago en nuestra base de datos
   */
  private async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    try {
      await this.prisma.automatedPayment.update({
        where: { id: paymentId },
        data: {
          status,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error(`[PaymentValidation] Failed to update payment status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza el pago con el CRM configurado
   */
  private async syncToCRM(
    crmProvider: string,
    businessId: string,
    paymentRequest: PaymentValidationRequest,
    gatewayValidation: any
  ): Promise<CRMIntegrationData> {
    this.logger.log(`[PaymentValidation] Syncing to CRM: ${crmProvider}`);

    const crmAdapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!crmAdapter) {
      throw new Error('CRM adapter not available');
    }

    const crmData: CRMIntegrationData = {
      labels: ['Pago Recibido', 'SYST Bot'],
      notes: []
    };

    try {
      // 1. Crear o actualizar contacto
      const contactData = {
        firstName: paymentRequest.customerName?.split(' ')[0] || '',
        lastName: paymentRequest.customerName?.split(' ').slice(1).join(' ') || '',
        email: paymentRequest.customerEmail,
        phone: paymentRequest.customerPhone
      };

      let contactId: string;
      
      // Buscar contacto existente
      const existingContacts = await crmAdapter.searchContacts(paymentRequest.customerEmail);
      if (existingContacts.length > 0) {
        contactId = existingContacts[0].id;
        await crmAdapter.updateContact(contactId, contactData);
        crmData.notes.push('Contacto actualizado con nuevo pago');
      } else {
        contactId = await crmAdapter.createContact(contactData);
        crmData.notes.push('Nuevo contacto creado desde pago');
      }
      
      crmData.contactId = contactId;

      // 2. Agregar etiquetas de pago
      await crmAdapter.addLabel(contactId, 'Cliente Pagador');
      await crmAdapter.addLabel(contactId, `Pago: ${gatewayValidation.amount} ${gatewayValidation.currency || 'PEN'}`);

      // 3. Crear deal/oportunidad si el monto es significativo
      if (gatewayValidation.amount > 100) {
        const dealData = {
          name: `Pago SYST - ${paymentRequest.customerName}`,
          amount: gatewayValidation.amount,
          contactId: contactId,
          stage: 'Closed Won'
        };

        if (crmAdapter.createDeal) {
          const dealId = await crmAdapter.createDeal(dealData);
          crmData.dealId = dealId;
          crmData.notes.push(`Deal creado por pago de ${gatewayValidation.amount}`);
        }
      }

      // 4. Crear nota de pago
      if (crmAdapter.createNote) {
        const noteContent = `
Pago recibido vía SYST Bot:
- Monto: ${gatewayValidation.amount} ${gatewayValidation.currency || 'PEN'}
- Fecha: ${new Date().toLocaleString()}
- Gateway: ${crmProvider}
- ID Pago: ${paymentRequest.gatewayPaymentId}
        `.trim();

        const noteId = await crmAdapter.createNote(contactId, noteContent);
        crmData.notes.push(`Nota de pago creada: ${noteId}`);
      }

      // 5. Crear tarea de seguimiento si es cliente nuevo
      if (existingContacts.length === 0) {
        const taskData = {
          title: 'Seguimiento post-pago - Nuevo cliente',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 día
          contactId: contactId
        };

        if (crmAdapter.createTask) {
          const taskId = await crmAdapter.createTask(taskData);
          crmData.taskId = taskId;
          crmData.notes.push(`Tarea de seguimiento creada: ${taskId}`);
        }
      }

      this.logger.log(`[PaymentValidation] CRM sync completed successfully`);
      return crmData;

    } catch (error) {
      this.logger.error(`[PaymentValidation] CRM sync error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envía notificaciones sobre el pago validado
   */
  private async sendNotifications(
    paymentRequest: PaymentValidationRequest,
    gatewayValidation: any,
    crmSynced: boolean
  ): Promise<void> {
    try {
      // 1. Crear registro de notificación en BD
      await this.prisma.notification.create({
        data: {
          businessId: paymentRequest.businessId,
          type: 'PAYMENT_CONFIRMED',
          subject: 'Pago Confirmado',
          message: `Se ha confirmado el pago de ${gatewayValidation.amount} ${gatewayValidation.currency || 'PEN'} de ${paymentRequest.customerName}`,
          recipient: paymentRequest.customerEmail,
          scheduledAt: new Date(),
          isSent: false,
          metadata: {
            paymentId: paymentRequest.paymentId,
            gatewayPaymentId: paymentRequest.gatewayPaymentId,
            crmSynced,
            customerName: paymentRequest.customerName,
            amount: gatewayValidation.amount
          }
        }
      });

      // 2. Aquí se podrían agregar más notificaciones:
      // - Email al cliente
      // - WhatsApp al negocio
      // - Slack/Discord
      // - Webhook personalizado

      this.logger.log(`[PaymentValidation] Notifications created for payment ${paymentRequest.paymentId}`);
    } catch (error) {
      this.logger.error(`[PaymentValidation] Error creating notifications: ${error.message}`);
      // No lanzamos error para no afectar el flujo principal
    }
  }

  /**
   * Procesa pagos pendientes de validación automática
   */
  async processPendingPayments(businessId?: string): Promise<{ processed: number; errors: number }> {
    try {
      this.logger.log(`[PaymentValidation] Processing pending payments${businessId ? ` for business ${businessId}` : ''}`);

      const whereClause: any = {
        status: 'PENDING'
      };

      if (businessId) {
        whereClause.businessId = businessId;
      }

      const pendingPayments = await this.prisma.automatedPayment.findMany({
        where: whereClause,
        include: {
          business: {
            select: {
              paymentGateway: true,
              crmProvider: true,
              name: true
            }
          }
        },
        take: 50, // Limitar para no sobrecargar
        orderBy: {
          createdAt: 'asc'
        }
      });

      let processed = 0;
      let errors = 0;

      for (const payment of pendingPayments) {
        try {
          const validationRequest: PaymentValidationRequest = {
            businessId: payment.businessId,
            paymentId: payment.id,
            gatewayPaymentId: payment.gatewayPaymentId!,
            amount: Number(payment.amount),
            customerEmail: payment.customerEmail!,
            customerPhone: payment.customerPhone!,
            customerName: payment.customerName!,
            metadata: payment.metadata as any
          };

          await this.validateAndSyncPayment(validationRequest);
          processed++;
        } catch (error) {
          this.logger.error(`[PaymentValidation] Error processing payment ${payment.id}: ${error.message}`);
          errors++;
        }
      }

      this.logger.log(`[PaymentValidation] Processed ${processed} payments, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      this.logger.error(`[PaymentValidation] Error processing pending payments: ${error.message}`);
      return { processed: 0, errors: 0 };
    }
  }

  /**
   * Obtiene estadísticas de validación de pagos
   */
  async getValidationStats(businessId: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const whereClause: any = {
        businessId,
        status: {
          in: ['COMPLETED', 'FAILED']
        }
      };

      if (startDate || endDate) {
        whereClause.updatedAt = {};
        if (startDate) whereClause.updatedAt.gte = startDate;
        if (endDate) whereClause.updatedAt.lte = endDate;
      }

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
        byStatus: stats.reduce((acc, item) => {
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
    } catch (error) {
      this.logger.error(`[PaymentValidation] Error getting validation stats: ${error.message}`);
      throw error;
    }
  }
}
