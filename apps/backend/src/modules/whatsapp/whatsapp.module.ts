import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebService } from './whatsapp-web.service';
import { MessagesModule } from '../messages/messages.module';
import { AiModule } from '../ai/ai.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { PaymentModule } from '../payment/payment.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { FilesModule } from '../files/files.module';
import { PlanModule } from '../plan/plan.module';
import { JobsModule } from '../jobs/jobs.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AudioModule } from '../audio/audio.module';
import { BusinessModule } from '../business/business.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { SwarmModule } from '../swarm/swarm.module';

@Module({
  imports: [
    MessagesModule,
    forwardRef(() => AiModule),
    EvidenceModule,
    PaymentModule,
    InvoiceModule,
    FilesModule,
    PlanModule,
    forwardRef(() => JobsModule),
    WebhooksModule,
    AudioModule,
    forwardRef(() => BusinessModule),
    WebsocketModule,
    SwarmModule,
  ],
  providers: [WhatsappService, WhatsappWebService],
  controllers: [WhatsappController],
  exports: [WhatsappService, WhatsappWebService],
})
export class WhatsappModule {}
