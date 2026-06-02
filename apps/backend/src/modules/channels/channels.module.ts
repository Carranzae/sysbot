import { Module } from '@nestjs/common';
import { ChannelRouterService } from './channel-router.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MetaModule } from '../meta/meta.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { DatabaseModule } from '../database/database.module';
import { LivechatBridgeModule } from '../livechat-bridge/livechat-bridge.module';

@Module({
  imports: [
    DatabaseModule,
    WebsocketModule,
    WhatsappModule,
    MetaModule,
    LivechatBridgeModule,
  ],
  providers: [ChannelRouterService],
  exports: [ChannelRouterService],
})
export class ChannelsModule {}
