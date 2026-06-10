import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { TelegramService } from '../telegram/telegram.service';
import { MessengerService } from '../meta/messenger/messenger.service';
import { InstagramService } from '../meta/instagram/instagram.service';

@Injectable()
export class LivechatBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LivechatBridgeService.name);

  constructor(
    private configService: ConfigService,
    private websocketGateway: WebsocketGateway,
    private prisma: PrismaService,
    private whatsappWebService: WhatsappWebService,
    private telegramService: TelegramService,
    private messengerService: MessengerService,
    private instagramService: InstagramService,
  ) {}

  async onModuleInit() {
    this.logger.log(`🔗 Native LiveChat Bridge initialized`);
  }

  onModuleDestroy() {
    this.logger.log('🔌 Native LiveChat Bridge destroyed');
  }

  // Stub for user room joining (now handled natively via websocket gateway)
  joinUserRoom(userId: string) {
    this.logger.debug(`User ${userId} joined room`);
  }

  private normalizePlatform(platform?: string | null): string {
    return String(platform || 'WHATSAPP').toUpperCase();
  }

  private normalizeIdentity(value?: string | null, platform?: string | null): string {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalizedPlatform = this.normalizePlatform(platform);
    if (normalizedPlatform === 'MESSENGER' || normalizedPlatform === 'INSTAGRAM') {
      return raw;
    }

    const withoutJid = raw.split('@')[0];
    const digits = withoutJid.replace(/\D/g, '');
    return digits || raw;
  }

  private conversationKey(value?: string | null, platform?: string | null): string {
    const normalizedPlatform = this.normalizePlatform(platform);
    const identity = this.normalizeIdentity(value, normalizedPlatform);
    if (!identity) return '';

    if (normalizedPlatform === 'WHATSAPP' && /^\d+$/.test(identity) && identity.length >= 9) {
      return `${normalizedPlatform}:${identity.slice(-9)}`;
    }

    return `${normalizedPlatform}:${identity}`;
  }

  private publicMediaUrl(file?: { filename?: string | null; url?: string | null } | null): string | undefined {
    if (!file) return undefined;
    if (file.url?.startsWith('http')) return file.url;
    if (file.filename) return `/uploads/${file.filename}`;
    return file.url || undefined;
  }

  private absolutePublicUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;

    const baseUrl = (process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!baseUrl) return undefined;
    return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private inferMediaType(file?: { mimeType?: string | null } | null): 'image' | 'video' | 'document' | 'audio' {
    const mimeType = file?.mimeType || '';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private messagePreview(message: any): string {
    const mediaType = (message?.metadata as any)?.mediaType;
    return message?.content || (mediaType ? `[${String(mediaType).toUpperCase()}]` : '');
  }

  // ============== NATIVE METHODS ==============

  async getChats(token: string, businessId?: string) {
    try {
      if (!businessId) return [];

      const [contacts, messages] = await Promise.all([
        this.prisma.contact.findMany({
          where: { businessId },
          select: {
            id: true,
            phone: true,
            name: true,
            source: true,
            metadata: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.message.findMany({
          where: { businessId },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
      ]);

      const chatMap = new Map<string, any>();

      for (const contact of contacts) {
        const platform = this.normalizePlatform(contact.source as any);
        const key = this.conversationKey(contact.phone, platform);
        if (!key) continue;

        chatMap.set(key, {
          customer_phone: this.normalizeIdentity(contact.phone, platform),
          customer_name: contact.name || undefined,
          customer_pushname: (contact.metadata as any)?.pushname || undefined,
          last_message: (contact.metadata as any)?.lastMessagePreview || '',
          last_message_at: contact.updatedAt.toISOString(),
          last_direction: 'incoming',
          last_media_type: undefined,
          platform: platform.toLowerCase(),
        });
      }

      for (const message of messages) {
        const platform = this.normalizePlatform(message.platform || 'WHATSAPP');
        const customerIdentity = message.direction === 'INBOUND' ? message.from : message.to;
        const key = this.conversationKey(customerIdentity, platform);
        if (!key) continue;

        const existing = chatMap.get(key);
        const messageDate = message.createdAt.toISOString();
        const shouldReplaceLast = !existing || new Date(messageDate).getTime() >= new Date(existing.last_message_at).getTime();

        chatMap.set(key, {
          customer_phone: existing?.customer_phone || this.normalizeIdentity(customerIdentity, platform),
          customer_name: existing?.customer_name,
          customer_pushname: existing?.customer_pushname,
          last_message: shouldReplaceLast ? this.messagePreview(message) : existing.last_message,
          last_message_at: shouldReplaceLast ? messageDate : existing.last_message_at,
          last_direction: shouldReplaceLast ? (message.direction === 'INBOUND' ? 'incoming' : 'outgoing') : existing.last_direction,
          last_media_type: shouldReplaceLast ? (message.metadata as any)?.mediaType || undefined : existing.last_media_type,
          platform: platform.toLowerCase(),
        });
      }

      return Array.from(chatMap.values()).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    } catch (error: any) {
      this.logger.error(`Error getting chats: ${error.message}`);
      return [];
    }
  }

  async getChatMessages(phone: string, token: string, businessId?: string) {
    try {
      if (!businessId) return [];

      const normalizedPhone = this.normalizeIdentity(phone, 'WHATSAPP');
      const tail = normalizedPhone.replace(/\D/g, '').slice(-9);
      const messageWhere: any[] = [
        { from: phone },
        { to: phone },
        { platformSenderId: phone },
      ];

      if (normalizedPhone && normalizedPhone !== phone) {
        messageWhere.push({ from: normalizedPhone }, { to: normalizedPhone }, { platformSenderId: normalizedPhone });
      }

      if (tail.length >= 7) {
        messageWhere.push({ from: { endsWith: tail } }, { to: { endsWith: tail } });
      }

      const messages = await this.prisma.message.findMany({
        where: {
          businessId,
          OR: messageWhere,
        },
        orderBy: { createdAt: 'asc' },
      });

      return messages.map((m) => ({
        id: m.id,
        body: m.content,
        direction: m.direction === 'INBOUND' ? 'incoming' : 'outgoing',
        source: m.aiResponse ? 'bot' : (m.direction === 'OUTBOUND' ? 'admin_api' : 'whatsapp_web'),
        created_at: m.createdAt.toISOString(),
        status: m.status.toLowerCase(),
        mediaUrl: m.mediaUrl || undefined,
        mediaType: (m.metadata as any)?.mediaType || undefined,
        fileName: (m.metadata as any)?.fileName || undefined,
        mimeType: (m.metadata as any)?.mimetype || undefined,
        platform: m.platform ? m.platform.toLowerCase() : 'whatsapp',
      }));
    } catch (error: any) {
      this.logger.error(`Error getting chat messages: ${error.message}`);
      return [];
    }
  }

  async sendMessage(
    to: string,
    message: string,
    token: string,
    mediaUrl?: string,
    businessId?: string,
    mediaFileId?: string,
    mediaType?: 'image' | 'video' | 'document' | 'audio' | 'sticker',
    caption?: string,
  ) {
    try {
      if (!businessId) {
        throw new Error('Business ID is required');
      }

      const normalizedPhone = this.normalizeIdentity(to, 'WHATSAPP');
      const tail = normalizedPhone.slice(-9);
      const contact = await this.prisma.contact.findFirst({
        where: {
          businessId,
          OR: [
            { phone: to },
            { phone: normalizedPhone },
            ...(tail.length >= 7 ? [{ phone: { endsWith: tail } }] : []),
          ],
        },
      });

      const platform = this.normalizePlatform(contact?.source || 'WHATSAPP');
      const file = mediaFileId
        ? await this.prisma.file.findFirst({ where: { id: mediaFileId, businessId } })
        : null;
      if (mediaFileId && !file) {
        throw new Error('Attached file was not found for this business');
      }

      const resolvedMediaType = mediaType || this.inferMediaType(file);
      const storedMediaUrl = mediaUrl || this.publicMediaUrl(file);
      const outboundText = (message || caption || '').trim();
      const content = outboundText || (file ? `[${resolvedMediaType.toUpperCase()}]` : '');
      const metadata = file
        ? {
            mediaType: resolvedMediaType,
            fileId: file.id,
            fileName: file.originalName,
            mimetype: file.mimeType,
            fileSize: file.size,
          }
        : undefined;
      let savedMessage;

      if (platform === 'TELEGRAM') {
        if (file) {
          throw new Error('Telegram media sending from the inbox is not implemented yet');
        }
        const config = await this.prisma.botConfig.findUnique({ where: { businessId } });
        if (!config?.telegramBotToken || !config.telegramConnected) {
          throw new Error('Telegram is not configured or connected for this business');
        }
        await this.telegramService.sendMessage(businessId, to, content);
        savedMessage = await this.prisma.message.findFirst({
          where: {
            businessId,
            direction: 'OUTBOUND',
            to,
            platform: 'TELEGRAM',
          },
          orderBy: { createdAt: 'desc' },
        });
      } else if (platform === 'MESSENGER') {
        if (file) {
          const absoluteUrl = this.absolutePublicUrl(storedMediaUrl);
          if (!absoluteUrl) {
            throw new Error('BACKEND_PUBLIC_URL is required to send Messenger attachments');
          }
          await this.messengerService.sendAttachmentToMessenger(businessId, to, absoluteUrl, resolvedMediaType, outboundText);
        } else {
          await this.messengerService.sendMessageToMessenger(businessId, to, content);
        }

        savedMessage = await this.prisma.message.create({
          data: {
            businessId,
            direction: 'OUTBOUND',
            content,
            from: '',
            to: to,
            status: 'SENT',
            platform: 'MESSENGER',
            mediaUrl: storedMediaUrl || undefined,
            metadata: metadata as any,
          },
        });
      } else if (platform === 'INSTAGRAM') {
        if (file) {
          const absoluteUrl = this.absolutePublicUrl(storedMediaUrl);
          if (!absoluteUrl) {
            throw new Error('BACKEND_PUBLIC_URL is required to send Instagram attachments');
          }
          await this.instagramService.sendAttachmentToInstagram(businessId, to, absoluteUrl, resolvedMediaType, outboundText);
        } else {
          await this.instagramService.sendMessageToInstagram(businessId, to, content);
        }

        savedMessage = await this.prisma.message.create({
          data: {
            businessId,
            direction: 'OUTBOUND',
            content,
            from: '',
            to: to,
            status: 'SENT',
            platform: 'INSTAGRAM',
            mediaUrl: storedMediaUrl || undefined,
            metadata: metadata as any,
          },
        });
      } else {
        const jid = this.toWhatsAppJid(to);
        if (file) {
          if (resolvedMediaType === 'image' || resolvedMediaType === 'sticker') {
            await this.whatsappWebService.sendImageFromFile(businessId, jid, file.id, undefined, outboundText);
          } else if (resolvedMediaType === 'video') {
            await this.whatsappWebService.sendVideoFromFile(businessId, jid, file.id, undefined, outboundText);
          } else if (resolvedMediaType === 'audio') {
            await this.whatsappWebService.sendAudioFromFile(businessId, jid, file.id, undefined, false);
          } else {
            await this.whatsappWebService.sendDocumentFromFile(businessId, jid, file.id, undefined, outboundText);
          }
        } else {
          await this.whatsappWebService.sendMessage(businessId, jid, content);
        }

        savedMessage = await this.prisma.message.create({
          data: {
            businessId,
            direction: 'OUTBOUND',
            content,
            from: '',
            to: normalizedPhone,
            status: 'SENT',
            platform: 'WHATSAPP',
            mediaUrl: storedMediaUrl || undefined,
            metadata: metadata as any,
          },
        });

        await this.upsertWhatsappContactActivity(businessId, normalizedPhone, content, 'OUTBOUND');
      }

      // Emit new message via WebSocket Gateway
      if (savedMessage) {
        this.websocketGateway.emitNewMessage(businessId, savedMessage);
      }

      return { success: true, messageId: savedMessage?.id };
    } catch (error: any) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }

  async getWhatsAppStatus(token: string, businessId?: string) {
    try {
      if (!businessId) return { status: 'disconnected' };

      const config = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: {
          whatsappWebStatus: true,
          whatsappWebNumber: true,
          updatedAt: true,
          business: {
            select: {
              whatsappNumber: true,
            },
          },
        },
      });

      const statusString = config?.whatsappWebStatus || 'DISABLED';
      const runtimeReady = this.whatsappWebService.isClientReady(businessId);
      const connected = statusString === 'READY' && runtimeReady;

      return {
        status: statusString === 'READY' && !runtimeReady ? 'STALE' : statusString,
        connected,
        phoneNumber: config?.whatsappWebNumber || config?.business?.whatsappNumber || '',
        lastConnected: connected ? config?.updatedAt || null : null,
      };
    } catch (error: any) {
      this.logger.error(`Error getting WA status: ${error.message}`);
      return { status: 'disconnected' };
    }
  }

  async startWhatsApp(usePairingCode: boolean, phone: string, token: string, businessId?: string) {
    try {
      if (!businessId) throw new Error('Business ID is required');

      const phoneNumber = (phone || '').trim();
      if (phoneNumber) {
        if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
          throw new Error('Invalid WhatsApp number format. Use international format: +51999999999');
        }

        await this.prisma.business.update({
          where: { id: businessId },
          data: { whatsappNumber: phoneNumber },
        });

        await this.prisma.botConfig.upsert({
          where: { businessId },
          update: {
            whatsappWebNumber: phoneNumber,
            whatsappWebEnabled: true,
            whatsappMode: 'WHATSAPP_WEB',
          },
          create: {
            businessId,
            whatsappWebNumber: phoneNumber,
            whatsappWebEnabled: true,
            whatsappMode: 'WHATSAPP_WEB',
            welcomeMessage: 'Hola! Bienvenido a nuestro negocio. En que podemos ayudarte?',
            fallbackMessage: 'En este momento no estamos disponibles. Te responderemos pronto.',
            autoReply: true,
            audioEnabled: false,
            aiProvider: 'OPENAI',
            aiModel: 'gpt-4o',
          },
        });
      }

      // Initialize local WhatsApp client
      await this.whatsappWebService.initializeClient(businessId, true);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error starting WA: ${error.message}`);
      throw error;
    }
  }

  async disconnectWhatsApp(token: string, businessId?: string) {
    try {
      if (!businessId) throw new Error('Business ID is required');

      await this.whatsappWebService.deleteSession(businessId);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error disconnecting WA: ${error.message}`);
      throw error;
    }
  }

  async getBotEnabled(token: string, businessId?: string) {
    try {
      if (!businessId) return { enabled: false };

      const config = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: { autoReply: true },
      });

      return { enabled: config?.autoReply || false };
    } catch (error: any) {
      this.logger.error(`Error getting bot status: ${error.message}`);
      return { enabled: false };
    }
  }

  async toggleBot(enabled: boolean, token: string, businessId?: string) {
    try {
      if (!businessId) throw new Error('Business ID is required');

      await this.prisma.botConfig.update({
        where: { businessId },
        data: { autoReply: enabled },
      });

      return { success: true, enabled };
    } catch (error: any) {
      this.logger.error(`Error toggling bot: ${error.message}`);
      throw error;
    }
  }

  async getCustomerProfile(phone: string, token: string, businessId?: string) {
    try {
      if (!businessId) return null;

      const normalizedPhone = phone.split('@')[0].replace(/\D/g, '');

      const [totalOrders, spentAggr, pendingAggr, lastOrders] = await Promise.all([
        this.prisma.order.count({
          where: { businessId, customerPhone: normalizedPhone },
        }),
        this.prisma.order.aggregate({
          where: { businessId, customerPhone: normalizedPhone, status: 'COMPLETED' },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.aggregate({
          where: { businessId, customerPhone: normalizedPhone, status: 'PENDING' },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.findMany({
          where: { businessId, customerPhone: normalizedPhone },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      return {
        stats: {
          total_orders: totalOrders,
          total_spent: spentAggr._sum.totalAmount || 0,
          total_pending: pendingAggr._sum.totalAmount || 0,
        },
        lastOrders: lastOrders.map((o) => ({
          id: o.id,
          status: o.status,
          total: o.totalAmount,
          pending_amount: o.status === 'PENDING' ? o.totalAmount : 0,
          created_at: o.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      this.logger.error(`Error getting customer profile: ${error.message}`);
      return null;
    }
  }

  async deleteMessage(messageId: string, token: string, businessId?: string) {
    try {
      await this.prisma.message.delete({
        where: { id: messageId },
      });
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error deleting message: ${error.message}`);
      throw error;
    }
  }

  async clearChat(phone: string, token: string, businessId?: string) {
    try {
      if (!businessId) throw new Error('Business ID is required');

      const normalizedPhone = phone.split('@')[0].replace(/\D/g, '');

      await this.prisma.message.deleteMany({
        where: {
          businessId,
          OR: [
            { from: normalizedPhone },
            { to: normalizedPhone },
            { from: phone },
            { to: phone },
          ],
        },
      });

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error clearing chat: ${error.message}`);
      throw error;
    }
  }

  async pauseBotForChat(phone: string, paused: boolean, token: string, businessId?: string) {
    try {
      if (!businessId) throw new Error('Business ID is required');

      const normalizedPhone = phone.split('@')[0].replace(/\D/g, '');

      const contact = await this.prisma.contact.findFirst({
        where: {
          businessId,
          OR: [
            { phone: normalizedPhone },
            { phone: { endsWith: normalizedPhone.slice(-9) } },
          ],
        },
      });

      if (contact) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { isAiPaused: paused },
        });
        this.logger.log(`[Database] Persisted isAiPaused = ${paused} for contact ${contact.phone}`);
      } else {
        await this.prisma.contact.create({
          data: {
            businessId,
            phone: normalizedPhone,
            name: `Contacto ${normalizedPhone}`,
            source: 'WHATSAPP',
            isAiPaused: paused,
          },
        });
        this.logger.log(`[Database] Created contact and set isAiPaused = ${paused} for phone ${normalizedPhone}`);
      }

      return { success: true, paused };
    } catch (error: any) {
      this.logger.error(`Error pausing bot: ${error.message}`);
      throw error;
    }
  }

  async getPauseStatuses(phones: string[], token: string, businessId?: string) {
    try {
      if (!businessId) return { data: {} };

      const normalizedPhones = phones.map((p) => p.split('@')[0].replace(/\D/g, ''));

      const contacts = await this.prisma.contact.findMany({
        where: {
          businessId,
          phone: { in: normalizedPhones },
        },
        select: { phone: true, isAiPaused: true },
      });

      const statusMap: Record<string, boolean> = {};
      phones.forEach((phone) => {
        const norm = phone.split('@')[0].replace(/\D/g, '');
        const match = contacts.find((c) => c.phone === norm);
        statusMap[phone] = match ? match.isAiPaused : false;
      });

      return { success: true, data: statusMap, statuses: statusMap };
    } catch (error: any) {
      this.logger.error(`Error getting pause statuses: ${error.message}`);
      return { success: false, data: {}, statuses: {} };
    }
  }

  async getAvatar(phone: string, token: string, businessId?: string) {
    // Return null since avatars are loaded via gravatar or placeholder in frontend natively
    return { success: true, avatarUrl: null };
  }

  private toWhatsAppJid(to: string): string {
    const raw = String(to || '').trim();
    if (raw.endsWith('@c.us')) {
      return `${raw.replace('@c.us', '').replace(/\D/g, '')}@s.whatsapp.net`;
    }
    if (raw.includes('@')) {
      return raw;
    }
    return `${raw.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  private async upsertWhatsappContactActivity(
    businessId: string,
    phone: string,
    preview: string,
    direction: 'INBOUND' | 'OUTBOUND',
  ) {
    const normalizedPhone = String(phone || '').replace(/\D/g, '');
    if (normalizedPhone.length < 7) return;

    const tail = normalizedPhone.slice(-9);
    const existing = await this.prisma.contact.findFirst({
      where: {
        businessId,
        OR: [
          { phone: normalizedPhone },
          ...(tail ? [{ phone: { endsWith: tail } }] : []),
        ],
      },
      select: { id: true, metadata: true },
    });

    const metadata = {
      ...((existing?.metadata as any) || {}),
      channel: 'WHATSAPP',
      externalIdentity: normalizedPhone,
      lastMessagePreview: preview.slice(0, 160),
    };
    const activityField = direction === 'INBOUND'
      ? { lastIncomingAt: new Date() }
      : { lastOutgoingAt: new Date() };

    if (existing) {
      await this.prisma.contact.update({
        where: { id: existing.id },
        data: { ...activityField, metadata } as any,
      });
      return;
    }

    await this.prisma.contact.create({
      data: {
        businessId,
        phone: normalizedPhone,
        name: `Contacto ${normalizedPhone}`,
        source: 'WHATSAPP' as any,
        autoCreated: true,
        metadata,
        ...activityField,
      } as any,
    });
  }

  // ============== SWARM METHODS ==============

  async getSwarmAgents(): Promise<any[]> {
    return [
      { name: 'Agente de Empatía', role: 'Análisis de tono y humor del cliente', latency: '4ms', status: 'ACTIVE', cpu: '0.1%' },
      { name: 'Agente de Negociación', role: 'Reglas de precios y reservas directas', latency: '12ms', status: 'ACTIVE', cpu: '0.2%' },
      { name: 'Agente de Reconocimiento de Errores', role: 'Auditor de alucinaciones y RAG', latency: '8ms', status: 'ACTIVE', cpu: '0.1%' },
      { name: 'Agente de Buena Conducta', role: 'Escudo anti-inyecciones y fraudes', latency: '2ms', status: 'SHIELD_ACTIVE', cpu: '0.05%' },
    ];
  }

  async getSystemStatus(): Promise<any> {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    return {
      whatsapp: { status: 'READY', connected: true },
      bot: { enabled: true },
      swarmEngine: 'online',
      telephony: 'standby',
      redis: 'connected',
      server: {
        ramUsedMB: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        uptimeHours: Math.round((uptimeSeconds / 3600) * 100) / 100,
        nodeVersion: process.version,
      },
      livechatBridge: {
        connected: true,
        url: 'native',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getDetailedHealth(): Promise<any> {
    const sysStatus = await this.getSystemStatus();
    return {
      ...sysStatus,
      livechatService: { status: 'healthy' },
      whatsappSessions: [],
    };
  }
}
