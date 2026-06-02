import { Module } from '@nestjs/common';
import { VoiceCloningService } from './voice-cloning.service';
import { VoiceCloningController } from './voice-cloning.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [VoiceCloningService],
  controllers: [VoiceCloningController],
  exports: [VoiceCloningService],
})
export class VoiceCloningModule {}
