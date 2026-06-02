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
    // TODO: Implementar sincronización manual
    return {
      success: true,
      message: 'Sincronización iniciada',
    };
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

