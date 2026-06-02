import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}










