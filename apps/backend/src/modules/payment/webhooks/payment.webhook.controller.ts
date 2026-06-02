import { Controller, Post, Body, Headers, Logger, Get, Param } from '@nestjs/common';
import { PaymentFactoryService } from '../payment-factory.service';
import { PrismaService } from '../../database/prisma.service';
import { PaymentGateway } from '@prisma/client';

@Controller('webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private paymentFactory: PaymentFactoryService,
    private prisma: PrismaService
  ) {}

  @Post('izipay')
  async handleIzipayWebhook(
    @Body() payload: any,
    @Headers('x-izipay-signature') signature: string
  ) {
    this.logger.log(`[IziPay Webhook] Received webhook with signature: ${signature?.substring(0, 20)}...`);

    try {
      // Guardar webhook para auditoría
      await this.prisma.paymentWebhook.create({
        data: {
          gateway: PaymentGateway.IZIPAY,
          payload,
          signature
        }
      });

      // Verificar firma
      const gateway = await this.paymentFactory.getGateway(PaymentGateway.IZIPAY);
      const isValid = await gateway.verifyWebhook(JSON.stringify(payload), signature);

      if (!isValid) {
        this.logger.warn('[IziPay Webhook] Invalid signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      // Procesar evento
      await this.processIzipayEvent(payload);

      // Marcar como procesado
      await this.prisma.paymentWebhook.updateMany({
        where: {
          gateway: PaymentGateway.IZIPAY,
          payload: payload
        },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error('[IziPay Webhook] Error processing webhook:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string
  ) {
    this.logger.log(`[Stripe Webhook] Received webhook with signature: ${signature?.substring(0, 20)}...`);

    try {
      // Guardar webhook para auditoría
      await this.prisma.paymentWebhook.create({
        data: {
          gateway: PaymentGateway.STRIPE,
          payload,
          signature
        }
      });

      // Verificar firma
      const gateway = await this.paymentFactory.getGateway(PaymentGateway.STRIPE);
      const isValid = await gateway.verifyWebhook(JSON.stringify(payload), signature);

      if (!isValid) {
        this.logger.warn('[Stripe Webhook] Invalid signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      // Procesar evento
      await this.processStripeEvent(payload);

      // Marcar como procesado
      await this.prisma.paymentWebhook.updateMany({
        where: {
          gateway: PaymentGateway.STRIPE,
          payload: payload
        },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      return { status: 'ok', message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error('[Stripe Webhook] Error processing webhook:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  private async processIzipayEvent(payload: any) {
    this.logger.log(`[IziPay Webhook] Processing event: ${payload.event_type}`);

    switch (payload.event_type) {
      case 'payment.completed':
      case 'payment.paid':
        await this.handleSuccessfulPayment(PaymentGateway.IZIPAY, payload.payment_id, payload);
        break;
        
      case 'payment.failed':
        await this.handleFailedPayment(PaymentGateway.IZIPAY, payload.payment_id, payload);
        break;
        
      case 'payment.cancelled':
        await this.handleCancelledPayment(PaymentGateway.IZIPAY, payload.payment_id, payload);
        break;
        
      default:
        this.logger.log(`[IziPay Webhook] Unhandled event type: ${payload.event_type}`);
    }
  }

  private async processStripeEvent(payload: any) {
    this.logger.log(`[Stripe Webhook] Processing event: ${payload.type}`);

    switch (payload.type) {
      case 'payment_intent.succeeded':
        await this.handleSuccessfulPayment(PaymentGateway.STRIPE, payload.data.object.id, payload.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await this.handleFailedPayment(PaymentGateway.STRIPE, payload.data.object.id, payload.data.object);
        break;
        
      case 'payment_intent.canceled':
        await this.handleCancelledPayment(PaymentGateway.STRIPE, payload.data.object.id, payload.data.object);
        break;
        
      default:
        this.logger.log(`[Stripe Webhook] Unhandled event type: ${payload.type}`);
    }
  }

  private async handleSuccessfulPayment(gateway: PaymentGateway, paymentId: string, paymentData: any) {
    this.logger.log(`[${gateway}] Processing successful payment: ${paymentId}`);

    try {
      // Buscar el pago en nuestra BD
      const automatedPayment = await this.prisma.automatedPayment.findFirst({
        where: {
          gatewayPaymentId: paymentId,
          gateway
        }
      });

      if (!automatedPayment) {
        this.logger.warn(`[${gateway}] Payment not found in database: ${paymentId}`);
        return;
      }

      if (automatedPayment.status === 'COMPLETED') {
        this.logger.log(`[${gateway}] Payment already completed: ${paymentId}`);
        return;
      }

      // Actualizar estado
      await this.prisma.automatedPayment.update({
        where: { id: automatedPayment.id },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      // Aquí podrías agregar lógica adicional:
      // - Enviar confirmación al cliente
      // - Actualizar CRM
      // - Activar servicio/producto
      // - Enviar notificaciones

      this.logger.log(`[${gateway}] Payment marked as completed: ${paymentId}`);
    } catch (error) {
      this.logger.error(`[${gateway}] Error handling successful payment:`, error.message);
    }
  }

  private async handleFailedPayment(gateway: PaymentGateway, paymentId: string, paymentData: any) {
    this.logger.log(`[${gateway}] Processing failed payment: ${paymentId}`);

    try {
      const automatedPayment = await this.prisma.automatedPayment.findFirst({
        where: {
          gatewayPaymentId: paymentId,
          gateway
        }
      });

      if (automatedPayment && automatedPayment.status !== 'FAILED') {
        await this.prisma.automatedPayment.update({
          where: { id: automatedPayment.id },
          data: {
            status: 'FAILED',
            updatedAt: new Date()
          }
        });
      }

      this.logger.log(`[${gateway}] Payment marked as failed: ${paymentId}`);
    } catch (error) {
      this.logger.error(`[${gateway}] Error handling failed payment:`, error.message);
    }
  }

  private async handleCancelledPayment(gateway: PaymentGateway, paymentId: string, paymentData: any) {
    this.logger.log(`[${gateway}] Processing cancelled payment: ${paymentId}`);

    try {
      const automatedPayment = await this.prisma.automatedPayment.findFirst({
        where: {
          gatewayPaymentId: paymentId,
          gateway
        }
      });

      if (automatedPayment && automatedPayment.status !== 'CANCELLED') {
        await this.prisma.automatedPayment.update({
          where: { id: automatedPayment.id },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date()
          }
        });
      }

      this.logger.log(`[${gateway}] Payment marked as cancelled: ${paymentId}`);
    } catch (error) {
      this.logger.error(`[${gateway}] Error handling cancelled payment:`, error.message);
    }
  }

  @Get('test')
  async testWebhook() {
    return {
      status: 'ok',
      message: 'Payment webhook controller is working',
      timestamp: new Date().toISOString()
    };
  }
}
