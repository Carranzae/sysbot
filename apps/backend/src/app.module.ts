import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

import { DatabaseModule } from './modules/database/database.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessModule } from './modules/business/business.module';
import { FilesModule } from './modules/files/files.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { LeadsModule } from './modules/leads/leads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { HealthModule } from './modules/health/health.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { EmailModule } from './modules/email/email.module';
import { MetaModule } from './modules/meta/meta.module';
import { CRMModule } from './modules/crm/crm.module';
import { AdminModule } from './modules/admin/admin.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ChannelConfigModule } from './modules/channel-config/channel-config.module';
import { SettingsModule } from './modules/settings/settings.module';
import { OauthModule } from './modules/oauth/oauth.module';
import { McpModule } from './modules/mcp/mcp.module';
import { TelephonyModule } from './modules/telephony/telephony.module';
import { AudioModule } from './modules/audio/audio.module';
import { PlanModule } from './modules/plan/plan.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { SocialModule } from './modules/social/social.module';
import { LivechatBridgeModule } from './modules/livechat-bridge/livechat-bridge.module';
import { SwarmModule } from './modules/swarm/swarm.module';
import { VoiceCloningModule } from './modules/voice/voice-cloning.module';
import { CrmCallModule } from './modules/crm-call/crm-call.module';
import { SelfStudyModule } from './modules/self-study/self-study.module';
import { PaymentRevisorModule } from './modules/payment-revisor/payment-revisor.module';
import { ClinicModule } from './modules/clinic/clinic.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy(times) {
            // Reintentar cada 5 segundos para evitar que el backend crashee
            return 5000;
          },
        },
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // GraphQLModule.forRoot<ApolloDriverConfig>({
    //   driver: ApolloDriver,
    //   autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    //   sortSchema: true,
    //   playground: true,
    //   context: ({ req, res }) => ({ req, res }),
    // }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    MonitoringModule,
    UsersModule,
    BusinessModule,
    FilesModule,
    WhatsappModule,
    MessagesModule,
    AppointmentsModule,
    OrdersModule,
    LeadsModule,
    NotificationsModule,
    AiModule,
    WebsocketModule,
    JobsModule,
    HealthModule,
    ContactsModule,
    CampaignsModule,
    EmailModule,
    MetaModule,
    CRMModule,
    TelegramModule,
    ChannelConfigModule,
    SettingsModule,
    OauthModule,
    McpModule,
    TelephonyModule,
    AudioModule,
    PlanModule,
    WebhooksModule,
    ApiKeyModule,
    SocialModule,
    LivechatBridgeModule,
    SwarmModule,
    VoiceCloningModule,
    CrmCallModule,
    SelfStudyModule,
    PaymentRevisorModule,
    SubscriptionModule,
    ClinicModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule { }
