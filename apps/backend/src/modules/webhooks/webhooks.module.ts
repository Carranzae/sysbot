import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'webhooks',
    }),
    PlanModule,
  ],
  providers: [WebhooksService],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
