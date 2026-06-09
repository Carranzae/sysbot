import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../database/prisma.service';
import { UpdateWhatsappAccountDto } from './dto/update-account.dto';

@Injectable()
export class WhatsappService {
  private apiUrl: string;
  private apiVersion: string;
  private pendingEvidence: Map<string, { media: any; text: string; from: string; type: string }> = new Map();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get('WHATSAPP_API_URL') || 'https://graph.facebook.com';
    this.apiVersion = 'v18.0';
  }

  async sendMessage(phoneNumberId: string, to: string, message: string): Promise<any> {
    try {
      const account = await this.prisma.whatsAppAccount.findUnique({
        where: { phoneNumberId },
        include: { business: { include: { botConfig: true } } },
      });

      if (!account) {
        throw new Error('WhatsApp account not found');
      }

      // Verificar que WhatsApp API esté habilitado
      const config = account.business?.botConfig;
      const isApiEnabled = config?.whatsappApiEnabled === true || 
                          (config?.whatsappMode === 'WHATSAPP_API' && config?.whatsappApiEnabled !== false);
      
      if (!isApiEnabled) {
        throw new Error('WhatsApp API is not enabled for this business');
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp Send Message Error:', error);
      throw error;
    }
  }

  async sendMedia(phoneNumberId: string, to: string, mediaType: string, mediaId: string, caption?: string): Promise<any> {
    try {
      const account = await this.prisma.whatsAppAccount.findUnique({
        where: { phoneNumberId },
      });

      if (!account) {
        throw new Error('WhatsApp account not found');
      }

      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
      };

      payload[mediaType] = { id: mediaId };
      if (caption) {
        payload[mediaType].caption = caption;
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp Send Media Error:', error);
      throw error;
    }
  }

  setPendingEvidence(from: string, evidence: { media: any; text: string; from: string; type: string }) {
    this.pendingEvidence.set(from, evidence);
  }

  hasPendingEvidence(from: string): boolean {
    return this.pendingEvidence.has(from);
  }

  getPendingEvidence(from: string) {
    return this.pendingEvidence.get(from)!;
  }

  clearPendingEvidence(from: string) {
    this.pendingEvidence.delete(from);
  }

  async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string = 'es',
  ): Promise<any> {
    try {
      const account = await this.prisma.whatsAppAccount.findUnique({
        where: { phoneNumberId },
      });

      if (!account) {
        throw new Error('WhatsApp account not found');
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp Send Template Error:', error);
      throw error;
    }
  }

  async markAsRead(phoneNumberId: string, messageId: string): Promise<any> {
    try {
      const account = await this.prisma.whatsAppAccount.findUnique({
        where: { phoneNumberId },
      });

      if (!account) {
        throw new Error('WhatsApp account not found');
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp Mark as Read Error:', error);
      throw error;
    }
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
    const verifyToken = this.configService.get('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return null;
  }

  async createWhatsAppAccount(businessId: string, data: any) {
    return this.prisma.whatsAppAccount.create({
      data: {
        businessId,
        phoneNumberId: data.phoneNumberId,
        phoneNumber: data.phoneNumber,
        displayName: data.displayName,
        verifyToken: data.verifyToken,
        accessToken: data.accessToken,
        webhookUrl: data.webhookUrl,
      },
    });
  }

  async updateWhatsappAccount(id: string, dto: UpdateWhatsappAccountDto) {
    const existing = await this.prisma.whatsAppAccount.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`WhatsApp account ${id} not found`);
    }

    return this.prisma.whatsAppAccount.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.webhookUrl !== undefined ? { webhookUrl: dto.webhookUrl } : {}),
        ...(dto.autoSyncEnabled !== undefined ? { autoSyncEnabled: dto.autoSyncEnabled } : {}),
      },
    });
  }

  async triggerManualSync(id: string) {
    const account = await this.prisma.whatsAppAccount.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!account) {
      throw new NotFoundException(`WhatsApp account ${id} not found`);
    }

    await this.prisma.whatsAppAccount.update({
      where: { id },
      data: {
        lastManualSyncAt: new Date(),
      },
    });

    // TODO: enqueue Bull job to fetch contacts via WhatsApp API.
    return {
      status: 'QUEUED',
      message: 'Manual sync scheduled. Contacts will update shortly.',
    };
  }

  async getWhatsAppAccount(idOrPhoneNumberId: string) {
    return this.prisma.whatsAppAccount.findFirst({
      where: {
        OR: [
          { id: idOrPhoneNumberId },
          { phoneNumberId: idOrPhoneNumberId },
        ],
      },
      include: { business: true },
    });
  }
}
