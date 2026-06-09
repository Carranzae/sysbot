import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { PrismaService } from '../database/prisma.service'
import { AiService } from '../ai/ai.service'
import { MessagesService } from '../messages/messages.service'

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)
  private readonly apiBase = 'https://api.telegram.org'

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly messagesService: MessagesService,
  ) {}

  private getWebhookBaseUrl(): string {
    const base = this.configService.get<string>('TELEGRAM_WEBHOOK_BASE_URL') || process.env.TELEGRAM_WEBHOOK_BASE_URL
    if (!base) {
      throw new BadRequestException('Configura TELEGRAM_WEBHOOK_BASE_URL para habilitar el webhook de Telegram')
    }
    return base.replace(/\/$/, '')
  }

  private buildWebhookUrl(businessId: string, customUrl?: string) {
    const baseUrl = (customUrl || this.getWebhookBaseUrl()).replace(/\/$/, '')
    const apiPrefix = (this.configService.get<string>('API_PREFIX') || 'api/v1').replace(/^\/+|\/+$/g, '')
    return `${baseUrl}/${apiPrefix}/telegram/webhook/${businessId}`
  }

  private async fetchBotInfo(token: string) {
    const response = await axios.get(`${this.apiBase}/bot${token}/getMe`)
    if (!response.data?.ok) {
      throw new BadRequestException(response.data?.description || 'Token de bot inválido')
    }
    return response.data.result
  }

  private async setWebhook(token: string, url: string, secretToken: string) {
    const response = await axios.post(`${this.apiBase}/bot${token}/setWebhook`, {
      url,
      secret_token: secretToken,
      drop_pending_updates: true,
      allowed_updates: ['message', 'edited_message'],
    })
    if (!response.data?.ok) {
      throw new BadRequestException(response.data?.description || 'No se pudo registrar el webhook de Telegram')
    }
  }

  private async deleteWebhook(token: string) {
    try {
      await axios.post(`${this.apiBase}/bot${token}/deleteWebhook`, { drop_pending_updates: true })
    } catch (error) {
      this.logger.warn(`No se pudo eliminar el webhook de Telegram: ${(error as any)?.message}`)
    }
  }

  private async updateBotConfig(businessId: string, data: Prisma.BotConfigUpdateInput) {
    try {
      await this.prisma.botConfig.update({ where: { businessId }, data })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        await this.prisma.botConfig.create({ data: { businessId, ...data } as Prisma.BotConfigCreateInput })
        return
      }
      throw error
    }
  }

  async connect(businessId: string, botToken: string, webhookUrl?: string, performedBy?: string) {
    const botInfo = await this.fetchBotInfo(botToken)
    const secretToken = randomBytes(24).toString('hex')
    const finalWebhookUrl = this.buildWebhookUrl(businessId, webhookUrl)

    await this.setWebhook(botToken, finalWebhookUrl, secretToken)

    await this.prisma.telegramConnection.upsert({
      where: { businessId },
      update: {
        botToken,
        botUsername: botInfo.username,
        botId: String(botInfo.id),
        webhookUrl: finalWebhookUrl,
        webhookSecret: secretToken,
        connected: true,
        status: 'CONNECTED',
        lastError: null,
        lastSyncAt: new Date(),
      },
      create: {
        businessId,
        botToken,
        botUsername: botInfo.username,
        botId: String(botInfo.id),
        webhookUrl: finalWebhookUrl,
        webhookSecret: secretToken,
        connected: true,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    })

    await this.updateBotConfig(businessId, {
      telegramEnabled: true,
      telegramBotToken: botToken,
      telegramBotUsername: botInfo.username,
      telegramBotId: String(botInfo.id),
      telegramWebhookSecret: secretToken,
      telegramWebhookUrl: finalWebhookUrl,
      telegramConnected: true,
      telegramLastSyncAt: new Date(),
    })

    await this.prisma.auditLog.create({
      data: {
        action: 'TELEGRAM_CONNECT',
        targetId: businessId,
        targetType: 'BUSINESS',
        performedBy: performedBy || 'SYSTEM',
        details: {
          botUsername: botInfo.username,
          webhookUrl: finalWebhookUrl,
        },
      },
    })

    return {
      connected: true,
      username: botInfo.username,
      webhookUrl: finalWebhookUrl,
    }
  }

  async disconnect(businessId: string, performedBy?: string) {
    const config = await this.prisma.botConfig.findUnique({ where: { businessId } })
    if (config?.telegramBotToken) {
      await this.deleteWebhook(config.telegramBotToken)
    }

    await this.prisma.telegramConnection.updateMany({
      where: { businessId },
      data: {
        connected: false,
        status: 'DISCONNECTED',
        lastSyncAt: new Date(),
      },
    })

    await this.updateBotConfig(businessId, {
      telegramEnabled: false,
      telegramConnected: false,
      telegramBotToken: null,
      telegramBotUsername: null,
      telegramBotId: null,
      telegramWebhookSecret: null,
      telegramWebhookUrl: null,
    })

    await this.prisma.auditLog.create({
      data: {
        action: 'TELEGRAM_DISCONNECT',
        targetId: businessId,
        targetType: 'BUSINESS',
        performedBy: performedBy || 'SYSTEM',
        details: {
          botUsername: config?.telegramBotUsername,
          reason: 'Manual disconnect',
        },
      },
    })

    return { connected: false }
  }

  async sendMessage(businessId: string, chatId: string, text: string) {
    const config = await this.prisma.botConfig.findUnique({ where: { businessId } })
    if (!config?.telegramBotToken || !config.telegramConnected) {
      throw new BadRequestException('Telegram no está configurado para este negocio')
    }

    const response = await axios.post(`${this.apiBase}/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: chatId,
      text,
    })

    if (!response.data?.ok) {
      throw new BadRequestException(response.data?.description || 'No se pudo enviar el mensaje en Telegram')
    }

    await this.messagesService.createMessage({
      businessId,
      direction: 'OUTBOUND',
      content: text,
      from: 'bot',
      to: chatId,
      platform: 'TELEGRAM',
      platformMessageId: String(response.data.result?.message_id || ''),
      status: 'SENT',
      aiResponse: false,
    })

    return { sent: true }
  }

  async handleWebhook(businessId: string, secretToken: string | undefined, payload: any) {
    const config = await this.prisma.botConfig.findUnique({ where: { businessId } })
    if (!config?.telegramWebhookSecret || secretToken !== config.telegramWebhookSecret) {
      this.logger.warn(`Webhook rechazado para negocio ${businessId}: secret inválido`)
      throw new UnauthorizedException('Invalid secret token')
    }

    const message = payload?.message || payload?.edited_message
    if (!message) {
      return { skipped: true }
    }

    const chatType = message.chat?.type
    const isGroup = chatType === 'group' || chatType === 'supergroup'
    
    if (isGroup && !config?.respondInGroups) {
      this.logger.debug(`Telegram group message ignored for business ${businessId} because respondInGroups is disabled`)
      return { skipped: true }
    }

    const chatId = String(message.chat?.id ?? '')
    const text = message.text || message.caption || ''

    await this.messagesService.createMessage({
      businessId,
      direction: 'INBOUND',
      content: text || '[Mensaje de Telegram]',
      from: chatId,
      to: String(message.chat?.username || config.telegramBotUsername || ''),
      platform: 'TELEGRAM',
      platformMessageId: String(message.message_id || ''),
      platformSenderId: chatId,
      status: 'DELIVERED',
      metadata: payload,
    })

    // Check if AI is paused for this contact
    const contact = await this.prisma.contact.findFirst({
      where: { businessId, phone: chatId },
      select: { isAiPaused: true },
    });

    if (config.autoReply !== false && text && !contact?.isAiPaused) {
      const aiResponse = await this.aiService.generateResponse(businessId, text, chatId, {
        platform: 'TELEGRAM',
        senderId: chatId,
      })

      if (aiResponse?.message) {
        await this.sendMessage(businessId, chatId, aiResponse.message)

        await this.messagesService.createMessage({
          businessId,
          direction: 'OUTBOUND',
          content: aiResponse.message,
          from: 'bot',
          to: chatId,
          platform: 'TELEGRAM',
          status: 'SENT',
          aiResponse: true,
          aiConfidence: aiResponse.confidence,
        })
      }
    }

    await this.prisma.telegramConnection.updateMany({
      where: { businessId },
      data: {
        connected: true,
        status: 'CONNECTED',
        lastError: null,
        lastSyncAt: new Date(),
      },
    })

    await this.updateBotConfig(businessId, {
      telegramConnected: true,
      telegramLastSyncAt: new Date(),
    })

    return { ok: true }
  }
}
