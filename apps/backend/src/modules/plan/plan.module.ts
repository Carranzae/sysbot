import { Module, forwardRef } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { SaaSCheckoutService } from './saas-checkout.service';
import { SettingsModule } from '../settings/settings.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    SettingsModule,
    forwardRef(() => PaymentModule)
  ],
  controllers: [PlanController],
  providers: [PlanService, SaaSCheckoutService],
  exports: [PlanService, SaaSCheckoutService],
})
export class PlanModule {}
