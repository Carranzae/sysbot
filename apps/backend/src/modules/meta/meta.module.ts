import { Module, forwardRef } from '@nestjs/common';
import { MetaService } from './meta.service';
import { MetaController } from './meta.controller';
import { MetaRouterService } from './meta-router.service';
import { MessengerService } from './messenger/messenger.service';
import { InstagramService } from './instagram/instagram.service';
import { AiModule } from '../ai/ai.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { DatabaseModule } from '../database/database.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { SwarmModule } from '../swarm/swarm.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [
    DatabaseModule,
    WebsocketModule,
    forwardRef(() => AiModule),
    forwardRef(() => WhatsappModule),
    SwarmModule,
    BusinessModule,
  ],
  providers: [
    MetaService,
    MetaRouterService,
    MessengerService,
    InstagramService,
  ],
  controllers: [MetaController],
  exports: [MetaService, MetaRouterService, MessengerService, InstagramService],
})
export class MetaModule {}

