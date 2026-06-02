import { Injectable, Logger } from '@nestjs/common';
import { PaymentGateway } from '@prisma/client';
import { PaymentGatewayAdapter } from './interfaces/payment-gateway.interface';
import { IzipayGateway } from './gateways/izipay.gateway';
import { StripeGateway } from './gateways/stripe.gateway';

@Injectable()
export class PaymentFactoryService {
  private readonly logger = new Logger(PaymentFactoryService.name);

  constructor(
    private izipayGateway: IzipayGateway,
    private stripeGateway: StripeGateway
  ) {}

  async getGateway(gateway: PaymentGateway): Promise<PaymentGatewayAdapter> {
    switch (gateway) {
      case PaymentGateway.IZIPAY:
        this.logger.log('[PaymentFactory] Using IziPay gateway');
        return this.izipayGateway;
        
      case PaymentGateway.STRIPE:
        this.logger.log('[PaymentFactory] Using Stripe gateway');
        return this.stripeGateway;
        
      case PaymentGateway.MERCADOPAGO:
        // TODO: Implementar MercadoPago gateway
        throw new Error('MercadoPago gateway not implemented yet');
        
      case PaymentGateway.PAYPAL:
        // TODO: Implementar PayPal gateway
        throw new Error('PayPal gateway not implemented yet');
        
      case PaymentGateway.YAPE_PLIN:
        // Para Yape/Plin usamos IziPay como gateway principal
        this.logger.log('[PaymentFactory] Using IziPay for Yape/Plin');
        return this.izipayGateway;
        
      case PaymentGateway.MANUAL:
        // TODO: Implementar procesamiento manual
        throw new Error('Manual gateway not implemented yet');
        
      case PaymentGateway.NONE:
        throw new Error('No payment gateway configured');
        
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  async configureGateway(gateway: PaymentGateway, config: any): Promise<boolean> {
    try {
      this.logger.log(`[PaymentFactory] Configuring gateway: ${gateway}`);
      
      const gatewayAdapter = await this.getGateway(gateway);
      const connected = await gatewayAdapter.connect(config);
      
      if (connected) {
        this.logger.log(`[PaymentFactory] Gateway ${gateway} configured successfully`);
      } else {
        this.logger.error(`[PaymentFactory] Failed to configure gateway ${gateway}`);
      }
      
      return connected;
    } catch (error) {
      this.logger.error(`[PaymentFactory] Error configuring gateway ${gateway}:`, error.message);
      return false;
    }
  }

  async testGateway(gateway: PaymentGateway, config: any): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`[PaymentFactory] Testing gateway: ${gateway}`);
      
      const gatewayAdapter = await this.getGateway(gateway);
      const connected = await gatewayAdapter.connect(config);
      
      if (!connected) {
        return {
          success: false,
          message: `No se pudo conectar con ${gateway}`
        };
      }

      // Probar obtener métodos de pago
      const paymentMethods = await gatewayAdapter.getPaymentMethods();
      
      return {
        success: true,
        message: `Conexión exitosa con ${gateway}. Métodos disponibles: ${paymentMethods.length}`
      };
    } catch (error) {
      this.logger.error(`[PaymentFactory] Error testing gateway ${gateway}:`, error.message);
      return {
        success: false,
        message: `Error al conectar con ${gateway}: ${error.message}`
      };
    }
  }

  getAvailableGateways(): { gateway: PaymentGateway; name: string; description: string; features: string[] }[] {
    return [
      {
        gateway: PaymentGateway.IZIPAY,
        name: 'IziPay',
        description: 'Gateway peruano especializado',
        features: ['Yape', 'Plin', 'Transferencias', 'Tarjetas', 'Cuotas hasta 12 meses']
      },
      {
        gateway: PaymentGateway.STRIPE,
        name: 'Stripe',
        description: 'Procesador global de pagos',
        features: ['Tarjetas crédito/débito', 'Yape', 'Plin', 'Apple Pay', 'Google Pay', 'Cuotas']
      },
      {
        gateway: PaymentGateway.MERCADOPAGO,
        name: 'MercadoPago',
        description: 'Gateway latinoamericano',
        features: ['Tarjetas', 'Transferencias', 'Efectivo', 'Cuotas']
      },
      {
        gateway: PaymentGateway.PAYPAL,
        name: 'PayPal',
        description: 'Gateway global',
        features: ['Cuenta PayPal', 'Tarjetas', 'Transferencias bancarias']
      }
    ];
  }
}
