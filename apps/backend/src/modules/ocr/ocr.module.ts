import { Module } from '@nestjs/common';
import { OCRService } from './ocr.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [OCRService],
  exports: [OCRService],
})
export class OCRModule {}










