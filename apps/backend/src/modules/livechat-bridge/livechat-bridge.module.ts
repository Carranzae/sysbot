import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LivechatBridgeService } from './livechat-bridge.service';
import { LivechatBridgeController } from './livechat-bridge.controller';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [HttpModule, WebsocketModule],
  controllers: [LivechatBridgeController],
  providers: [LivechatBridgeService],
  exports: [LivechatBridgeService],
})
export class LivechatBridgeModule {}
