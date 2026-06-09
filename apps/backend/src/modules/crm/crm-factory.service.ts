import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CRMProvider } from '@prisma/client';
import { CRMAdapter, CRMConfig } from './interfaces/crm-adapter.interface';
import { MetaCrmAdapter } from './adapters/meta-crm.adapter';
import { HubspotCrmAdapter } from './adapters/hubspot.adapter';
import { SalesforceCrmAdapter } from './adapters/salesforce.adapter';
import { ZohoCrmAdapter } from './adapters/zoho.adapter';
import { GoogleSheetsAdapter } from './adapters/google-sheets.adapter';
import { PipedriveCrmAdapter } from './adapters/pipedrive.adapter';
import { MondayCrmAdapter } from './adapters/monday.adapter';

@Injectable()
export class CRMFactoryService {
  private readonly logger = new Logger(CRMFactoryService.name);

  constructor(
    private prisma: PrismaService,
    private metaCrmAdapter: MetaCrmAdapter,
    private hubspotAdapter: HubspotCrmAdapter,
    private salesforceAdapter: SalesforceCrmAdapter,
    private zohoAdapter: ZohoCrmAdapter,
    private googleSheetsAdapter: GoogleSheetsAdapter,
    private pipedriveAdapter: PipedriveCrmAdapter,
    private mondayAdapter: MondayCrmAdapter
  ) {}

  createAdapter(provider: CRMProvider): CRMAdapter {
    switch (provider) {
      case CRMProvider.META_CRM:
        this.logger.log('[CRMFactory] Using Meta CRM adapter');
        return this.metaCrmAdapter;
      case CRMProvider.HUBSPOT:
        this.logger.log('[CRMFactory] Using HubSpot adapter');
        return this.hubspotAdapter;
      case CRMProvider.SALESFORCE:
        this.logger.log('[CRMFactory] Using Salesforce adapter');
        return this.salesforceAdapter;
      case CRMProvider.ZOHO:
        this.logger.log('[CRMFactory] Using Zoho adapter');
        return this.zohoAdapter;
      case CRMProvider.GOOGLE_SHEETS:
        this.logger.log('[CRMFactory] Using Google Sheets adapter');
        return this.googleSheetsAdapter;
      case CRMProvider.PIPEDRIVE:
        this.logger.log('[CRMFactory] Using Pipedrive adapter');
        return this.pipedriveAdapter;
      case CRMProvider.MONDAY:
        this.logger.log('[CRMFactory] Using Monday adapter');
        return this.mondayAdapter;
      default:
        throw new Error(`CRM provider ${provider} not supported`);
    }
  }

  async getAdapterForBusiness(businessId: string): Promise<CRMAdapter | null> {
    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
    });

    if (!connection || !connection.isActive || connection.provider === CRMProvider.NONE) {
      return null;
    }

    const adapter = this.createAdapter(connection.provider);
    
    const config: CRMConfig = {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      apiKey: connection.apiKey,
      apiSecret: connection.apiSecret,
      baseUrl: connection.baseUrl,
      config: connection.config as any,
    };

    const connected = await adapter.connect(config);
    if (!connected) {
      this.logger.warn(`[CRMFactory] Failed to connect CRM for business ${businessId}`);
      return null;
    }

    return adapter;
  }
}










