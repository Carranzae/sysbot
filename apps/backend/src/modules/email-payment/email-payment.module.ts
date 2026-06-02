import { Module } from '@nestjs/common';
import { EmailPaymentService } from './email-payment.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [EmailPaymentService],
  exports: [EmailPaymentService],
})
export class EmailPaymentModule {}










