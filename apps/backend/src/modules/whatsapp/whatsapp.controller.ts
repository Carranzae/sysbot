import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, BadRequestException, UseInterceptors, UploadedFile, HttpCode, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebService } from './whatsapp-web.service';
import { MessagesService } from '../messages/messages.service';
import { AiService } from '../ai/ai.service';
import { UpdateWhatsappAccountDto } from './dto/update-account.dto';
import { CreateWhatsappAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../database/prisma.service';
import { BusinessService } from '../business/business.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private whatsappService: WhatsappService,
    private whatsappWebService: WhatsappWebService,
    private messagesService: MessagesService,
    private aiService: AiService,
    private prisma: PrismaService,
    private businessService: BusinessService,
  ) {}

  @Get('webhook')
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const result = await this.whatsappService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      return result;
    }

    return { error: 'Verification failed' };
  }

  @Patch('accounts/:id')
  @UseGuards(JwtAuthGuard)
  async updateAccount(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWhatsappAccountDto) {
    const account = await this.whatsappService.getWhatsAppAccount(id);
    if (!account) throw new BadRequestException('Account not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, account.businessId);
    
    const updated = await this.whatsappService.updateWhatsappAccount(id, dto);
    return {
      id: updated.id,
      autoSyncEnabled: updated.autoSyncEnabled,
      displayName: updated.displayName,
      webhookUrl: updated.webhookUrl,
      lastAutoSyncAt: updated.lastAutoSyncAt,
      lastManualSyncAt: updated.lastManualSyncAt,
    };
  }

  @Post('accounts')
  @UseGuards(JwtAuthGuard)
  async createAccount(@Req() req: any, @Body() dto: CreateWhatsappAccountDto & { businessId?: string }) {
    const businessId = dto.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID is required');
    }

    await this.businessService.ensureBusinessOwnership(req.user.userId, businessId);
    return this.whatsappService.createWhatsAppAccount(businessId, dto);
  }

  @Post('accounts/:id/sync')
  @UseGuards(JwtAuthGuard)
  async manualSync(@Req() req: any, @Param('id') id: string) {
    const account = await this.whatsappService.getWhatsAppAccount(id);
    if (!account) throw new BadRequestException('Account not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, account.businessId);
    return this.whatsappService.triggerManualSync(id);
  }

  @Post('send-message')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Req() req: any, @Body() body: { phoneNumberId: string; to: string; message: string }) {
    const account = await this.whatsappService.getWhatsAppAccount(body.phoneNumberId);
    if (!account) throw new BadRequestException('Account not found');
    await this.businessService.ensureBusinessOwnership(req.user.userId, account.businessId);
    return this.whatsappService.sendMessage(body.phoneNumberId, body.to, body.message);
  }

  @Post('web/init')
  @UseGuards(JwtAuthGuard)
  async initWeb(@Req() req: any, @Body() body: { businessId?: string }): Promise<{ success: boolean; message?: string }> {
    const businessId = body.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID is required (provide in body or ensure user has active business)');
    }
    await this.businessService.ensureBusinessOwnership(req.user.userId, businessId);
    try {
      // Forzar inicialización incluso si no está habilitado (para permitir que el usuario vea el QR)
      const result = await this.whatsappWebService.initializeClient(businessId, true);
      if (!result) {
        return {
          success: true,
          message: 'WhatsApp Web ya se esta inicializando. Espera unos segundos y vuelve a consultar el QR.',
        };
      }
      return { success: true };
    } catch (error: any) {
      console.error('Error initializing WhatsApp Web:', error);
      if (error.message?.includes('getaddrinfo') || error.message?.includes('EAI_AGAIN') || error.message?.includes('ENOTFOUND')) {
        throw new BadRequestException('Error de conexión: No se puede conectar a los servidores de WhatsApp. Verifica tu conexión a internet.');
      }
      throw new BadRequestException(error.message || 'Error al inicializar WhatsApp Web');
    }
  }

  @Get('web/qr')
  @UseGuards(JwtAuthGuard)
  async getQr(@Req() req: any, @Query('businessId') businessId?: string) {
    const targetBusinessId = businessId || req.user?.businessId;
    if (!targetBusinessId) {
      throw new BadRequestException('Business ID is required (provide as query parameter or ensure user has active business)');
    }
    await this.businessService.ensureBusinessOwnership(req.user.userId, targetBusinessId);
    const qr = await this.whatsappWebService.getPairingCode(targetBusinessId);
    console.log('Getting QR for businessId:', targetBusinessId, 'QR:', qr);
    return { qr: qr || null };
  }

  @Get('web/status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any, @Query('businessId') businessId?: string) {
    const targetBusinessId = businessId || req.user?.businessId;
    if (!targetBusinessId) {
      throw new BadRequestException('Business ID is required (provide as query parameter or ensure user has active business)');
    }
    await this.businessService.ensureBusinessOwnership(req.user.userId, targetBusinessId);
    
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId: targetBusinessId },
      select: {
        whatsappWebStatus: true,
        whatsappWebNumber: true,
        updatedAt: true,
      }
    });

    const statusString = config?.whatsappWebStatus || 'DISABLED';
    const connected = statusString === 'READY';
    
    return {
      status: statusString,
      connected,
      phoneNumber: config?.whatsappWebNumber || '',
      lastConnected: connected ? config?.updatedAt || null : null,
    };
  }

  @Post('web/send-message')
  @UseGuards(JwtAuthGuard)
  async sendWebMessage(@Body() body: { businessId?: string; to: string; message: string }, @Req() req: any) {
    const businessId = body.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID not found');
    }
    
    // Verificar que WhatsApp Web esté habilitado
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { whatsappWebEnabled: true, whatsappMode: true },
    });

    const isEnabled = config?.whatsappWebEnabled === true || 
                     (config?.whatsappMode === 'WHATSAPP_WEB' && config?.whatsappWebEnabled !== false);
    
    if (!isEnabled) {
      throw new BadRequestException('WhatsApp Web is not enabled for this business');
    }

    const jid = body.to.includes('@') ? body.to : `${body.to}@s.whatsapp.net`;

    try {
      await this.whatsappWebService.sendMessage(businessId, jid, body.message);
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error sending message via WhatsApp Web');
    }
  }

  @Post('web/send-image')
  @UseGuards(JwtAuthGuard)
  async sendWebImage(
    @Body() body: { businessId?: string; to: string; fileId?: string; filePath?: string; caption?: string },
    @Req() req: any
  ) {
    const businessId = body.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID not found');
    }

    const jid = body.to.includes('@') ? body.to : `${body.to}@s.whatsapp.net`;

    try {
      await this.whatsappWebService.sendImageFromFile(businessId, jid, body.fileId, body.filePath, body.caption);
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error sending image via WhatsApp Web');
    }
  }

  @Post('web/send-video')
  @UseGuards(JwtAuthGuard)
  async sendWebVideo(
    @Body() body: { businessId?: string; to: string; fileId?: string; filePath?: string; caption?: string },
    @Req() req: any
  ) {
    const businessId = body.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID not found');
    }

    const jid = body.to.includes('@') ? body.to : `${body.to}@s.whatsapp.net`;

    try {
      await this.whatsappWebService.sendVideoFromFile(businessId, jid, body.fileId, body.filePath, body.caption);
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error sending video via WhatsApp Web');
    }
  }

  @Post('web/send-document')
  @UseGuards(JwtAuthGuard)
  async sendWebDocument(
    @Body() body: { businessId?: string; to: string; fileId?: string; filePath?: string; caption?: string },
    @Req() req: any
  ) {
    const businessId = body.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID not found');
    }

    const jid = body.to.includes('@') ? body.to : `${body.to}@s.whatsapp.net`;

    try {
      await this.whatsappWebService.sendDocumentFromFile(businessId, jid, body.fileId, body.filePath, body.caption);
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error sending document via WhatsApp Web');
    }
  }

  @Post('web/send-audio')
  @UseGuards(JwtAuthGuard)
  async sendWebAudio(
    @Body() body: { businessId?: string; to: string; fileId?: string; filePath?: string; ptt?: boolean },
    @Req() req: any
  ) {
    const businessId = body.businessId || req.user?.businessId;
    if (!businessId) {
      throw new BadRequestException('Business ID not found');
    }

    // Verificar que el audio esté habilitado
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { audioEnabled: true },
    });

    if (!config?.audioEnabled) {
      throw new BadRequestException('Audio sending is not enabled for this business');
    }

    const jid = body.to.includes('@') ? body.to : `${body.to}@s.whatsapp.net`;

    try {
      await this.whatsappWebService.sendAudioFromFile(businessId, jid, body.fileId, body.filePath, body.ptt || false);
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error sending audio via WhatsApp Web');
    }
  }

  @Delete('web/session')
  @UseGuards(JwtAuthGuard)
  async deleteSession(@Req() req: any, @Query('businessId') businessId?: string): Promise<{ success: boolean }> {
    const targetBusinessId = businessId || req.user?.businessId;
    if (!targetBusinessId) {
      throw new BadRequestException('Business ID is required (provide as query parameter or ensure user has active business)');
    }
    await this.businessService.ensureBusinessOwnership(req.user.userId, targetBusinessId);
    await this.whatsappWebService.deleteSession(targetBusinessId);
    return { success: true };
  }

  @Get('web/contacts')
  @UseGuards(JwtAuthGuard)
  async getContacts(@Req() req: any) {
    const businessId = req.user?.businessId;
    if (!businessId) throw new BadRequestException('Business ID not found');
    return this.prisma.whatsAppContact.findMany({ where: { businessId } });
  }

  @Get('web/groups')
  @UseGuards(JwtAuthGuard)
  async getGroups(@Req() req: any) {
    const businessId = req.user?.businessId;
    if (!businessId) throw new BadRequestException('Business ID not found');
    return this.prisma.whatsAppGroup.findMany({ where: { businessId } });
  }

  @Post('web/send-audio-live')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  async sendAudioLive(@Req() req: any, @Body() body: any, @UploadedFile() file: any) {
    const businessId = req.user?.businessId;
    if (!businessId) throw new BadRequestException('Business ID not found');
    if (!file) throw new BadRequestException('Audio file not provided');
    if (!body.to) throw new BadRequestException('Recipient not provided');

    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { audioEnabled: true },
    });

    if (!config?.audioEnabled) {
      throw new BadRequestException('Audio sending is not enabled for this business');
    }

    const jid = body.to.includes('@') ? body.to : `${body.to}@s.whatsapp.net`;
    
    try {
      const sock = this.whatsappWebService['sockets'].get(businessId);
      if (!sock) throw new BadRequestException('WhatsApp Web not connected');

      await sock.sendMessage(jid, {
        audio: file.buffer,
        mimetype: 'audio/mp4',
        ptt: true
      });
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error sending live audio');
    }
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any, @Req() req: any) {
    try {
      if (body.object !== 'whatsapp_business_account') {
        return { status: 'ignored' };
      }

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const { value } = change;
            const phoneNumberId = value.metadata.phone_number_id;

            if (value.messages && value.messages.length > 0) {
              for (const message of value.messages) {
                await this.processIncomingMessage(phoneNumberId, message);
              }
            }

            if (value.statuses && value.statuses.length > 0) {
              for (const status of value.statuses) {
                await this.processMessageStatus(status);
              }
            }
          }
        }
      }

      return { status: 'ok' };
    } catch (error) {
      console.error('Webhook Error:', error);
      return { status: 'error', message: error.message };
    }
  }

  private async processIncomingMessage(phoneNumberId: string, message: any) {
    try {
      const account = await this.whatsappService.getWhatsAppAccount(phoneNumberId);
      
      if (!account) {
        console.error('WhatsApp account not found:', phoneNumberId);
        return;
      }

      const businessId = account.businessId;

      // Verificar que WhatsApp API esté habilitado antes de procesar
      const botConfig = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: { whatsappApiEnabled: true, whatsappMode: true, respondInGroups: true },
      });


      const isApiEnabled = botConfig?.whatsappApiEnabled === true || 
                           (botConfig?.whatsappMode === 'WHATSAPP_API' && botConfig?.whatsappApiEnabled !== false);
      
      if (!isApiEnabled) {
        console.log('WhatsApp API is not enabled, ignoring message for businessId:', businessId);
        return;
      }
      const from = message.from;
      const messageText = message.text?.body || '';
      const messageType = message.type;

      // Check for group message
      const isGroup = from.includes('-') || from.length > 15;
      if (isGroup && !botConfig?.respondInGroups) {
        console.log(`[WhatsApp API] Group message from ${from} ignored because respondInGroups is disabled`);
        return;
      }

      await this.messagesService.createMessage({
        businessId,
        whatsappAccountId: account.id,
        externalId: message.id,
        direction: 'INBOUND',
        content: messageText,
        from,
        to: account.phoneNumber,
        status: 'DELIVERED',
      });

      // Check for confirmation
      if (messageText.toLowerCase() === 'sí' && this.whatsappService.hasPendingEvidence(from)) {
        const evidence = this.whatsappService.getPendingEvidence(from);
        const config = await this.prisma.botConfig.findUnique({
          where: { businessId },
          select: { reviewerDestination: true },
        });
        if (config?.reviewerDestination) {
          await this.whatsappService.sendMedia(phoneNumberId, config.reviewerDestination, evidence.type, evidence.media.id, `Evidencia confirmada de ${evidence.from}: ${evidence.text}`);
        }
        this.whatsappService.clearPendingEvidence(from);
        await this.whatsappService.sendMessage(phoneNumberId, from, 'Evidencia enviada al especialista para revisión.');
        await this.whatsappService.markAsRead(phoneNumberId, message.id);
        return; // Don't send AI response for confirmation
      }

      // Check if AI is paused for this contact
      const contact = await this.prisma.contact.findFirst({
        where: { businessId, phone: from },
        select: { isAiPaused: true },
      });

      if (contact?.isAiPaused) {
        console.log(`[WhatsApp API] AI is paused for contact ${from}. AI response skipped.`);
        await this.whatsappService.markAsRead(phoneNumberId, message.id);
        return;
      }

      // Handle media
      if (messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'audio') {
        const business = await this.prisma.business.findUnique({
          where: { id: businessId },
          select: { industryType: true }
        });
        const isClinic = business?.industryType === 'CLINIC';

        if (isClinic && (messageType === 'image' || messageType === 'video')) {
          const media = message[messageType];
          this.whatsappService.setPendingEvidence(from, { media, text: messageText, from, type: messageType });
          await this.whatsappService.sendMessage(phoneNumberId, from, 'Has enviado una imagen/video. Si es evidencia para revisión por especialista, responde "sí" para enviarla.');
        } else {
          // Si no es clínica o es otro tipo de archivo, responder usando el texto/caption si existe, o pedir texto
          if (messageText && messageText.trim() !== '') {
            const aiResponse = await this.aiService.generateResponse(businessId, messageText, from, {
              platform: 'WHATSAPP_API',
              senderId: from,
            });
            await this.whatsappService.sendMessage(phoneNumberId, from, aiResponse.message);
          } else {
            await this.whatsappService.sendMessage(phoneNumberId, from, 'He recibido tu archivo. Por el momento, no puedo analizar este tipo de archivos en este canal. ¿Podrías escribirme en texto tu consulta?');
          }
        }
        await this.whatsappService.markAsRead(phoneNumberId, message.id);
        return; // Don't send AI response for media
      }

      const aiResponse = await this.aiService.generateResponse(businessId, messageText, from, {
        platform: 'WHATSAPP_API',
        senderId: from,
      });

      await this.whatsappService.sendMessage(phoneNumberId, from, aiResponse.message);

      await this.messagesService.createMessage({
        businessId,
        whatsappAccountId: account.id,
        direction: 'OUTBOUND',
        content: aiResponse.message,
        from: account.phoneNumber,
        to: from,
        status: 'SENT',
        aiResponse: true,
        aiConfidence: aiResponse.confidence,
        processingTime: aiResponse.processingTime,
      });

      await this.whatsappService.markAsRead(phoneNumberId, message.id);
    } catch (error) {
      console.error('Process Incoming Message Error:', error);
    }
  }

  private async processMessageStatus(status: any) {
    try {
      await this.messagesService.updateMessageStatus(status.id, status.status.toUpperCase());
    } catch (error) {
      console.error('Process Message Status Error:', error);
    }
  }
}
