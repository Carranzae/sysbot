import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { MetaService } from '../meta.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { SwarmOrchestratorService } from '../../swarm/swarm-orchestrator.service';
import axios from 'axios';

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private metaService: MetaService,
    private websocketGateway: WebsocketGateway,
    private swarmService: SwarmOrchestratorService,
  ) {}

  async handleIncomingMessage(businessId: string, event: any) {
    this.logger.log(`[Messenger] Handling incoming message for business ${businessId}`);

    const senderId = event.sender?.id;
    const message = event.message;
    const messageText = message?.text;

    if (!messageText && !message?.attachments) {
      this.logger.warn('[Messenger] No text or attachments in message');
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
        platform: 'MESSENGER',
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
      this.logger.error(`[Messenger Swarm] Safety check failed or blocked: ${err.message}`);
      if (err.status === 403 || err.statusCode === 403 || err.message.includes('Forbidden') || err.message.includes('restringido')) {
        try {
          await this.sendMessageToMessenger(businessId, senderId, 'Acceso denegado por seguridad perimetral.');
        } catch (sendErr) {}
        return savedMessage;
      }
    }

    if (swarmBlocked) {
      try {
        await this.sendMessageToMessenger(businessId, senderId, safetyResponse || 'Acceso denegado.');
      } catch (sendErr) {}
      return savedMessage;
    }

    // Generar respuesta con AI
    try {
      const response = await this.aiService.generateResponse(
        businessId,
        messageText || 'El cliente envió un archivo multimedia',
        senderId,
        {
          platform: 'MESSENGER',
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
        this.logger.error(`[Messenger Swarm] Modulation failed: ${err.message}`);
      }

      this.logger.log(`[Messenger] AI response generated: ${finalMessage.substring(0, 50)}...`);

      // ✅ ENVIAR RESPUESTA REAL A MESSENGER
      try {
        await this.sendMessageToMessenger(businessId, senderId, finalMessage);
        this.logger.log(`[Messenger] ✅ Response sent successfully to ${senderId}`);

        // Guardar respuesta saliente en BD
        const outboundMessage = await this.prisma.message.create({
          data: {
            businessId,
            direction: 'OUTBOUND',
            content: finalMessage,
            from: '',
            to: senderId,
            platform: 'MESSENGER',
            status: 'SENT',
          },
        });

        // Emitir respuesta por WebSocket
        this.websocketGateway.emitNewMessage(businessId, outboundMessage);
      } catch (sendError: any) {
        this.logger.error(`[Messenger] Error sending response: ${sendError.message}`);
        
        // Fallback: intentar con MESSAGE_TAG si RESPONSE falla (fuera de ventana de 24h)
        try {
          await this.sendMessageToMessengerWithTag(businessId, senderId, finalMessage);
          this.logger.log(`[Messenger] ✅ Fallback MESSAGE_TAG sent successfully`);
          
          await this.prisma.message.create({
            data: {
              businessId,
              direction: 'OUTBOUND',
              content: finalMessage,
              from: '',
              to: senderId,
              platform: 'MESSENGER',
              status: 'SENT',
            },
          });
        } catch (fallbackError: any) {
          this.logger.error(`[Messenger] Fallback also failed: ${fallbackError.message}`);
        }
      }
    } catch (aiError: any) {
      this.logger.error(`[Messenger] AI generation failed: ${aiError.message}`);
    }

    return savedMessage;
  }

  async sendMessageToMessenger(businessId: string, recipientId: string, message: string) {
    const connection = await this.metaService.getMetaConnection(businessId);
    
    if (!connection || !connection.messengerEnabled || !connection.messengerAccessToken || !connection.messengerPageId) {
      throw new Error('Messenger is not configured or enabled for this business');
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${connection.messengerPageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE', // Respuesta dentro de ventana de 24h
      },
      {
        headers: {
          'Authorization': `Bearer ${connection.messengerAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  private async sendMessageToMessengerWithTag(businessId: string, recipientId: string, message: string) {
    const connection = await this.metaService.getMetaConnection(businessId);
    
    if (!connection || !connection.messengerAccessToken || !connection.messengerPageId) {
      throw new Error('Messenger not configured');
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${connection.messengerPageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'MESSAGE_TAG',
        tag: 'HUMAN_AGENT', // Tag que permite enviar fuera de la ventana de 24h
      },
      {
        headers: {
          'Authorization': `Bearer ${connection.messengerAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }
}
