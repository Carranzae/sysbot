import { Injectable, Logger } from '@nestjs/common';
import { ChannelType, ChannelMessagePayload, ChannelStatusResult } from './channel.interface';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TelegramService } from '../telegram/telegram.service';
import { MessengerService } from '../meta/messenger/messenger.service';
import { InstagramService } from '../meta/instagram/instagram.service';
import { LivechatBridgeService } from '../livechat-bridge/livechat-bridge.service';
import { PrismaService } from '../database/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

/**
 * ChannelRouterService — Motor centralizado de enrutamiento omnicanal.
 * 
 * Cualquier parte del sistema que necesite enviar un mensaje SOLO necesita llamar:
 *   channelRouter.sendMessage({ to, content, businessId, platform })
 * 
 * El router se encarga de despachar al servicio correcto.
 */
@Injectable()
export class ChannelRouterService {
  private readonly logger = new Logger(ChannelRouterService.name);

  constructor(
    private prisma: PrismaService,
    private websocketGateway: WebsocketGateway,
    private whatsappWebService: WhatsappWebService,
    private messengerService: MessengerService,
    private instagramService: InstagramService,
  ) {}

  /**
   * Envía un mensaje por cualquier canal.
   * El router determina automáticamente qué servicio usar.
   */
  async sendMessage(platform: ChannelType, payload: ChannelMessagePayload): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`📤 [ChannelRouter] Routing message to ${platform} for business ${payload.businessId}`);

    try {
      switch (platform) {
        case 'WHATSAPP_WEB':
          await this.whatsappWebService.sendMessage(payload.businessId, payload.to, payload.content);
          break;

        case 'MESSENGER':
          await this.messengerService.sendMessageToMessenger(payload.businessId, payload.to, payload.content);
          break;

        case 'INSTAGRAM':
          await this.instagramService.sendMessageToInstagram(payload.businessId, payload.to, payload.content);
          break;

        // Telegram se maneja a través de su propio webhook/controller
        case 'TELEGRAM':
          this.logger.warn('[ChannelRouter] Telegram messages should go through TelegramService directly');
          break;

        case 'LIVECHAT':
          this.logger.log('[ChannelRouter] LIVECHAT messages are handled by the bridge');
          break;

        default:
          this.logger.error(`[ChannelRouter] Unknown platform: ${platform}`);
          return { success: false, error: `Unknown platform: ${platform}` };
      }

      // Guardar mensaje saliente en la base de datos unificada
      const savedMessage = await this.prisma.message.create({
        data: {
          businessId: payload.businessId,
          direction: 'OUTBOUND',
          content: payload.content,
          from: '',
          to: payload.to,
          platform: platform,
          status: 'SENT',
          mediaUrl: payload.mediaUrl,
        },
      });

      // Emitir por WebSocket para que el frontend se actualice en tiempo real
      this.websocketGateway.emitNewMessage(payload.businessId, savedMessage);

      this.logger.log(`✅ [ChannelRouter] Message sent successfully via ${platform}`);
      return { success: true };

    } catch (error: any) {
      this.logger.error(`❌ [ChannelRouter] Failed to send via ${platform}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene el estado de todos los canales para un negocio.
   */
  async getAllChannelStatuses(businessId: string): Promise<ChannelStatusResult[]> {
    const results: ChannelStatusResult[] = [];

    // WhatsApp Web
    try {
      const waStatus = await this.whatsappWebService.getStatus(businessId);
      results.push({
        connected: waStatus === 'connected',
        platform: 'WHATSAPP_WEB',
        details: waStatus,
      });
    } catch {
      results.push({ connected: false, platform: 'WHATSAPP_WEB', details: 'error' });
    }

    // Messenger
    try {
      const metaConn = await this.prisma.metaPlatformConnection.findUnique({ where: { businessId } });
      results.push({
        connected: !!metaConn?.messengerEnabled && !!metaConn?.messengerAccessToken,
        platform: 'MESSENGER',
        details: metaConn?.messengerEnabled ? 'configured' : 'not_configured',
      });
    } catch {
      results.push({ connected: false, platform: 'MESSENGER', details: 'error' });
    }

    // Instagram
    try {
      const metaConn = await this.prisma.metaPlatformConnection.findUnique({ where: { businessId } });
      results.push({
        connected: !!metaConn?.instagramEnabled && !!metaConn?.instagramAccessToken,
        platform: 'INSTAGRAM',
        details: metaConn?.instagramEnabled ? 'configured' : 'not_configured',
      });
    } catch {
      results.push({ connected: false, platform: 'INSTAGRAM', details: 'error' });
    }

    // Telegram
    try {
      const tgConn = await this.prisma.telegramConnection.findUnique({ where: { businessId } });
      results.push({
        connected: !!tgConn?.connected,
        platform: 'TELEGRAM',
        details: tgConn?.status || 'not_configured',
      });
    } catch {
      results.push({ connected: false, platform: 'TELEGRAM', details: 'error' });
    }

    return results;
  }
}
