import { Module } from '@nestjs/common';
import { ChannelConfigService } from './channel-config.service';
import { ChannelConfigController } from './channel-config.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ChannelConfigController],
  providers: [ChannelConfigService],
  exports: [ChannelConfigService],
})
export class ChannelConfigModule {}
