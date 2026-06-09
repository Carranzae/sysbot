import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ContactSource, MessageDirection, MessageStatus } from '@syst/database';
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
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
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

  async syncInbox(businessId: string, limit = 25) {
    const { gmail } = await this.getGmailClientForBusiness(businessId);
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: safeLimit,
      q: 'in:inbox newer_than:30d',
    });

    const messages = response.data.messages || [];
    let created = 0;
    let updated = 0;

    for (const messageRef of messages) {
      if (!messageRef.id) continue;
      const gmailMessage = await gmail.users.messages.get({
        userId: 'me',
        id: messageRef.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Message-ID'],
      });

      const headers = gmailMessage.data.payload?.headers || [];
      const fromHeader = this.headerValue(headers, 'From');
      const toHeader = this.headerValue(headers, 'To');
      const subject = this.headerValue(headers, 'Subject') || '(sin asunto)';
      const dateHeader = this.headerValue(headers, 'Date');
      const fromEmail = this.extractEmail(fromHeader);
      const toEmail = this.extractEmail(toHeader);
      const createdAt = dateHeader ? new Date(dateHeader) : new Date(Number(gmailMessage.data.internalDate || Date.now()));
      const senderName = this.extractName(fromHeader) || fromEmail;
      const externalId = `gmail:${gmailMessage.data.id}`;

      if (!fromEmail) continue;

      const contact = await this.prisma.contact.upsert({
        where: {
          id: await this.findEmailContactId(businessId, fromEmail),
        },
        update: {
          name: senderName,
          email: fromEmail,
          lastIncomingAt: createdAt,
          metadata: {
            channel: 'EMAIL',
            externalIdentity: fromEmail,
            lastEmailSubject: subject,
          },
        } as any,
        create: {
          businessId,
          name: senderName,
          phone: fromEmail,
          email: fromEmail,
          source: ContactSource.OTHER,
          autoCreated: true,
          lastIncomingAt: createdAt,
          metadata: {
            channel: 'EMAIL',
            externalIdentity: fromEmail,
            lastEmailSubject: subject,
          },
        } as any,
      });

      const existing = await this.prisma.message.findUnique({ where: { externalId } });
      const payload = {
        businessId,
        externalId,
        direction: MessageDirection.INBOUND,
        content: `${subject}\n\n${gmailMessage.data.snippet || ''}`.trim(),
        from: fromEmail,
        to: toEmail || 'me',
        platform: 'EMAIL',
        platformMessageId: gmailMessage.data.id,
        platformSenderId: fromEmail,
        status: MessageStatus.DELIVERED,
        createdAt,
        metadata: {
          gmailThreadId: gmailMessage.data.threadId,
          subject,
          fromHeader,
          toHeader,
          contactId: contact.id,
          labels: gmailMessage.data.labelIds || [],
        },
      };

      if (existing) {
        await this.prisma.message.update({ where: { id: existing.id }, data: payload as any });
        updated += 1;
      } else {
        await this.prisma.message.create({ data: payload as any });
        created += 1;
      }
    }

    return {
      businessId,
      scanned: messages.length,
      created,
      updated,
      syncedAt: new Date().toISOString(),
    };
  }

  async getInboxStatus(businessId: string) {
    const config = (await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: {
        gmailClientId: true,
        gmailClientSecret: true,
        gmailRefreshToken: true,
        gmailAccessToken: true,
        gmailTokenExpiry: true,
        emailSenderAddress: true,
        emailDailyQuota: true,
        emailDailyQuotaUsed: true,
      },
    })) as any;

    const lastMessage = await this.prisma.message.findFirst({
      where: { businessId, platform: 'EMAIL' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, from: true, to: true },
    });

    return {
      connected: Boolean(config?.gmailRefreshToken),
      credentialsConfigured: Boolean(config?.gmailClientId && config?.gmailClientSecret),
      accessTokenPresent: Boolean(config?.gmailAccessToken),
      tokenExpiresAt: config?.gmailTokenExpiry || null,
      tokenExpired: config?.gmailTokenExpiry ? config.gmailTokenExpiry < new Date() : false,
      sender: config?.emailSenderAddress || null,
      dailyQuota: config?.emailDailyQuota || 0,
      dailyQuotaUsed: config?.emailDailyQuotaUsed || 0,
      lastMessageAt: lastMessage?.createdAt || null,
      lastMessageFrom: lastMessage?.from || null,
    };
  }

  private async findEmailContactId(businessId: string, email: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        businessId,
        OR: [{ email }, { phone: email }],
      },
      select: { id: true },
    });

    return contact?.id || `email:${businessId}:${email}`;
  }

  private headerValue(headers: Array<{ name?: string | null; value?: string | null }>, name: string) {
    return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || '';
  }

  private extractEmail(value: string) {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value || '').trim().toLowerCase();
  }

  private extractName(value: string) {
    const name = value.replace(/<[^>]+>/, '').replace(/"/g, '').trim();
    return name.includes('@') ? '' : name;
  }
}
