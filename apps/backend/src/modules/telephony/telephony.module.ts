import { Module, forwardRef } from '@nestjs/common';
import { TelephonyController } from './telephony.controller';
import { TwilioService } from './twilio.service';
import { DatabaseModule } from '../database/database.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AiModule } from '../ai/ai.module';
import { CrmCallModule } from '../crm-call/crm-call.module';

@Module({
  imports: [DatabaseModule, SubscriptionModule, forwardRef(() => AiModule), CrmCallModule],
  controllers: [TelephonyController],
  providers: [TwilioService],
  exports: [TwilioService]
})
export class TelephonyModule {}
