import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../database/prisma.service';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { PlanModule } from '../plan/plan.module';
import { AutomationModule } from '../automation/automation.module';
import { PaymentModule } from '../payment/payment.module';
import { AudioModule } from '../audio/audio.module';
import { TelephonyModule } from '../telephony/telephony.module';

@Module({
    controllers: [AdminController],
    providers: [AdminService],
    imports: [
        forwardRef(() => AiModule), 
        NotificationsModule, 
        WebsocketModule,
        PlanModule,
        AutomationModule,
        PaymentModule,
        AudioModule,
        TelephonyModule
    ],
    exports: [AdminService],
})
export class AdminModule { }
