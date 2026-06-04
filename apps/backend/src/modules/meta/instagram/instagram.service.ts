import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { MetaService } from '../meta.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { SwarmOrchestratorService } from '../../swarm/swarm-orchestrator.service';
import axios from 'axios';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private metaService: MetaService,
    private websocketGateway: WebsocketGateway,
    private swarmService: SwarmOrchestratorService,
  ) {}

  async handleIncomingMessage(businessId: string, event: any) {
    this.logger.log(`[Instagram] Handling incoming message for business ${businessId}`);

    const senderId = event.sender?.id;
    const message = event.message;
    const messageText = message?.text;

    if (!messageText && !message?.attachments) {
      this.logger.warn('[Instagram] No text or attachments in message');
      return;
    }

    // Guardar mensaje entrante en BD
    const savedMessage = await this.prisma.message.create({
      data: {
        businessId,
        direction: 'INBOUND',
        content: messageText || '[Media message]',
        from: senderId,
        to: event.recipient?.id || '',
        platform: 'INSTAGRAM',
        platformMessageId: message?.mid,
        platformSenderId: senderId,
        mediaUrl: message?.attachments?.[0]?.payload?.url,
        status: 'DELIVERED',
      },
    });

    // Emitir mensaje entrante por WebSocket
    this.websocketGateway.emitNewMessage(businessId, savedMessage);

    // 1. Swarm Safety check first (Safety Guard & Anti-Injection)
    let swarmBlocked = false;
    let safetyResponse = '';
    try {
      const safetyCheck = await this.swarmService.processIncomingMessage(businessId, senderId, '127.0.0.1', messageText || '');
      if (!safetyCheck.allowed) {
        swarmBlocked = true;
        safetyResponse = safetyCheck.responseMessage;
      }
    } catch (err: any) {
      this.logger.error(`[Instagram Swarm] Safety check failed or blocked: ${err.message}`);
      if (err.status === 403 || err.statusCode === 403 || err.message.includes('Forbidden') || err.message.includes('restringido')) {
        try {
          await this.sendMessageToInstagram(businessId, senderId, 'Acceso denegado por seguridad perimetral.');
        } catch (sendErr) {}
        return savedMessage;
      }
    }

    if (swarmBlocked) {
      try {
        await this.sendMessageToInstagram(businessId, senderId, safetyResponse || 'Acceso denegado.');
      } catch (sendErr) {}
      return savedMessage;
    }

    // Generar respuesta con AI (más concisa para Instagram)
    try {
      const response = await this.aiService.generateResponse(
        businessId,
        messageText || 'El cliente envió un archivo multimedia',
        senderId,
        {
          platform: 'INSTAGRAM',
          senderId,
        },
      );

      // 2. Swarm Tone modulation post-response
      let finalMessage = response.message;
      try {
        const toneService = (this.swarmService as any).peruvianTone;
        if (toneService) {
          const profile = toneService.detectCustomerProfile(messageText || '', { name: senderId });
          finalMessage = toneService.modulateResponse(response.message, profile, senderId);
        }
      } catch (err: any) {
        this.logger.error(`[Instagram Swarm] Modulation failed: ${err.message}`);
      }

      this.logger.log(`[Instagram] AI response generated: ${finalMessage.substring(0, 50)}...`);

      // ✅ ENVIAR RESPUESTA REAL A INSTAGRAM
      try {
        await this.sendMessageToInstagram(businessId, senderId, finalMessage);
        this.logger.log(`[Instagram] ✅ Response sent successfully to ${senderId}`);

        // Guardar respuesta saliente en BD
        const outboundMessage = await this.prisma.message.create({
          data: {
            businessId,
            direction: 'OUTBOUND',
            content: finalMessage,
            from: '',
            to: senderId,
            platform: 'INSTAGRAM',
            status: 'SENT',
          },
        });

        // Emitir respuesta por WebSocket
        this.websocketGateway.emitNewMessage(businessId, outboundMessage);
      } catch (sendError: any) {
        this.logger.error(`[Instagram] Error sending response: ${sendError.message}`);
      }
    } catch (aiError: any) {
      this.logger.error(`[Instagram] AI generation failed: ${aiError.message}`);
    }

    return savedMessage;
  }

  async sendMessageToInstagram(businessId: string, recipientId: string, message: string) {
    const connection = await this.metaService.getMetaConnection(businessId);
    
    if (!connection || !connection.instagramEnabled || !connection.instagramAccessToken || !connection.instagramAccountId) {
      throw new Error('Instagram is not configured or enabled for this business');
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${connection.instagramAccountId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
      },
      {
        headers: {
          'Authorization': `Bearer ${connection.instagramAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }
}
