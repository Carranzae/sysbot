import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { PlanModule } from '../plan/plan.module';
import { OauthModule } from '../oauth/oauth.module';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  imports: [PlanModule, OauthModule],
  providers: [AppointmentsService, GoogleCalendarService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService, GoogleCalendarService],
})
export class AppointmentsModule {}
