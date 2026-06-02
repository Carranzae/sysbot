import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiResolver } from './ai.resolver';
import { AiController } from './ai.controller';
import { BusinessModule } from '../business/business.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AdminModule } from '../admin/admin.module'; // Importar AdminModule
import { AIProviderFactory } from './providers/ai-provider.factory';
import { BotRulesModule } from '../bot-rules/bot-rules.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule, 
    forwardRef(() => BusinessModule), 
    AppointmentsModule, 
    forwardRef(() => AdminModule),
    BotRulesModule,
    NotificationsModule
  ],
  providers: [AiService, AiResolver, AIProviderFactory],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
