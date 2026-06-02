import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentAutomationService } from './payment-automation.service';
import { PaymentFactoryService } from './payment-factory.service';
import { PaymentValidationService } from './payment-validation.service';
import { IzipayGateway } from './gateways/izipay.gateway';
import { StripeGateway } from './gateways/stripe.gateway';
import { PaymentAutomationController } from './payment-automation.controller';
import { PaymentValidationController } from './payment-validation.controller';
import { PaymentWebhookController } from './webhooks/payment.webhook.controller';
import { DatabaseModule } from '../database/database.module';
import { OCRModule } from '../ocr/ocr.module';
import { EmailPaymentModule } from '../email-payment/email-payment.module';
import { CRMModule } from '../crm/crm.module';

@Module({
  imports: [DatabaseModule, OCRModule, EmailPaymentModule, CRMModule],
  controllers: [
    PaymentAutomationController, 
    PaymentValidationController,
    PaymentWebhookController
  ],
  providers: [
    PaymentService,
    PaymentAutomationService,
    PaymentValidationService,
    PaymentFactoryService,
    IzipayGateway,
    StripeGateway
  ],
  exports: [
    PaymentService,
    PaymentAutomationService,
    PaymentValidationService,
    PaymentFactoryService
  ],
})
export class PaymentModule {}










