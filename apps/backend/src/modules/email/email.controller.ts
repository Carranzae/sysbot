import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('auth/gmail')
  async getAuthUrl(@Body() { businessId }: { businessId: string }) {
    const url = await this.emailService.getAuthUrl(businessId);
    return { url };
  }

  @Post('auth/gmail/callback')
  async handleCallback(@Body() { code, businessId }: { code: string; businessId: string }) {
    await this.emailService.handleCallback(code, businessId);
    return { success: true };
  }

  @Post('gmail/sync')
  async syncInbox(@Query('businessId') businessId: string, @Query('limit') limit?: string) {
    return this.emailService.syncInbox(businessId, limit ? Number(limit) : 25);
  }

  @Get('gmail/status')
  async getInboxStatus(@Query('businessId') businessId: string) {
    return this.emailService.getInboxStatus(businessId);
  }
}
