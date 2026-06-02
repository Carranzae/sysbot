import { Module } from '@nestjs/common';
import { BotRulesController } from './bot-rules.controller';
import { BotRulesService } from './bot-rules.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BotRulesController],
  providers: [BotRulesService],
  exports: [BotRulesService],
})
export class BotRulesModule {}
