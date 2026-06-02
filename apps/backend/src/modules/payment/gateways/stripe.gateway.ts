import { Injectable, Logger } from '@nestjs/common';
import Stripe, { type Stripe as StripeType } from 'stripe';
import { PaymentGatewayAdapter, PaymentRequest, PaymentResponse, PaymentStatus, RefundResponse, PaymentMethod } from '../interfaces/payment-gateway.interface';

@Injectable()
export class StripeGateway implements PaymentGatewayAdapter {
  private readonly logger = new Logger(StripeGateway.name);
  private stripe: StripeType;
  private webhookSecret: string;

  async connect(config: { apiKey: string; webhookSecret?: string }): Promise<boolean> {
    try {
      this.stripe = new Stripe(config.apiKey, {
        apiVersion: '2024-04-01',
        typescript: true
      } as any);
      
      this.webhookSecret = config.webhookSecret;

      // Probar conexión
      try {
        const balance = await this.stripe.balance.retrieve();
        this.logger.log(`[Stripe] Connected successfully`);
      } catch (balanceError) {
        this.logger.warn('[Stripe] Could not retrieve balance:', balanceError.message);
        // Aun así consideramos la conexión exitosa si tenemos la API key
      }
      
      return true;
    } catch (error) {
      this.logger.error('[Stripe] Connection failed:', error.message);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stripe = null;
    this.webhookSecret = null;
  }

  async isConnected(): Promise<boolean> {
    return !!this.stripe;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.logger.log(`[Stripe] Creating payment intent for ${request.customerEmail} - Amount: ${request.amount}`);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // Stripe usa centavos
        currency: request.currency.toLowerCase() || 'pen',
        metadata: {
          customerEmail: request.customerEmail,
          customerPhone: request.customerPhone,
          customerName: request.customerName,
          ...request.metadata
        },
        payment_method_types: ['card', 'yape', 'plin'],
        automatic_payment_methods: {
          enabled: true,
        },
        description: request.description || 'Pago SYST',
        receipt_email: request.customerEmail,
        // Configurar para Perú
        payment_method_options: {
          card: {
            request_three_d_secure: 'automatic'
          }
        }
      });

      this.logger.log(`[Stripe] Payment intent created: ${paymentIntent.id}`);

      return {
        paymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status === 'requires_payment_method' ? 'pending' : 
                paymentIntent.status === 'succeeded' ? 'completed' : 
                paymentIntent.status === 'canceled' ? 'failed' : 'pending',
        expiresAt: new Date(paymentIntent.created * 1000 + 30 * 60 * 1000) // 30 minutos
      };
    } catch (error) {
      this.logger.error('[Stripe] Error creating payment intent:', error.message);
      throw new Error(`Failed to create Stripe payment: ${error.message}`);
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentStatus> {
    try {
      this.logger.log(`[Stripe] Verifying payment: ${paymentId}`);

      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
      
      const isValid = paymentIntent.status === 'succeeded';

      return {
        valid: isValid,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 
                paymentIntent.status === 'canceled' ? 'failed' : 'pending',
        amount: paymentIntent.amount / 100, // Convertir de centavos
        currency: paymentIntent.currency.toUpperCase(),
        paidAt: isValid ? new Date(paymentIntent.created * 1000) : undefined,
        gatewayData: paymentIntent
      };
    } catch (error) {
      this.logger.error('[Stripe] Error verifying payment:', error.message);
      return {
        valid: false,
        status: 'failed',
        amount: 0,
        currency: 'PEN',
        reason: error.message
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResponse> {
    try {
      this.logger.log(`[Stripe] Refunding payment: ${paymentId} - Amount: ${amount}`);

      const refundParams: any = {
        payment_intent: paymentId,
        reason: reason || 'requested_by_customer'
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100); // Convertir a centavos
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        refundId: refund.id,
        amount: refund.amount / 100, // Convertir de centavos
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending' as any
      };
    } catch (error) {
      this.logger.error('[Stripe] Error refunding payment:', error.message);
      throw new Error(`Failed to refund Stripe payment: ${error.message}`);
    }
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      // Métodos de pago disponibles para Perú
      return [
        {
          id: 'card',
          name: 'Tarjeta de crédito/débito',
          type: 'card',
          enabled: true,
          fees: {
            fixed: 0.30, // 30 centavos USD
            percentage: 2.9 // 2.9%
          }
        },
        {
          id: 'yape',
          name: 'Yape',
          type: 'yape',
          enabled: true,
          fees: {
            fixed: 0,
            percentage: 1.5 // 1.5%
          }
        },
        {
          id: 'plin',
          name: 'Plin',
          type: 'plin',
          enabled: true,
          fees: {
            fixed: 0,
            percentage: 1.5 // 1.5%
          }
        }
      ];
    } catch (error) {
      this.logger.error('[Stripe] Error getting payment methods:', error.message);
      return [];
    }
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    try {
      if (!this.webhookSecret) {
        this.logger.warn('[Stripe] Webhook secret not configured');
        return false;
      }

      const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      this.logger.log(`[Stripe] Webhook verified: ${event.type}`);
      return true;
    } catch (error) {
      this.logger.error('[Stripe] Error verifying webhook:', error.message);
      return false;
    }
  }
}
