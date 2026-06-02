import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CRMFactoryService } from './crm-factory.service';

@Injectable()
export class CRMSyncService {
  private readonly logger = new Logger(CRMSyncService.name);

  constructor(
    private prisma: PrismaService,
    private crmFactory: CRMFactoryService,
  ) {}

  async onEvent(businessId: string, event: string, data: any) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) {
      this.logger.debug(`[CRMSync] No CRM adapter for business ${businessId}`);
      return;
    }

    this.logger.log(`[CRMSync] Processing event ${event} for business ${businessId}`);

    switch (event) {
      case 'PAYMENT_PENDING':
        await this.syncLabels(businessId, data.customerId, ['PAGO_PENDIENTE']);
        break;
      case 'PAYMENT_VERIFIED':
        await this.syncLabels(businessId, data.customerId, ['PAGO_VERIFICADO']);
        if (adapter.createDeal) {
          try {
            await adapter.createDeal({
              name: `Pago verificado - ${data.customerName || 'Cliente'}`,
              amount: data.amount,
              contactId: data.customerId,
              stage: 'Won',
            });
          } catch (error) {
            this.logger.error(`[CRMSync] Error creating deal: ${error.message}`);
          }
        }
        break;
      case 'EVIDENCE_SENT':
        await this.syncLabels(businessId, data.customerId, ['EVIDENCIA_ENVIADA']);
        break;
      case 'APPOINTMENT_CREATED':
        await this.syncLabels(businessId, data.customerId, ['CITA_AGENDADA']);
        if (adapter.createTask) {
          try {
            await adapter.createTask({
              title: `Cita agendada - ${data.customerName || 'Cliente'}`,
              dueDate: data.appointmentDate,
              contactId: data.customerId,
            });
          } catch (error) {
            this.logger.error(`[CRMSync] Error creating task: ${error.message}`);
          }
        }
        break;
    }
  }

  private async syncLabels(businessId: string, contactId: string, labels: string[]) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
      include: { labelMappings: true },
    });

    if (!connection) return;

    for (const label of labels) {
      const mapping = connection.labelMappings.find(
        m => m.systemLabel === label && m.autoSync,
      );

      if (mapping) {
        try {
          // Obtener CRM contact ID (simplificado - implementar lógica real)
          const crmContactId = await this.getCRMContactId(businessId, contactId);
          if (crmContactId) {
            await adapter.addLabel(crmContactId, mapping.crmLabel);
            this.logger.log(`[CRMSync] Label ${mapping.crmLabel} added to contact ${crmContactId}`);
          }
        } catch (error) {
          this.logger.error(`[CRMSync] Error syncing label ${label}: ${error.message}`);
        }
      }
    }
  }

  private async getCRMContactId(businessId: string, contactId: string): Promise<string | null> {
    // TODO: Implementar lógica para obtener CRM contact ID desde CustomerPlatform o Contact
    // Por ahora retornar null
    return null;
  }
}










