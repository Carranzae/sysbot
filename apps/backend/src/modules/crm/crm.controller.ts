import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Logger, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CRMFactoryService } from './crm-factory.service';
import { CRMProvider } from '@prisma/client';
import { CRMChannelMappingService } from './crm-channel-mapping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@syst/database';

@Controller('crm')
@UseGuards(JwtAuthGuard)
export class CRMController {
  private readonly logger = new Logger(CRMController.name);

  constructor(
    private prisma: PrismaService,
    private crmFactory: CRMFactoryService,
    private channelMappingService: CRMChannelMappingService,
  ) {}

  @Get('connection/:businessId')
  async getConnection(@Param('businessId') businessId: string) {
    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
      include: {
        labelMappings: true,
      },
    });

    if (!connection) {
      return {
        businessId,
        provider: 'NONE',
        isActive: false,
        isConnected: false,
        syncEnabled: false,
        syncDirection: 'BIDIRECTIONAL',
      };
    }

    return connection;
  }

  @Post('connection/:businessId')
  async createConnection(
    @Param('businessId') businessId: string,
    @Body() data: {
      provider: CRMProvider;
      accessToken?: string;
      refreshToken?: string;
      apiKey?: string;
      apiSecret?: string;
      baseUrl?: string;
      config?: any;
      syncEnabled?: boolean;
      syncDirection?: 'TO_CRM' | 'FROM_CRM' | 'BIDIRECTIONAL';
    },
  ) {
    return this.prisma.cRMConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        provider: data.provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        baseUrl: data.baseUrl,
        config: data.config || {},
        syncEnabled: data.syncEnabled ?? true,
        syncDirection: data.syncDirection || 'BIDIRECTIONAL',
        isActive: data.provider !== 'NONE',
      },
      update: {
        provider: data.provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        baseUrl: data.baseUrl,
        config: data.config || {},
        syncEnabled: data.syncEnabled ?? true,
        syncDirection: data.syncDirection || 'BIDIRECTIONAL',
        isActive: data.provider !== 'NONE',
        isConnected: false, // Se actualizará después de probar la conexión
      },
    });
  }

  @Patch('connection/:businessId')
  async updateConnection(
    @Param('businessId') businessId: string,
    @Body() data: {
      provider?: CRMProvider;
      accessToken?: string;
      refreshToken?: string;
      apiKey?: string;
      apiSecret?: string;
      baseUrl?: string;
      config?: any;
      syncEnabled?: boolean;
      syncDirection?: 'TO_CRM' | 'FROM_CRM' | 'BIDIRECTIONAL';
      isActive?: boolean;
    },
  ) {
    return this.prisma.cRMConnection.update({
      where: { businessId },
      data: {
        ...data,
        isActive: data.isActive ?? (data.provider !== 'NONE' && data.provider !== undefined),
      },
    });
  }

  @Post('connection/:businessId/test')
  async testConnection(@Param('businessId') businessId: string) {
    try {
      const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
      
      if (!adapter) {
        return {
          success: false,
          message: 'No hay CRM configurado o no está activo',
        };
      }

      const isConnected = await adapter.isConnected();
      
      // Actualizar estado de conexión en BD
      await this.prisma.cRMConnection.update({
        where: { businessId },
        data: { isConnected },
      });

      return {
        success: isConnected,
        message: isConnected
          ? 'Conexión exitosa con el CRM'
          : 'No se pudo conectar con el CRM. Verifica las credenciales.',
      };
    } catch (error: any) {
      this.logger.error(`[CRMController] Error testing connection: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Error al probar la conexión',
      };
    }
  }

  @Post('connection/:businessId/sync')
  async triggerSync(@Param('businessId') businessId: string) {
    const connection = await this.prisma.cRMConnection.findUnique({ where: { businessId } });
    if (!connection || !connection.isActive || !connection.syncEnabled) {
      return {
        success: false,
        message: 'No hay CRM activo o la sincronizacion esta deshabilitada',
        synced: { contacts: 0, leads: 0, remoteContacts: 0 },
      };
    }

    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) {
      return {
        success: false,
        message: 'No se pudo inicializar el adaptador CRM',
        synced: { contacts: 0, leads: 0, remoteContacts: 0 },
      };
    }

    const direction = connection.syncDirection || 'BIDIRECTIONAL';
    let contactsSynced = 0;
    let leadsSynced = 0;
    let remoteContacts = 0;
    const errors: string[] = [];

    if (direction === 'TO_CRM' || direction === 'BIDIRECTIONAL') {
      const [contacts, leads] = await Promise.all([
        this.prisma.contact.findMany({ where: { businessId }, orderBy: { updatedAt: 'desc' }, take: 500 }),
        this.prisma.lead.findMany({ where: { businessId }, orderBy: { updatedAt: 'desc' }, take: 500 }),
      ]);

      for (const contact of contacts) {
        try {
          const metadata = (contact.metadata as any) || {};
          const contactData = {
            id: metadata.crmContactId || contact.id,
            firstName: contact.name || contact.phone,
            lastName: '',
            email: contact.email || '',
            phone: contact.phone || '',
            platformId: metadata.channel || contact.source,
          };
          let crmEntityId = metadata.crmContactId;
          if (crmEntityId) {
            await adapter.updateContact(crmEntityId, contactData);
          } else {
            crmEntityId = await adapter.createContact(contactData);
            await this.prisma.contact.update({
              where: { id: contact.id },
              data: { metadata: { ...metadata, crmContactId: crmEntityId, lastCrmSyncAt: new Date().toISOString() } },
            });
          }
          contactsSynced += 1;
          await this.prisma.cRMSyncLog.create({
            data: {
              businessId,
              crmConnectionId: connection.id,
              syncType: 'MANUAL',
              direction: 'TO_CRM',
              status: 'SUCCESS',
              entityType: 'CONTACT',
              entityId: contact.id,
              crmEntityId,
              syncedData: contactData,
            },
          });
        } catch (error: any) {
          errors.push(`contact:${contact.id}:${error.message}`);
          await this.logCrmSyncError(connection.id, businessId, 'CONTACT', contact.id, 'TO_CRM', error.message);
        }
      }

      for (const lead of leads) {
        try {
          const metadata = (lead.metadata as any) || {};
          const contactData = {
            id: metadata.crmContactId || lead.id,
            firstName: lead.name,
            lastName: '',
            email: lead.email || '',
            phone: lead.phone || '',
            platformId: lead.source || metadata.sourceChannel || 'SYSBOT',
          };
          let crmEntityId = metadata.crmContactId;
          if (crmEntityId) {
            await adapter.updateContact(crmEntityId, contactData);
          } else {
            crmEntityId = await adapter.createContact(contactData);
          }

          if (adapter.createDeal && metadata.dealAmount) {
            await adapter.createDeal({
              name: `Sysbot - ${lead.name}`,
              amount: Number(metadata.dealAmount || 0),
              contactId: crmEntityId,
              stage: lead.status,
              notes: lead.notes || '',
            });
          }

          if (adapter.createTask && metadata.nextAction) {
            await adapter.createTask({
              title: metadata.nextAction,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              contactId: crmEntityId,
            });
          }

          await this.prisma.lead.update({
            where: { id: lead.id },
            data: { metadata: { ...metadata, crmContactId: crmEntityId, lastCrmSyncAt: new Date().toISOString() } },
          });
          leadsSynced += 1;
          await this.prisma.cRMSyncLog.create({
            data: {
              businessId,
              crmConnectionId: connection.id,
              syncType: 'MANUAL',
              direction: 'TO_CRM',
              status: 'SUCCESS',
              entityType: 'LEAD',
              entityId: lead.id,
              crmEntityId,
              syncedData: contactData,
            },
          });
        } catch (error: any) {
          errors.push(`lead:${lead.id}:${error.message}`);
          await this.logCrmSyncError(connection.id, businessId, 'LEAD', lead.id, 'TO_CRM', error.message);
        }
      }
    }

    if ((direction === 'FROM_CRM' || direction === 'BIDIRECTIONAL') && adapter.syncContacts) {
      try {
        const result = await adapter.syncContacts({ startDate: connection.lastSyncAt || undefined });
        remoteContacts = result.count || 0;
        if (result.errors?.length) errors.push(...result.errors);
        await this.prisma.cRMSyncLog.create({
          data: {
            businessId,
            crmConnectionId: connection.id,
            syncType: 'MANUAL',
            direction: 'FROM_CRM',
            status: result.success ? 'SUCCESS' : 'PARTIAL',
            entityType: 'CONTACT',
            entityId: 'REMOTE_BATCH',
            syncedData: result as any,
          },
        });
      } catch (error: any) {
        errors.push(`from_crm:${error.message}`);
        await this.logCrmSyncError(connection.id, businessId, 'CONTACT', 'REMOTE_BATCH', 'FROM_CRM', error.message);
      }
    }

    await this.prisma.cRMConnection.update({
      where: { businessId },
      data: { lastSyncAt: new Date(), isConnected: errors.length === 0 },
    });

    return {
      success: errors.length === 0,
      message: errors.length ? 'Sincronizacion completada con observaciones' : 'Sincronizacion CRM completada',
      synced: { contacts: contactsSynced, leads: leadsSynced, remoteContacts },
      errors: errors.slice(0, 10),
    };

    // TODO: Implementar sincronización manual
    return {
      success: true,
      message: 'Sincronización iniciada',
    };
  }

  private async logCrmSyncError(
    crmConnectionId: string,
    businessId: string,
    entityType: string,
    entityId: string,
    direction: string,
    errorMessage: string,
  ) {
    await this.prisma.cRMSyncLog.create({
      data: {
        businessId,
        crmConnectionId,
        syncType: 'MANUAL',
        direction,
        status: 'FAILED',
        entityType,
        entityId,
        errorMessage,
      },
    });
  }

  @Get('connection/:businessId/channels')
  async getChannelMappings(@Req() req: any, @Param('businessId') businessId: string) {
    return this.channelMappingService.getChannelMappings(businessId, {
      ownerId: req.user?.userId,
      role: req.user?.role as UserRole | undefined,
    });
  }

  @Post('connection/:businessId/channels')
  async saveChannelMappings(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Body() body: { channelKeys: string[] },
  ) {
    return this.channelMappingService.saveChannelMappings(businessId, body.channelKeys || [], {
      ownerId: req.user?.userId,
      role: req.user?.role as UserRole | undefined,
    });
  }

  @Get('connection/:businessId/sync-logs')
  async getSyncLogs(
    @Param('businessId') businessId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const logs = await this.prisma.cRMSyncLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit || 50,
      skip: offset || 0,
    });

    return logs;
  }

  @Delete('connection/:businessId')
  async deleteConnection(@Param('businessId') businessId: string) {
    return this.prisma.cRMConnection.delete({
      where: { businessId },
    });
  }
}
