import { Module } from '@nestjs/common';
import { CrmCallService } from './crm-call.service';
import { CrmCallController } from './crm-call.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CrmCallService],
  controllers: [CrmCallController],
  exports: [CrmCallService],
})
export class CrmCallModule {}
