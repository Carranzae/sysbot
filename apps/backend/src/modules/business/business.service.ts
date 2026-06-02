import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import {
  BotRuleEngine,
  BotRuleScope,
  BotRuleTriggerType,
  Prisma,
  TelegramAuthStatus,
  TelegramIntegrationMode,
  UserRole,
} from '@syst/database';
import { PrismaService } from '../database/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { DEFAULT_INDUSTRY_PRESET, INDUSTRY_PRESETS } from './industry-presets';
import { TelegramService } from '../telegram/telegram.service';
import { CreateBotRuleDto, UpdateBotRuleDto } from './dto/bot-rule.dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { AiService } from '../ai/ai.service';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';

const ALLOWED_LANGUAGES = ['es'];
const ALLOWED_CURRENCIES = ['PEN'];

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappWebService))
    private whatsappWebService: WhatsappWebService,
    private telegramService: TelegramService,
    private readonly websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
  ) {}

  private isAdminRole(role?: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }

  async getBotRules(ownerId: string | undefined, businessId: string, role?: UserRole) {
    if (!this.isAdminRole(role)) {
      if (!ownerId) {
        throw new BadRequestException('Owner ID is required');
      }
      await this.ensureBusinessOwnership(ownerId, businessId);
    }

    return this.prisma.botRule.findMany({
      where: { businessId },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async createBotRule(
    ownerId: string | undefined,
    businessId: string,
    payload: CreateBotRuleDto,
    role?: UserRole,
  ) {
    if (!this.isAdminRole(role)) {
      if (!ownerId) {
        throw new BadRequestException('Owner ID is required');
      }
      await this.ensureBusinessOwnership(ownerId, businessId);
    }

    if (!payload.name?.trim()) {
      throw new BadRequestException('El nombre de la regla es obligatorio');
    }
    if (!payload.responseText?.trim()) {
      throw new BadRequestException('La respuesta automática es obligatoria');
    }

    const triggerType = this.normalizeTriggerType(payload.triggerType);
    const scope = this.normalizeScope(payload.scope);
    const engine = this.normalizeEngine(payload.engine);
    const keywords = (payload.keywords || [])
      .map((keyword) => keyword.trim())
      .filter((keyword) => Boolean(keyword));
    const channels = this.resolveChannels(scope, payload.channels);
    const responseMedia = this.sanitizeMediaMap(payload.mediaByType);

    const rule = await this.prisma.botRule.create({
      data: {
        business: { connect: { id: businessId } },
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        triggerType,
        triggerValue: payload.triggerValue?.trim() || null,
        keywords,
        responseText: payload.responseText.trim(),
        responseMedia: responseMedia || undefined,
        mediaIds: payload.mediaIds || [],
        channels,
        scope,
        engine,
        active: payload.active ?? true,
        priority: payload.priority ?? 100,
        metadata: payload.metadata || undefined,
      },
    });
  }

  async updateBotRule(
    ownerId: string | undefined,
    businessId: string,
    ruleId: string,
    payload: UpdateBotRuleDto,
    role?: UserRole,
  ) {
    if (!this.isAdminRole(role)) {
      if (!ownerId) {
        throw new BadRequestException('Owner ID is required');
      }
      await this.ensureBusinessOwnership(ownerId, businessId);
    }

    const rule = await this.prisma.botRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) {
      throw new NotFoundException('La regla no existe para este negocio');
    }

    const data: Prisma.BotRuleUpdateInput = {};

    if (payload.name !== undefined) {
      if (!payload.name.trim()) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = payload.name.trim();
    }
    if (payload.description !== undefined) {
      data.description = payload.description.trim() || null;
    }
    if (payload.triggerType !== undefined) {
      data.triggerType = this.normalizeTriggerType(payload.triggerType);
    }
    if (payload.triggerValue !== undefined) {
      data.triggerValue = payload.triggerValue.trim() || null;
    }
    if (payload.keywords) {
      data.keywords = payload.keywords
        .map((keyword) => keyword.trim())
        .filter((keyword) => Boolean(keyword));
    }
    if (payload.responseText !== undefined) {
      if (!payload.responseText.trim()) {
        throw new BadRequestException('La respuesta no puede estar vacía');
      }
      data.responseText = payload.responseText.trim();
    }
    if (payload.mediaByType !== undefined) {
      data.responseMedia = this.sanitizeMediaMap(payload.mediaByType);
    }
    if (payload.mediaIds) {
      data.mediaIds = payload.mediaIds;
    }
    if (payload.scope !== undefined || payload.channels !== undefined) {
      const scope = payload.scope ? this.normalizeScope(payload.scope) : (rule.scope as BotRuleScope);
      data.scope = scope;
      const channels = this.resolveChannels(scope, payload.channels ?? rule.channels);
      data.channels = channels;
    }
    if (payload.engine !== undefined) {
      data.engine = this.normalizeEngine(payload.engine);
    }
    if (payload.active !== undefined) {
      data.active = payload.active;
    }
    if (payload.priority !== undefined) {
      data.priority = payload.priority;
    }
    if (payload.metadata !== undefined) {
      data.metadata = payload.metadata;
    }

    const updated = await this.prisma.botRule.update({
      where: { id: ruleId },
      data,
    });

    this.websocketGateway.emitBotRuleEvent(businessId, {
      action: 'updated',
      rule: updated,
    });

    return updated;
  }

  async deleteBotRule(ownerId: string | undefined, businessId: string, ruleId: string, role?: UserRole) {
    if (!this.isAdminRole(role)) {
      if (!ownerId) {
        throw new BadRequestException('Owner ID is required');
      }
      await this.ensureBusinessOwnership(ownerId, businessId);
    }

    const rule = await this.prisma.botRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) {
      throw new NotFoundException('La regla no existe para este negocio');
    }

    await this.prisma.botRule.delete({ where: { id: ruleId } });

    this.websocketGateway.emitBotRuleEvent(businessId, {
      action: 'deleted',
      rule: { id: ruleId } as any, // Cast to any to avoid property mismatch
    });

    return { success: true };
  }

  async getSocialSettings(ownerId: string | undefined, businessId: string, role?: UserRole) {
    if (!this.isAdminRole(role)) {
      if (!ownerId) {
        throw new BadRequestException('Owner ID is required');
      }
      await this.ensureBusinessOwnership(ownerId, businessId);
    }

    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: {
        // Cast to any to bypass temporary type errors until prisma generate succeeds
        socialFrequency: true,
        socialTimezone: true,
        socialAllowedStart: true,
        socialAllowedEnd: true,
        socialMinSpacing: true,
        socialStagger: true,
        socialNotifyEmail: true,
        socialNotifyWhatsapp: true,
        socialNotifyPush: true,
      } as any,
    });

    if (!config) {
      // Return defaults if no config exists
      return {
        socialFrequency: '3_week',
        socialTimezone: 'America/Bogota',
        socialAllowedStart: '08:00',
        socialAllowedEnd: '22:00',
        socialMinSpacing: 20,
        socialStagger: true,
        socialNotifyEmail: true,
        socialNotifyWhatsapp: true,
        socialNotifyPush: true,
      };
    }

    return config;
  }

  async updateSocialChannels(ownerId: string | undefined, businessId: string, channels: any[], role?: UserRole) {
    if (!this.isAdminRole(role)) {
      if (!ownerId) {
        throw new BadRequestException('Owner ID is required');
      }
      await this.ensureBusinessOwnership(ownerId, businessId);
    }

    // Guardar los canales en la tabla de Business como JSON o similar
    // Para simplificar, usamos allowedSocials que ya existe como String[]
    const channelsString = channels.map(c => JSON.stringify(c));

    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        allowedSocials: channelsString
      },
      select: {
        allowedSocials: true
      }
    });
  }

  async ensureBusinessOwnership(ownerId: string, businessId: string) {
    console.log('ensureBusinessOwnership - ownerId:', ownerId);
    console.log('ensureBusinessOwnership - businessId:', businessId);
    
    // Check if the user is SUPER_ADMIN to bypass ownership checks
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { role: true }
    });

    if (user?.role === 'SUPER_ADMIN') {
      console.log('🚀 ensureBusinessOwnership: Super Admin bypassed ownership check for business:', businessId);
      const business = await this.prisma.business.findUnique({
        where: { id: businessId }
      });
      if (!business) {
        throw new NotFoundException(`Business with ID ${businessId} not found`);
      }
      return business;
    }
    
    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId,
      },
    });

    console.log('ensureBusinessOwnership - business found:', business);

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found for this user`);
    }

    return business;
  }

  private normalizeTriggerType(value?: string): BotRuleTriggerType {
    if (!value) {
      throw new BadRequestException('triggerType is required');
    }
    const normalized = value.toUpperCase() as BotRuleTriggerType;
    if (!Object.values(BotRuleTriggerType).includes(normalized)) {
      throw new BadRequestException(`Invalid triggerType: ${value}`);
    }
    return normalized;
  }

  private normalizeScope(value?: string): BotRuleScope {
    if (!value) {
      throw new BadRequestException('scope is required');
    }
    const normalized = value.toUpperCase() as BotRuleScope;
    if (!Object.values(BotRuleScope).includes(normalized)) {
      throw new BadRequestException(`Invalid scope: ${value}`);
    }
    return normalized;
  }

  private normalizeEngine(value?: string): BotRuleEngine {
    if (!value) {
      throw new BadRequestException('engine is required');
    }
    const normalized = value.toUpperCase() as BotRuleEngine;
    if (!Object.values(BotRuleEngine).includes(normalized)) {
      throw new BadRequestException(`Invalid engine: ${value}`);
    }
    return normalized;
  }

  private resolveChannels(scope: BotRuleScope, channels?: string[]) {
    if (scope === BotRuleScope.ALL) {
      return [];
    }
    const normalized = (channels || [])
      .map((channel) => channel?.trim())
      .filter((channel): channel is string => Boolean(channel));
    if (!normalized.length) {
      throw new BadRequestException('Selecciona al menos un canal para esta regla');
    }
    return normalized;
  }

  private sanitizeMediaMap(mediaByType?: CreateBotRuleDto['mediaByType']) {
    if (!mediaByType) return undefined;
    const allowedKeys: Array<keyof NonNullable<CreateBotRuleDto['mediaByType']>> = ['image', 'pdf', 'audio', 'video'];
    const sanitized: Record<string, string | null> = {};
    for (const key of allowedKeys) {
      if (mediaByType[key] !== undefined) {
        sanitized[key] = mediaByType[key];
      }
    }
    return sanitized;
  }

  getIndustryPresets() {
    return {
      presets: INDUSTRY_PRESETS,
      defaultPreset: DEFAULT_INDUSTRY_PRESET,
    };
  }

  async create(ownerId: string, createBusinessDto: CreateBusinessDto) {
    try {
      const owner = await this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true }
      });

      if (!owner) {
        console.error(`Owner ${ownerId} not found when creating business`);
        throw new BadRequestException('Owner not found');
      }

      const preset = INDUSTRY_PRESETS[createBusinessDto.industryType] || DEFAULT_INDUSTRY_PRESET;
      const businessName = createBusinessDto.name.trim();

      const business = await this.prisma.business.create({
        data: {
          ...createBusinessDto,
          categories: preset.defaultCategories,
          ownerId,
          isActive: true,
          botConfig: {
            create: {
              welcomeMessage: preset.welcomeTemplate.replace('{businessName}', businessName),
              fallbackMessage: preset.fallbackTemplate.replace('{businessName}', businessName),
              customPrompt: preset.promptTemplate.replace('{businessName}', businessName),
              autoReply: false,
              audioEnabled: false,
              whatsappWebEnabled: true,
              aiProvider: 'OPENAI',
              aiModel: 'gpt-4o',
              businessHours: {
                monday: { active: true, open: '09:00', close: '18:00' },
                tuesday: { active: true, open: '09:00', close: '18:00' },
                wednesday: { active: true, open: '09:00', close: '18:00' },
                thursday: { active: true, open: '09:00', close: '18:00' },
                friday: { active: true, open: '09:00', close: '18:00' },
                saturday: { active: false, open: '09:00', close: '13:00' },
                sunday: { active: false, open: '09:00', close: '13:00' },
              },
            }
          }
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          botConfig: true,
          whatsappAccounts: true,
          _count: {
            select: {
              messages: true,
              appointments: true,
              orders: true,
              leads: true,
              files: true,
            },
          },
        },
      });

      return business;
    } catch (error: any) {
      console.error('Error creating business:', error);
      throw new BadRequestException('No se pudo crear el negocio');
    }
  }

  async findAll(ownerId?: string) {
    try {
      const businesses = await this.prisma.business.findMany({
        where: ownerId ? { ownerId } : undefined,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          botConfig: true,
          whatsappAccounts: true,
          _count: {
            select: {
              messages: true,
              appointments: true,
              orders: true,
              leads: true,
              files: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log(`findAll: Found ${businesses.length} businesses for user ${ownerId}`);
      return businesses;
    } catch (error: any) {
      console.error('Error in findAll:', error);
      return [];
    }
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        botConfig: true,
        whatsappAccounts: true,
        _count: {
          select: {
            messages: true,
            appointments: true,
            orders: true,
            leads: true,
            files: true,
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    return business;
  }

  async update(id: string, updateBusinessDto: UpdateBusinessDto) {
    return this.prisma.business.update({
      where: { id },
      data: updateBusinessDto,
    });
  }

  async remove(id: string) {
    // 1. Limpiar recursos de WhatsApp Web (Sesiones físicas)
    try {
      await this.whatsappWebService.closeClient(id);
      const sessionPath = join(process.cwd(), 'whatsapp_sessions', id);
      if (existsSync(sessionPath)) {
        rmSync(sessionPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Error cleaning up WhatsApp session for business ${id}:`, error);
    }

    // 2. Limpiar archivos físicos y conocimiento RAG
    try {
      const files = await this.prisma.file.findMany({
        where: { businessId: id },
      });

      for (const file of files) {
        // Eliminar conocimiento del vector DB
        try {
          await this.aiService.deleteFileKnowledge(id, file.id);
        } catch (error) {
          console.warn(`Error deleting knowledge for file ${file.id}:`, error);
        }

        // Eliminar archivo físico
        if (existsSync(file.url)) {
          rmSync(file.url, { force: true });
        }
      }
    } catch (error) {
      console.warn(`Error cleaning up files for business ${id}:`, error);
    }

    // 3. Eliminar de la base de datos (Prisma se encarga de las relaciones en cascada)
    return this.prisma.business.delete({
      where: { id: id },
    });
  }

  async updateBotConfig(ownerId: string, businessId: string, config: any, role?: UserRole) {
    console.log('updateBotConfig - ownerId:', ownerId);
    console.log('updateBotConfig - businessId:', businessId);
    console.log('updateBotConfig - config:', config);
    
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId, businessId);
    }
    
    // Filtrar valores null, undefined y strings vacíos
    const cleanedConfig = Object.keys(config).reduce((acc, key) => {
      const value = config[key];
      // Solo incluir valores válidos (no null, no undefined, strings no vacíos)
      // Para campos opcionales como aiBaseUrl, si viene vacío, no lo incluimos
      // IMPORTANTE: aiApiKey siempre debe incluirse si viene, incluso si está vacío (para permitir limpiarlo)
      if (value !== null && value !== undefined) {
        // Si es string, verificar que no esté vacío (excepto para algunos campos que pueden ser vacíos intencionalmente)
        if (typeof value === 'string' && value.trim() === '' && key !== 'customPrompt' && key !== 'aiApiKey') {
          // No incluir strings vacíos (excepto customPrompt y aiApiKey que pueden ser vacíos intencionalmente)
          return acc;
        }
        
        // Mapear destinationNumber a whatsappWebNumber
        if (key === 'destinationNumber') {
          acc['whatsappWebNumber'] = value;
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as any);
    
    console.log('updateBotConfig - cleanedConfig:', cleanedConfig);
    
    // Obtener configuración actual para comparar
    const currentConfig = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { whatsappWebEnabled: true, whatsappApiEnabled: true, whatsappMode: true },
    });

    console.log('updateBotConfig - currentConfig:', currentConfig);

    const updated = await this.prisma.botConfig.upsert({
      where: { businessId },
      update: cleanedConfig,
      create: {
        businessId,
        ...cleanedConfig,
        // Valores por defecto si no se proporcionan
        welcomeMessage: cleanedConfig.welcomeMessage || '¡Hola! 👋 Bienvenido a nuestro negocio. ¿En qué podemos ayudarte?',
        fallbackMessage: cleanedConfig.fallbackMessage || 'En este momento no estamos disponibles. Te responderemos pronto.',
        autoReply: cleanedConfig.autoReply ?? true,
        audioEnabled: cleanedConfig.audioEnabled ?? false,
        aiProvider: cleanedConfig.aiProvider || 'OPENAI',
        aiModel: cleanedConfig.aiModel || 'gpt-4o',
        whatsappWebEnabled: cleanedConfig.whatsappWebEnabled ?? false,
        whatsappApiEnabled: cleanedConfig.whatsappApiEnabled ?? false,
        whatsappMode: cleanedConfig.whatsappMode || 'WHATSAPP_WEB',
        // Mapear destinationNumber a whatsappWebNumber si existe
        ...(cleanedConfig.destinationNumber && { whatsappWebNumber: cleanedConfig.destinationNumber }),
      },
    });

    console.log('updateBotConfig - updated:', updated);

    // Determinar si WhatsApp Web está habilitado (nuevo valor o valor actual si no se especifica)
    const whatsappWebEnabled = config.whatsappWebEnabled !== undefined 
      ? config.whatsappWebEnabled 
      : (config.whatsappMode === 'WHATSAPP_WEB' || currentConfig?.whatsappWebEnabled === true);

    // Determinar si WhatsApp API está habilitado
    const whatsappApiEnabled = config.whatsappApiEnabled !== undefined
      ? config.whatsappApiEnabled
      : (config.whatsappMode === 'WHATSAPP_API' || currentConfig?.whatsappApiEnabled === true);

    // Manejar WhatsApp Web
    if (whatsappWebEnabled) {
      // Inicializar si está habilitado
      try {
        await this.whatsappWebService.initializeClient(businessId);
      } catch (error) {
        console.error('Error initializing WhatsApp Web after config update:', error);
        // No lanzar error, solo loguear
      }
    } else {
      // Cerrar si está deshabilitado
      try {
        await this.whatsappWebService.closeClient(businessId);
      } catch (error) {
        console.error('Error closing WhatsApp Web after config update:', error);
        // No lanzar error, solo loguear
      }
    }

    return updated;
  }

  async getBotConfig(ownerId: string, businessId: string, role?: UserRole) {
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId, businessId);
    }
    return this.prisma.botConfig.findUnique({
      where: { businessId },
    });
  }

  async connectTelegram(
    ownerId: string | undefined,
    businessId: string,
    payload: { botToken: string; webhookUrl?: string },
    role?: UserRole,
  ) {
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId!, businessId);
    }

    if (!payload?.botToken?.trim()) {
      throw new BadRequestException('Telegram bot token is required');
    }

    return this.telegramService.connect(businessId, payload.botToken.trim(), payload.webhookUrl, ownerId);
  }

  async disconnectTelegram(ownerId: string | undefined, businessId: string, role?: UserRole) {
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId!, businessId);
    }

    return this.telegramService.disconnect(businessId, ownerId);
  }

  async startTelegramPersonalSetup(
    ownerId: string | undefined,
    businessId: string,
    payload: { apiId: string; apiHash: string; phone: string },
    role?: UserRole,
  ) {
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId!, businessId);
    }

    if (!payload.apiId?.trim() || !payload.apiHash?.trim() || !payload.phone?.trim()) {
      throw new BadRequestException('apiId, apiHash y teléfono son obligatorios');
    }

    const generatedCode = (Math.floor(100000 + Math.random() * 900000)).toString();

    const config = await this.prisma.botConfig.upsert({
      where: { businessId },
      update: {
        telegramMode: TelegramIntegrationMode.PERSONAL,
        telegramApiId: payload.apiId.trim(),
        telegramApiHash: payload.apiHash.trim(),
        telegramPhone: payload.phone.trim(),
        telegramAuthStatus: TelegramAuthStatus.CODE_REQUIRED,
        telegramPendingCode: generatedCode,
        telegramLastError: null,
        telegramEnabled: true,
        telegramConnected: false,
      },
      create: {
        businessId,
        telegramMode: TelegramIntegrationMode.PERSONAL,
        telegramApiId: payload.apiId.trim(),
        telegramApiHash: payload.apiHash.trim(),
        telegramPhone: payload.phone.trim(),
        telegramAuthStatus: TelegramAuthStatus.CODE_REQUIRED,
        telegramPendingCode: generatedCode,
        telegramEnabled: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'TELEGRAM_PERSONAL_START',
        targetId: businessId,
        targetType: 'BUSINESS',
        performedBy: ownerId || 'SYSTEM',
        details: {
          mode: 'PERSONAL',
          phone: payload.phone,
        },
      },
    });

    return {
      status: config.telegramAuthStatus,
      codeHint: 'Se generó un código de verificación interno. Ingresa el código recibido para continuar.',
    };
  }

  async verifyTelegramPersonalCode(
    ownerId: string | undefined,
    businessId: string,
    payload: { code: string },
    role?: UserRole,
  ) {
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId!, businessId);
    }

    if (!payload.code?.trim()) {
      throw new BadRequestException('Ingresa el código de verificación');
    }

    const config = await this.prisma.botConfig.findUnique({ where: { businessId } });
    if (!config || config.telegramMode !== TelegramIntegrationMode.PERSONAL) {
      throw new BadRequestException('El modo personal de Telegram no está configurado');
    }

    if (config.telegramPendingCode !== payload.code.trim()) {
      throw new BadRequestException('Código de verificación inválido');
    }

    await this.prisma.botConfig.update({
      where: { businessId },
      data: {
        telegramAuthStatus: TelegramAuthStatus.CONNECTED,
        telegramPendingCode: null,
        telegramConnected: true,
        telegramLastSyncAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'TELEGRAM_PERSONAL_VERIFY',
        targetId: businessId,
        targetType: 'BUSINESS',
        performedBy: ownerId || 'SYSTEM',
      },
    });

    return { connected: true };
  }

  async disconnectTelegramPersonal(ownerId: string | undefined, businessId: string, role?: UserRole) {
    if (!this.isAdminRole(role)) {
      await this.ensureBusinessOwnership(ownerId!, businessId);
    }

    await this.prisma.botConfig.update({
      where: { businessId },
      data: {
        telegramMode: TelegramIntegrationMode.BOT,
        telegramApiId: null,
        telegramApiHash: null,
        telegramPhone: null,
        telegramSessionData: null,
        telegramPendingCode: null,
        telegramAuthStatus: TelegramAuthStatus.NOT_CONFIGURED,
        telegramConnected: false,
        telegramEnabled: false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'TELEGRAM_PERSONAL_DISCONNECT',
        targetId: businessId,
        targetType: 'BUSINESS',
        performedBy: ownerId || 'SYSTEM',
      },
    });
  }

  async getDashboardMetrics(businessId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalMessages,
      messagesHandledByAI,
      appointmentsToday,
      ordersToday,
      leadsGenerated,
      averageResponseTime,
      activeConversations,
    ] = await Promise.all([
      this.prisma.message.count({
        where: { businessId },
      }),
      this.prisma.message.count({
        where: { businessId, aiResponse: true },
      }),
      this.prisma.appointment.count({
        where: {
          businessId,
          appointmentDate: { gte: today },
        },
      }),
      this.prisma.order.count({
        where: {
          businessId,
          createdAt: { gte: today },
        },
      }),
      this.prisma.lead.count({
        where: { businessId },
      }),
      this.prisma.message.aggregate({
        where: {
          businessId,
          aiResponse: true,
          processingTime: { not: null },
        },
        _avg: {
          processingTime: true,
        },
      }),
      this.prisma.message.groupBy({
        by: ['from'],
        where: {
          businessId,
          createdAt: { gte: last24h },
        },
      }).then(groups => groups.length),
    ]);

    return {
      totalMessages,
      messagesHandledByAI,
      averageResponseTime: averageResponseTime._avg.processingTime || 0,
      activeConversations,
      appointmentsToday,
      ordersToday,
      leadsGenerated,
    };
  }

  async getRecentActivity(businessId: string, limit: number = 5) {
    const messages = await this.prisma.message.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        whatsappAccount: {
          select: { phoneNumber: true, displayName: true }
        }
      }
    });

    return messages.map(m => ({
      id: m.id,
      type: 'MESSAGE',
      content: m.content,
      from: m.from,
      to: m.to,
      direction: m.direction,
      status: m.status,
      createdAt: m.createdAt,
      aiResponse: m.aiResponse,
      platform: m.platform || 'WHATSAPP_API'
    }));
  }

  // ===== BUSINESS OWNER CONFIGURATION METHODS =====

  async getPaymentSettings(ownerId: string, businessId: string) {
    await this.ensureBusinessOwnership(ownerId, businessId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        email: true,
        paymentGateway: true,
        whatsappNumber: true,
        paymentWebhookUrl: true,
        budgetAlertThreshold: true,
        budget: {
          select: {
            monthlyBudget: true
          }
        }
      },
    });

    return {
      email: business?.email,
      gateway: business?.paymentGateway,
      whatsappNumber: business?.whatsappNumber,
      webhookUrl: business?.paymentWebhookUrl,
      monthlyBudget: business?.budget?.monthlyBudget,
      alertThreshold: business?.budgetAlertThreshold,
    };
  }

  async updatePaymentSettings(ownerId: string, businessId: string, settings: {
    email?: string;
    gateway?: string;
    whatsappNumber?: string;
    paymentWebhookUrl?: string;
  }) {
    await this.ensureBusinessOwnership(ownerId, businessId);

    // Validate gateway if provided
    if (settings.gateway && !['stripe', 'paypal', 'mercadopago', 'transbank'].includes(settings.gateway.toLowerCase())) {
      throw new BadRequestException('Invalid payment gateway');
    }

    // Validate WhatsApp number format if provided
    if (settings.whatsappNumber && !/^\+\d{10,15}$/.test(settings.whatsappNumber)) {
      throw new BadRequestException('Invalid WhatsApp number format. Use international format: +1234567890');
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        email: settings.email,
        paymentGateway: settings.gateway?.toUpperCase() as any,
        whatsappNumber: settings.whatsappNumber,
        paymentWebhookUrl: settings.paymentWebhookUrl,
      },
      select: {
        id: true,
        name: true,
        email: true,
        paymentGateway: true,
        whatsappNumber: true,
        paymentWebhookUrl: true,
      },
    });
  }

  async getContactSettings(ownerId: string, businessId: string) {
    await this.ensureBusinessOwnership(ownerId, businessId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        supportEmail: true,
        supportPhone: true,
        timezone: true,
        botConfig: {
          select: {
            businessHours: true
          }
        }
      },
    });

    return {
      supportEmail: business?.supportEmail,
      supportPhone: business?.supportPhone,
      businessHours: business?.botConfig?.businessHours || this.getDefaultBusinessHours(),
      timezone: business?.timezone || 'America/Santiago',
    };
  }

  async updateContactSettings(ownerId: string, businessId: string, settings: {
    supportEmail?: string;
    supportPhone?: string;
    businessHours?: any;
    timezone?: string;
  }) {
    await this.ensureBusinessOwnership(ownerId, businessId);

    // Validate email format
    if (settings.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone format
    if (settings.supportPhone && !/^\+\d{10,15}$/.test(settings.supportPhone)) {
      throw new BadRequestException('Invalid phone number format. Use international format: +1234567890');
    }

    // Validate timezone
    if (settings.timezone && !/^[A-Za-z]+\/[A-Za-z_]+$/.test(settings.timezone)) {
      throw new BadRequestException('Invalid timezone format');
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        timezone: settings.timezone,
        ...(settings.businessHours ? {
          botConfig: {
            upsert: {
              create: { businessHours: settings.businessHours },
              update: { businessHours: settings.businessHours }
            }
          }
        } : {})
      },
      select: {
        id: true,
        name: true,
        supportEmail: true,
        supportPhone: true,
        timezone: true,
        botConfig: {
          select: {
            businessHours: true
          }
        }
      },
    });
  }

  async getBusinessPreferences(ownerId: string, businessId: string) {
    await this.ensureBusinessOwnership(ownerId, businessId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        language: true,
        currency: true,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        dataRetentionDays: true,
        allowAnalytics: true,
        shareData: true,
      },
    });

    return {
      language: business?.language || ALLOWED_LANGUAGES[0],
      currency: business?.currency || ALLOWED_CURRENCIES[0],
      notifications: {
        emailNotifications: business?.emailNotifications ?? true,
        smsNotifications: business?.smsNotifications ?? false,
        pushNotifications: business?.pushNotifications ?? true,
      },
      privacy: {
        dataRetentionDays: business?.dataRetentionDays || 365,
        allowAnalytics: business?.allowAnalytics ?? true,
        shareData: business?.shareData ?? false,
      },
    };
  }

  async updateBusinessPreferences(ownerId: string, businessId: string, preferences: {
    language?: string;
    currency?: string;
    notifications?: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
    };
    privacy?: {
      dataRetentionDays?: number;
      allowAnalytics?: boolean;
      shareData?: boolean;
    };
  }) {
    await this.ensureBusinessOwnership(ownerId, businessId);

    // Validate language
    if (preferences.language && !ALLOWED_LANGUAGES.includes(preferences.language)) {
      throw new BadRequestException(`Invalid language. Supported: ${ALLOWED_LANGUAGES.join(', ')}`);
    }

    // Validate currency
    if (preferences.currency && !ALLOWED_CURRENCIES.includes(preferences.currency)) {
      throw new BadRequestException(`Invalid currency. Supported: ${ALLOWED_CURRENCIES.join(', ')}`);
    }

    // Validate data retention
    if (preferences.privacy?.dataRetentionDays && (
      preferences.privacy.dataRetentionDays < 30 ||
      preferences.privacy.dataRetentionDays > 2555
    )) {
      throw new BadRequestException('Data retention must be between 30 and 2555 days');
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        language: preferences.language,
        currency: preferences.currency,
        emailNotifications: preferences.notifications?.emailNotifications,
        smsNotifications: preferences.notifications?.smsNotifications,
        pushNotifications: preferences.notifications?.pushNotifications,
        dataRetentionDays: preferences.privacy?.dataRetentionDays,
        allowAnalytics: preferences.privacy?.allowAnalytics,
        shareData: preferences.privacy?.shareData,
      },
      select: {
        id: true,
        name: true,
        language: true,
        currency: true,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        dataRetentionDays: true,
        allowAnalytics: true,
        shareData: true,
      },
    });
  }

  private getDefaultBusinessHours() {
    return {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '14:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    };
  }

  // Método para activar/desactivar características por industria
  async toggleIndustryFeature(industryType: string, feature: string, enabled: boolean, user: any) {
    // Solo admin y super admin pueden hacer esto
    if (!this.isAdminRole(user.role)) {
      throw new BadRequestException('No tienes permisos para realizar esta acción');
    }

    // Obtener todos los negocios de la industria
    const businesses = await this.prisma.business.findMany({
      where: {
        industryType: industryType as any
      }
    });

    // Obtener configuraciones de bot por separado
    const businessIds = businesses.map(b => b.id);
    const botConfigs = await this.prisma.botConfig.findMany({
      where: {
        businessId: {
          in: businessIds
        }
      }
    });

    // Combinar datos
    const businessesWithConfig = businesses.map(business => ({
      ...business,
      botConfig: botConfigs.find(config => config.businessId === business.id) || null
    }));

    if (businesses.length === 0) {
      throw new BadRequestException(`No se encontraron negocios para la industria ${industryType}`);
    }

    // Preparar datos de actualización según la característica
    let updateData: any = {};
    
    switch (feature) {
      case 'audio':
        updateData = { audioEnabled: enabled };
        break;
      case 'calls':
        updateData = { callEnabled: enabled };
        break;
      case 'autoreply':
        updateData = { autoReply: enabled };
        break;
      case 'whatsapp':
        updateData = { whatsappWebEnabled: enabled };
        break;
      default:
        throw new BadRequestException(`Característica no válida: ${feature}`);
    }

    // Actualizar todos los negocios de la industria
    const results = await Promise.allSettled(
      businessesWithConfig.map(async (business) => {
        if (business.botConfig) {
          return this.prisma.botConfig.update({
            where: { businessId: business.id },
            data: updateData
          });
        } else {
          // Si no tiene configuración, crear una
          return this.prisma.botConfig.create({
            data: {
              businessId: business.id,
              welcomeMessage: '¡Hola! 👋 Bienvenido a nuestro negocio. ¿En qué podemos ayudarte?',
              fallbackMessage: 'Gracias por contactarnos. Te responderemos pronto.',
              autoReply: feature === 'autoreply' ? enabled : true,
              audioEnabled: feature === 'audio' ? enabled : false,
              whatsappWebEnabled: feature === 'whatsapp' ? enabled : true,
              aiProvider: 'OPENAI',
              aiModel: 'gpt-4o',
              ...updateData
            }
          });
        }
      })
    );

    // Verificar resultados
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    return {
      industryType,
      feature,
      enabled,
      totalBusinesses: businesses.length,
      successful,
      failed,
      message: `${feature} ${enabled ? 'activado' : 'desactivado'} para ${successful}/${businesses.length} negocios de ${industryType}`
    };
  }

  // Método para obtener estadísticas por industria
  async getIndustriesStats() {
    const businesses = await this.prisma.business.findMany({
      include: {
        botConfig: true
      }
    });

    // Agrupar por industria
    const industries: Record<string, any> = {};
    
    businesses.forEach(business => {
      const industry = business.industryType || 'OTHER';
      
      if (!industries[industry]) {
        industries[industry] = {
          type: industry,
          name: this.getIndustryName(industry),
          total: 0,
          withAudio: 0,
          withAutoReply: 0,
          withWhatsApp: 0,
          withCalls: 0,
          businesses: []
        };
      }
      
      industries[industry].total++;
      industries[industry].businesses.push({
        id: business.id,
        name: business.name,
        isActive: business.isActive,
        botConfig: business.botConfig
      });
      
      if (business.botConfig) {
        if (business.botConfig.audioEnabled) industries[industry].withAudio++;
        if (business.botConfig.autoReply) industries[industry].withAutoReply++;
        if (business.botConfig.whatsappWebEnabled) industries[industry].withWhatsApp++;
        // callEnabled no existe en el modelo actual, se puede agregar en el futuro
        // if (business.botConfig.callEnabled) industries[industry].withCalls++;
      }
    });

    return Object.values(industries);
  }

  private getIndustryName(industryType: string): string {
    const names: Record<string, string> = {
      'RESTAURANT': 'Restaurantes',
      'CLINIC': 'Clínicas',
      'REAL_ESTATE': 'Inmobiliarias',
      'ACADEMY': 'Academias',
      'RETAIL': 'Retail',
      'SERVICES': 'Servicios',
      'OTHER': 'Otros'
    };
    return names[industryType] || industryType;
  }
}
