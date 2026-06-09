import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LivechatBridgeService } from './livechat-bridge.service';
import { LivechatBridgeController } from './livechat-bridge.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [
    HttpModule,
    WebsocketModule,
    WhatsappModule,
    TelegramModule,
    MetaModule,
  ],
  controllers: [LivechatBridgeController],
  providers: [LivechatBridgeService],
  exports: [LivechatBridgeService],
})
export class LivechatBridgeModule {}
