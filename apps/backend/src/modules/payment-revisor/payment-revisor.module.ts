import { Module } from '@nestjs/common';
import { PaymentRevisorService } from './payment-revisor.service';
import { PaymentRevisorController } from './payment-revisor.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PaymentRevisorService],
  controllers: [PaymentRevisorController],
  exports: [PaymentRevisorService],
})
export class PaymentRevisorModule {}
