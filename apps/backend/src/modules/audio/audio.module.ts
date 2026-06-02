import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TTSService } from './tts.service';
import { STTService } from './stt.service';

@Module({
  imports: [ConfigModule],
  providers: [TTSService, STTService],
  exports: [TTSService, STTService]
})
export class AudioModule {}
