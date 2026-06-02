import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [DatabaseModule, JobsModule],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService],
})
export class SocialModule {}
