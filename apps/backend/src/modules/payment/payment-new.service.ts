import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class PaymentNewService {
  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService
  ) {}

  async createCheckoutSession(businessId: string, planType: string) {
    // Simulación de creación de sesión de checkout
    const prices = {
      STANDARD: 2900, // $29 en centavos
      PREMIUM: 9900,  // $99 en centavos
      ENTERPRISE: 29900, // $299 en centavos
      ULTIMATE: 99900   // $999 en centavos
    };

    const price = prices[planType];
    if (!price) {
      throw new Error('Invalid plan type');
    }

    return {
      sessionId: `cs_test_${Date.now()}`,
      price,
      currency: 'usd',
      planType,
      businessId,
      successUrl: `${process.env.DOMAIN}/success`,
      cancelUrl: `${process.env.DOMAIN}/cancel`
    };
  }

  async handleWebhook(event: any) {
    console.log('Payment webhook received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await this.activateSubscription(session.metadata.businessId, session.metadata.planType);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.cancelSubscription(event.data.object);
        break;
    }
  }

  private async activateSubscription(businessId: string, planType: string) {
    await this.subscriptionService.createSubscription(businessId, planType);
    console.log(`Subscription activated for business ${businessId}, plan ${planType}`);
  }

  private async handlePaymentFailed(invoice: any) {
    console.log('Payment failed for invoice:', invoice.id);
    // Aquí iría la lógica para manejar pagos fallidos
  }

  private async cancelSubscription(subscription: any) {
    console.log('Subscription cancelled:', subscription.id);
    // Aquí iría la lógica para cancelar suscripción
  }

  async processReceipt(data: any) {
    // Simulación de procesamiento de comprobante
    return {
      needsSecurityCode: true,
      message: 'Por favor, envía el código de seguridad de tu comprobante para verificación final'
    };
  }

  async verifySecurityCode(receiptId: string) {
    // Simulación de verificación de código de seguridad
    return {
      receipt: {
        id: receiptId,
        status: 'VERIFIED'
      }
    };
  }
}
