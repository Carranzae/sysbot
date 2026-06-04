import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CRMFactoryService } from '../crm/crm-factory.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private crmFactory: CRMFactoryService,
  ) {}

  private async syncToCRM(businessId: string, lead: any, isUpdate = false) {
    try {
      const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
      if (!adapter) {
        this.logger.debug(`[LeadsService] No active CRM integration for business ${businessId}`);
        return;
      }

      const contactData = {
        id: lead.id,
        firstName: lead.name,
        lastName: '',
        email: lead.email || '',
        phone: lead.phone || '',
        platformId: lead.source || 'WHATSAPP',
      };

      if (isUpdate) {
        await adapter.updateContact(lead.id, contactData);
        this.logger.log(`[LeadsService] Synchronized lead update ${lead.id} to CRM`);
      } else {
        await adapter.createContact(contactData);
        this.logger.log(`[LeadsService] Synchronized lead creation ${lead.id} to CRM`);
      }

      // If CRM adapter supports Deal operations, update/create deal record
      if (adapter.createDeal) {
        try {
          const metadataObj = lead.metadata
            ? typeof lead.metadata === 'string'
              ? JSON.parse(lead.metadata)
              : lead.metadata
            : {};
          const temperature = (metadataObj as any)?.temperature || 'Frío';
          await adapter.createDeal({
            name: `Negocio - ${lead.name}`,
            amount: 0,
            contactId: lead.id,
            stage: lead.status, // stages: NEW, CONTACTED, QUALIFIED, CONVERTED, LOST
            temperature,
            notes: lead.notes || '',
          });
        } catch (dealErr) {
          this.logger.error(`[LeadsService] Error syncing deal for lead ${lead.id}: ${dealErr.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`[LeadsService] Error syncing lead ${lead.id} to CRM: ${error.message}`);
    }
  }

  async create(businessId: string, data: any) {
    const lead = await this.prisma.lead.create({
      data: {
        businessId,
        ...data,
      },
    });

    // Run sync asynchronously to not block the request
    this.syncToCRM(businessId, lead, false).catch(() => {});

    return lead;
  }

  async findAll(businessId: string) {
    return this.prisma.lead.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.lead.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: any) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data,
    });

    // Run sync asynchronously to not block the request
    this.syncToCRM(lead.businessId, lead, true).catch(() => {});

    return lead;
  }

  async remove(id: string) {
    return this.prisma.lead.delete({
      where: { id },
    });
  }
}

