import { Body, Controller, Delete, Param, Post, Req, UseGuards } from '@nestjs/common'
import { TelegramService } from './telegram.service'
import { ConnectTelegramDto } from './dto/connect-telegram.dto'
import { SendTelegramMessageDto } from './dto/send-telegram.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('connect/:businessId')
  @UseGuards(JwtAuthGuard)
  async connect(
    @Param('businessId') businessId: string,
    @Body() body: ConnectTelegramDto,
  ) {
    return this.telegramService.connect(businessId, body.botToken, body.webhookUrl)
  }

  @Delete('connect/:businessId')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Param('businessId') businessId: string) {
    return this.telegramService.disconnect(businessId)
  }

  @Post('send/:businessId')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Param('businessId') businessId: string,
    @Body() body: SendTelegramMessageDto,
  ) {
    return this.telegramService.sendMessage(businessId, body.chatId, body.text)
  }

  @Post('webhook/:businessId')
  async handleWebhook(
    @Param('businessId') businessId: string,
    @Req() req: any,
    @Body() payload: any,
  ) {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string | undefined
    return this.telegramService.handleWebhook(businessId, secretToken, payload)
  }
}
