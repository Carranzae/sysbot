import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TelegramAuthStatus, TelegramIntegrationMode, UserRole, WhatsAppIntegrationType } from '@syst/database';
import { PrismaService } from '../database/prisma.service';

type AccessOptions = {
  ownerId?: string;
  role?: UserRole;
};

@Injectable()
export class ChannelConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdminRole(role?: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }

  private async ensureBusinessAccess(ownerId: string | undefined, businessId: string, role?: UserRole) {
    if (this.isAdminRole(role)) {
      return;
    }

    if (!ownerId) {
      throw new ForbiddenException('You do not have access to this business');
    }

    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId,
      },
      select: { id: true },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found for this user`);
    }
  }

  async getChannelStatus(businessId: string, options: AccessOptions = {}) {
    await this.ensureBusinessAccess(options.ownerId, businessId, options.role);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        botConfig: true,
        whatsappAccounts: {
          select: {
            id: true,
            phoneNumber: true,
            phoneNumberId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        telegramConnection: true,
        metaPlatformConnection: true,
      },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    const botConfig = business.botConfig;
    const whatsappAccounts = business.whatsappAccounts || [];
    const telegramConnection = business.telegramConnection;
    const metaConnection = business.metaPlatformConnection;
    const [lastWhatsappMessage, lastMessengerMessage, lastInstagramMessage, lastEmailMessage, lastCallLog] = await Promise.all([
      this.prisma.message.findFirst({
        where: { businessId, platform: 'WHATSAPP' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, direction: true, status: true },
      }),
      this.prisma.message.findFirst({
        where: { businessId, platform: 'MESSENGER' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, direction: true, status: true },
      }),
      this.prisma.message.findFirst({
        where: { businessId, platform: 'INSTAGRAM' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, direction: true, status: true },
      }),
      this.prisma.message.findFirst({
        where: { businessId, platform: 'EMAIL' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, direction: true, status: true },
      }),
      this.prisma.callLog.findFirst({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true, queryResolved: true },
      }),
    ]);

    const now = new Date();
    const gmailTokenExpired = botConfig?.gmailTokenExpiry ? botConfig.gmailTokenExpiry < now : false;

    const whatsapp = {
      mode: (botConfig?.whatsappMode as WhatsAppIntegrationType) || WhatsAppIntegrationType.WHATSAPP_API,
      api: {
        enabled: Boolean(botConfig?.whatsappApiEnabled),
        connected: Boolean(botConfig?.whatsappApiEnabled && (botConfig?.whatsappApiKey || whatsappAccounts.some((account) => account.isActive))),
        businessId: botConfig?.whatsappBusinessId || null,
        phoneNumberId: botConfig?.whatsappPhoneNumberId || null,
        webhookSecret: botConfig?.whatsappWebhookSecret || null,
        webhookConfigured: Boolean(botConfig?.whatsappWebhookSecret || whatsappAccounts.some((account) => account.isActive)),
        tokenConfigured: Boolean(botConfig?.whatsappApiKey || whatsappAccounts.some((account) => account.isActive)),
        lastMessageAt: lastWhatsappMessage?.createdAt || null,
        lastMessageDirection: lastWhatsappMessage?.direction || null,
        lastMessageStatus: lastWhatsappMessage?.status || null,
        accounts: whatsappAccounts.map((account) => ({
          id: account.id,
          phoneNumber: account.phoneNumber,
          phoneNumberId: account.phoneNumberId,
          active: account.isActive,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        })),
      },
      web: {
        enabled: Boolean(botConfig?.whatsappWebEnabled),
        connected: botConfig?.whatsappWebStatus === 'READY',
        number: botConfig?.whatsappWebNumber || null,
        status: botConfig?.whatsappWebStatus || (botConfig?.whatsappWebEnabled ? 'PENDING' : 'DISABLED'),
        qr: botConfig?.whatsappWebQr || null,
        lastSyncAt: botConfig?.updatedAt || null,
        lastMessageAt: lastWhatsappMessage?.createdAt || null,
      },
    };

    const telegram = {
      mode: botConfig?.telegramMode || TelegramIntegrationMode.BOT,
      enabled: Boolean(botConfig?.telegramEnabled),
      authStatus: botConfig?.telegramAuthStatus || TelegramAuthStatus.NOT_CONFIGURED,
      connected: Boolean(botConfig?.telegramConnected),
      lastSyncAt: botConfig?.telegramLastSyncAt || telegramConnection?.lastSyncAt || null,
      bot: telegramConnection
        ? {
            username: telegramConnection.botUsername,
            webhookUrl: telegramConnection.webhookUrl,
            secretToken: telegramConnection.webhookSecret,
            status: telegramConnection.status,
            connected: telegramConnection.connected,
            lastError: telegramConnection.lastError,
          }
        : null,
      personal:
        botConfig?.telegramMode === TelegramIntegrationMode.PERSONAL
          ? {
              phone: botConfig?.telegramPhone || null,
              twoFactorEnabled: botConfig?.telegramTwoFactorEnabled ?? false,
              status: botConfig?.telegramAuthStatus || TelegramAuthStatus.NOT_CONFIGURED,
            }
          : null,
    };

    const meta = {
      messenger: {
        enabled: Boolean(metaConnection?.messengerEnabled),
        connected: Boolean(metaConnection?.messengerConnected),
        pageId: metaConnection?.messengerPageId || null,
        verifyToken: metaConnection?.messengerVerifyToken || null,
        accessTokenConfigured: Boolean(metaConnection?.messengerAccessToken),
        webhookActive: Boolean(metaConnection?.webhookVerified && metaConnection?.messengerVerifyToken),
        lastMessageAt: lastMessengerMessage?.createdAt || null,
        lastMessageDirection: lastMessengerMessage?.direction || null,
        lastMessageStatus: lastMessengerMessage?.status || null,
      },
      instagram: {
        enabled: Boolean(metaConnection?.instagramEnabled),
        connected: Boolean(metaConnection?.instagramConnected),
        accountId: metaConnection?.instagramAccountId || null,
        accessTokenConfigured: Boolean(metaConnection?.instagramAccessToken),
        webhookActive: Boolean(metaConnection?.webhookVerified),
        lastMessageAt: lastInstagramMessage?.createdAt || null,
        lastMessageDirection: lastInstagramMessage?.direction || null,
        lastMessageStatus: lastInstagramMessage?.status || null,
      },
      webhook: {
        url: metaConnection?.webhookUrl || null,
        verified: Boolean(metaConnection?.webhookVerified),
      },
    };

    const email = {
      gmail: {
        enabled: Boolean(botConfig?.gmailClientId && botConfig?.gmailClientSecret),
        connected: Boolean(botConfig?.gmailRefreshToken),
        sender: botConfig?.emailSenderAddress || null,
        tokenConfigured: Boolean(botConfig?.gmailAccessToken || botConfig?.gmailRefreshToken),
        tokenExpiresAt: botConfig?.gmailTokenExpiry || null,
        tokenExpired: gmailTokenExpired,
        dailyQuota: botConfig?.emailDailyQuota || 0,
        dailyQuotaUsed: botConfig?.emailDailyQuotaUsed || 0,
        lastMessageAt: lastEmailMessage?.createdAt || null,
        lastMessageDirection: lastEmailMessage?.direction || null,
        lastMessageStatus: lastEmailMessage?.status || null,
      },
    };

    const voice = {
      enabled: Boolean(botConfig?.callEnabled || botConfig?.audioEnabled),
      connected: Boolean(botConfig?.callEnabled),
      provider: 'TWILIO',
      lastCallAt: lastCallLog?.createdAt || null,
      lastCallStatus: lastCallLog?.status || null,
      lastCallResolved: lastCallLog?.queryResolved ?? null,
    };

    return {
      businessId,
      generatedAt: new Date().toISOString(),
      whatsapp,
      telegram,
      meta,
      email,
      voice,
    };
  }
}
