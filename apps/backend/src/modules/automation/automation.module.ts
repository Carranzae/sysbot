import { Module } from '@nestjs/common';
import { SmartAutomationService } from './smart-automation.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  providers: [SmartAutomationService],
  exports: [SmartAutomationService],
})
export class AutomationModule {}
