import { Module, forwardRef } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { BusinessResolver } from './business.resolver';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [forwardRef(() => WhatsappModule), TelegramModule, WebsocketModule, forwardRef(() => AiModule)],
  providers: [BusinessService, BusinessResolver],
  controllers: [BusinessController],
  exports: [BusinessService],
})
export class BusinessModule {}
