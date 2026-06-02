import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { MailComposer } from 'nodemailer';

interface SendEmailPayload {
  businessId: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  constructor(private readonly prisma: PrismaService) {}

  private async getGmailClientForBusiness(businessId: string) {
    const config = (await this.prisma.botConfig.findUnique({
      where: { businessId },
    })) as any;

    if (
      !config ||
      !config.gmailClientId ||
      !config.gmailClientSecret ||
      !config.gmailRefreshToken
    ) {
      throw new BadRequestException('Gmail API configuration is incomplete. Please set up OAuth2 credentials.');
    }

    const now = new Date();
    let quotaUsed = config.emailDailyQuotaUsed ?? 0;
    let quotaResetAt = config.emailQuotaResetAt as Date | null;

    if (!quotaResetAt || quotaResetAt < now) {
      const resetAt = new Date();
      resetAt.setHours(24, 0, 0, 0);
      await this.prisma.botConfig.update({
        where: { businessId },
        data: {
          emailDailyQuotaUsed: 0,
          emailQuotaResetAt: resetAt,
        } as any,
      });
      quotaUsed = 0;
      quotaResetAt = resetAt;
    }

    if ((config.emailDailyQuota ?? 0) > 0 && quotaUsed >= (config.emailDailyQuota ?? 0)) {
      throw new BadRequestException('Daily free email quota exceeded.');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.gmailClientId,
      config.gmailClientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // or the redirect URI used
    );

    oauth2Client.setCredentials({
      refresh_token: config.gmailRefreshToken,
      access_token: config.gmailAccessToken,
      expiry_date: config.gmailTokenExpiry ? config.gmailTokenExpiry.getTime() : undefined,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    return {
      gmail,
      config: {
        ...config,
        emailDailyQuotaUsed: quotaUsed,
        emailQuotaResetAt: quotaResetAt,
      },
    };
  }

  async sendEmail(payload: SendEmailPayload) {
    const { gmail, config } = await this.getGmailClientForBusiness(payload.businessId);

    const composer = new MailComposer({
      from: config.emailSenderAddress || 'me',
      to: payload.to.join(', '),
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    const message = await composer.compile().build();
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      await this.prisma.botConfig.update({
        where: { businessId: payload.businessId },
        data: {
          emailDailyQuotaUsed: {
            increment: payload.to.length,
          },
        } as any,
      });
    } catch (error) {
      throw new InternalServerErrorException(`Failed to send email: ${error.message}`);
    }
  }

  async getAuthUrl(businessId: string): Promise<string> {
    const config = (await this.prisma.botConfig.findUnique({
      where: { businessId },
    })) as any;

    if (!config || !config.gmailClientId || !config.gmailClientSecret) {
      throw new BadRequestException('Gmail client credentials not configured.');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.gmailClientId,
      config.gmailClientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
    });

    return authUrl;
  }

  async handleCallback(code: string, businessId: string) {
    const config = (await this.prisma.botConfig.findUnique({
      where: { businessId },
    })) as any;

    if (!config || !config.gmailClientId || !config.gmailClientSecret) {
      throw new BadRequestException('Gmail client credentials not configured.');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.gmailClientId,
      config.gmailClientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    const { tokens } = await oauth2Client.getToken(code);

    await this.prisma.botConfig.update({
      where: { businessId },
      data: {
        gmailRefreshToken: tokens.refresh_token,
        gmailAccessToken: tokens.access_token,
        gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      } as any,
    });
  }
}
