import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { ChannelConfigModule } from '../channel-config/channel-config.module';
import { CRMFactoryService } from './crm-factory.service';
import { CRMSyncService } from './crm-sync.service';
import { CRMSyncJob } from './crm-sync.job';
import { CRMController } from './crm.controller';
import { CRMTestController } from './crm-test.controller';
import { CRMTestService } from './crm-test.service';
import { MetaCrmAdapter } from './adapters/meta-crm.adapter';
import { HubspotCrmAdapter } from './adapters/hubspot.adapter';
import { SalesforceCrmAdapter } from './adapters/salesforce.adapter';
import { ZohoCrmAdapter } from './adapters/zoho.adapter';
import { GoogleSheetsAdapter } from './adapters/google-sheets.adapter';
import { CRMChannelMappingService } from './crm-channel-mapping.service';

@Module({
  imports: [DatabaseModule, ChannelConfigModule, ScheduleModule.forRoot()],
  controllers: [CRMController, CRMTestController],
  providers: [
    CRMFactoryService,
    CRMSyncService,
    CRMSyncJob,
    CRMTestService,
    MetaCrmAdapter,
    HubspotCrmAdapter,
    SalesforceCrmAdapter,
    ZohoCrmAdapter,
    GoogleSheetsAdapter,
    CRMChannelMappingService,
  ],
  exports: [CRMFactoryService, CRMSyncService, CRMChannelMappingService, GoogleSheetsAdapter],
})
export class CRMModule {}
