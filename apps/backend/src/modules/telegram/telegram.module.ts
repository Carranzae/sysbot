import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TelegramService } from './telegram.service'
import { TelegramController } from './telegram.controller'
import { DatabaseModule } from '../database/database.module'
import { MessagesModule } from '../messages/messages.module'
import { AiModule } from '../ai/ai.module'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MessagesModule,
    forwardRef(() => AiModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
