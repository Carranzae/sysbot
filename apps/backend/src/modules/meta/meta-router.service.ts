import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { MessengerService } from './messenger/messenger.service';
import { InstagramService } from './instagram/instagram.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class MetaRouterService {
  private readonly logger = new Logger(MetaRouterService.name);

  constructor(
    private whatsappService: WhatsappService,
    private whatsappWebService: WhatsappWebService,
    private messengerService: MessengerService,
    private instagramService: InstagramService,
    private aiService: AiService,
  ) {}

  async routeIncomingMessage(
    businessId: string,
    platform: 'WHATSAPP_API' | 'WHATSAPP_WEB' | 'MESSENGER' | 'INSTAGRAM',
    messageData: any,
  ) {
    this.logger.log(`[MetaRouter] Routing message from ${platform} for business ${businessId}`);

    switch (platform) {
      case 'WHATSAPP_API':
        // WhatsApp API tiene su propio webhook handler, no usar MetaRouter
        this.logger.warn(`[MetaRouter] WhatsApp API should use its own webhook handler, not MetaRouter`);
        throw new Error('WhatsApp API should not be routed through MetaRouter');
        
      case 'WHATSAPP_WEB':
        return await this.whatsappWebService.handleMessage(businessId, messageData);
        
      case 'MESSENGER':
        return await this.messengerService.handleIncomingMessage(businessId, messageData);
        
      case 'INSTAGRAM':
        return await this.instagramService.handleIncomingMessage(businessId, messageData);
        
      default:
        this.logger.warn(`[MetaRouter] Unknown platform: ${platform}`);
        throw new Error(`Unknown platform: ${platform}`);
    }
  }
}

