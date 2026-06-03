import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { PaymentFactoryService } from '../payment/payment-factory.service';
import { PlanService } from './plan.service';
import { PlanType, PlanInterval, calculatePlanPrice } from './entities/plan.entity';
import { PaymentGateway } from '@prisma/client';

@Injectable()
export class SaaSCheckoutService {
    private readonly logger = new Logger(SaaSCheckoutService.name);

    constructor(
        private prisma: PrismaService,
        private settings: SettingsService,
        private paymentFactory: PaymentFactoryService,
        private planService: PlanService
    ) { }

    async createSubscriptionCheckout(businessId: string, planType: PlanType, interval: PlanInterval) {
        this.logger.log(`[SaaSCheckout] Creating checkout for business ${businessId} - Plan: ${planType}`);

        // 1. Obtener el negocio y su industria para el precio
        const business = await this.prisma.business.findUnique({
            where: { id: businessId },
            select: { industryType: true, name: true, email: true, phone: true }
        });

        if (!business) throw new NotFoundException('Negocio no encontrado');

        // 2. Calcular el precio
        const price = calculatePlanPrice(planType, interval, business.industryType);
        
        // 3. Obtener el gateway preferido de la plataforma (Super Admin config)
        const gatewayType = await this.settings.getValue('SYSTEM_SUBSCRIPTION_GATEWAY', { defaultValue: 'IZIPAY' }) as PaymentGateway;
        
        // 4. Obtener las credenciales del Super Admin para ese gateway
        let config: any = {};
        if (gatewayType === PaymentGateway.IZIPAY) {
            config = {
                merchantId: await this.settings.getValue('SYSTEM_IZIPAY_MERCHANT_ID'),
                apiKey: await this.settings.getValue('SYSTEM_IZIPAY_API_KEY'),
                apiSecret: await this.settings.getValue('SYSTEM_IZIPAY_API_SECRET'),
            };
        } else if (gatewayType === PaymentGateway.STRIPE) {
            config = {
                apiKey: await this.settings.getValue('SYSTEM_STRIPE_SECRET_KEY'),
                webhookSecret: await this.settings.getValue('SYSTEM_STRIPE_WEBHOOK_SECRET'),
            };
        }

        if (!config.apiKey && gatewayType !== PaymentGateway.MANUAL) {
            this.logger.error(`[SaaSCheckout] Gateway ${gatewayType} not configured in SystemConfig`);
            throw new Error('La plataforma no tiene configurada una pasarela de pagos activa.');
        }

        // 5. Configurar el gateway de la plataforma temporalmente
        const gateway = await this.paymentFactory.getGateway(gatewayType);
        await gateway.connect(config);

        // 6. Crear el pago
        const paymentResponse = await gateway.createPayment({
            amount: price,
            currency: 'USD',
            customerEmail: business.email || 'customer@example.com',
            customerName: business.name,
            customerPhone: business.phone || '',
            description: `Suscripción SYST - Plan ${planType} (${interval})`,
            metadata: {
                businessId,
                planType,
                interval,
                type: 'SAAS_SUBSCRIPTION',
                source: 'PLATFORM_CHECKOUT'
            }
        });

        this.logger.log(`[SaaSCheckout] Checkout created successfully. URL: ${paymentResponse.paymentUrl}`);

        return paymentResponse;
    }

    async handleSuccessfulSubscription(businessId: string, planType: string, interval: string) {
        this.logger.log(`[SaaSCheckout] Activating subscription for ${businessId}: ${planType}`);
        
        await this.planService.createSubscription({
            businessId,
            planType: planType as PlanType,
            interval: interval as PlanInterval,
            trialDays: 0
        });

        // Notificar al negocio
        // TODO: Enviar correo/WhatsApp de bienvenida al plan
    }
}
