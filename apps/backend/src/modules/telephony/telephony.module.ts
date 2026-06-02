import { Module } from '@nestjs/common';
import { TelephonyController } from './telephony.controller';
import { TwilioService } from './twilio.service';
import { DatabaseModule } from '../database/database.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [DatabaseModule, SubscriptionModule],
  controllers: [TelephonyController],
  providers: [TwilioService],
  exports: [TwilioService]
})
export class TelephonyModule {}
