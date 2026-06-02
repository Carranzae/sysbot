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

    const whatsapp = {
      mode: (botConfig?.whatsappMode as WhatsAppIntegrationType) || WhatsAppIntegrationType.WHATSAPP_API,
      api: {
        enabled: Boolean(botConfig?.whatsappApiEnabled),
        businessId: botConfig?.whatsappBusinessId || null,
        phoneNumberId: botConfig?.whatsappPhoneNumberId || null,
        webhookSecret: botConfig?.whatsappWebhookSecret || null,
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
        number: botConfig?.whatsappWebNumber || null,
        status: botConfig?.whatsappWebStatus || (botConfig?.whatsappWebEnabled ? 'PENDING' : 'DISABLED'),
        qr: botConfig?.whatsappWebQr || null,
        lastSyncAt: botConfig?.updatedAt || null,
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
      },
      instagram: {
        enabled: Boolean(metaConnection?.instagramEnabled),
        connected: Boolean(metaConnection?.instagramConnected),
        accountId: metaConnection?.instagramAccountId || null,
        accessTokenConfigured: Boolean(metaConnection?.instagramAccessToken),
      },
      webhook: {
        url: metaConnection?.webhookUrl || null,
        verified: Boolean(metaConnection?.webhookVerified),
      },
    };

    return {
      businessId,
      generatedAt: new Date().toISOString(),
      whatsapp,
      telegram,
      meta,
    };
  }
}
