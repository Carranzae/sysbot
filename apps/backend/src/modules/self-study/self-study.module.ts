import { Module } from '@nestjs/common';
import { SelfStudyService } from './self-study.service';
import { SelfStudyController } from './self-study.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SelfStudyService],
  controllers: [SelfStudyController],
  exports: [SelfStudyService],
})
export class SelfStudyModule {}
