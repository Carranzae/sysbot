import { Controller, Post, Body } from '@nestjs/common';
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
}
