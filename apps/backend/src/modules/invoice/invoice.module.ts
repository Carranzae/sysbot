import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { DatabaseModule } from '../database/database.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [DatabaseModule, PaymentModule],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}










