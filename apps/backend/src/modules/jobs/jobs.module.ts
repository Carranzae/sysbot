import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobsService } from './jobs.service';
import { NotificationsProcessor } from './processors/notifications.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CampaignsProcessor } from './processors/campaigns.processor';
import { EmailModule } from '../email/email.module';
import { TaskSchedulerService } from './task-scheduler.service';
import { AdminModule } from '../admin/admin.module';
import { WhatsappProcessor } from './processors/whatsapp.processor';
import { WebhooksProcessor } from './processors/webhooks.processor';
import { DatabaseModule } from '../database/database.module';
import { PlanModule } from '../plan/plan.module';
import { SocialProcessor } from './processors/social.processor';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'notifications',
      },
      {
        name: 'campaigns',
      },
      {
        name: 'whatsapp-messages',
      },
      {
        name: 'webhooks',
      },
      {
        name: 'social',
      },
    ),
    NotificationsModule,
    forwardRef(() => WhatsappModule),
    EmailModule,
    forwardRef(() => AdminModule),
    DatabaseModule,
    PlanModule,
    MetaModule,
  ],
  providers: [JobsService, NotificationsProcessor, CampaignsProcessor, WhatsappProcessor, WebhooksProcessor, SocialProcessor, TaskSchedulerService],
  exports: [JobsService],
})
export class JobsModule { }
