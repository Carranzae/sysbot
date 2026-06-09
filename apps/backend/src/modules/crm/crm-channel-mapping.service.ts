import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { CRMChannelType, TelegramAuthStatus, UserRole } from '@syst/database'
import { PrismaService } from '../database/prisma.service'
import { ChannelConfigService } from '../channel-config/channel-config.service'

type ChannelOption = {
  key: string
  type: CRMChannelType
  label: string
  description?: string
  status?: string | null
  metadata?: Record<string, any>
  compatible: boolean
  reasons?: string[]
  actions?: string[]
}

type AccessOptions = {
  ownerId?: string
  role?: UserRole
}

@Injectable()
export class CRMChannelMappingService {
  private readonly logger = new Logger(CRMChannelMappingService.name)

  constructor(private readonly prisma: PrismaService, private readonly channelConfig: ChannelConfigService) {}

  private buildChannelOptions(status: any): ChannelOption[] {
    const options: ChannelOption[] = []

    const whatsappApiAccounts = status?.whatsapp?.api?.accounts || []
    whatsappApiAccounts.forEach((account: any) => {
      const reasons: string[] = []
      const actions: string[] = []

      if (!status?.whatsapp?.api?.enabled) {
        reasons.push('WhatsApp API no está habilitada para este negocio.')
        actions.push('Activa WhatsApp API en Canales > WhatsApp.')
      }

      if (!account.active) {
        reasons.push('La cuenta está desactivada.')
        actions.push('Activa la línea en la sección de WhatsApp API.')
      }

      if (!account.phoneNumberId) {
        reasons.push('No se encontró el identificador de número de WhatsApp.')
        actions.push('Vuelve a sincronizar la cuenta de WhatsApp Business.')
      }

      options.push({
        key: `WHATSAPP_API:${account.id}`,
        type: CRMChannelType.WHATSAPP_API,
        label: account.phoneNumber || account.phoneNumberId || 'WhatsApp API',
        description: 'WhatsApp Business API',
        metadata: {
          accountId: account.id,
          phoneNumberId: account.phoneNumberId,
          phoneNumber: account.phoneNumber,
        },
        status: account.active ? 'ACTIVE' : 'INACTIVE',
        compatible: reasons.length === 0,
        reasons: reasons.length ? reasons : undefined,
        actions: actions.length ? actions : undefined,
      })
    })

    if (status?.whatsapp?.web?.enabled) {
      const reasons: string[] = []
      const actions: string[] = []
      const webStatus = status.whatsapp.web.status || 'PENDING'

      if (!['CONNECTED', 'READY'].includes(webStatus)) {
        reasons.push('La sesión de WhatsApp Web no está conectada.')
        actions.push('Escanea el código QR o vuelve a vincular la sesión Web.')
      }

      options.push({
        key: 'WHATSAPP_WEB',
        type: CRMChannelType.WHATSAPP_WEB,
        label: 'WhatsApp Web',
        description: 'Sesión espejo',
        status: webStatus,
        compatible: reasons.length === 0,
        reasons: reasons.length ? reasons : undefined,
        actions: actions.length ? actions : undefined,
      })
    }

    if (status?.telegram?.bot?.username) {
      const reasons: string[] = []
      const actions: string[] = []

      if (!status.telegram.enabled) {
        reasons.push('Telegram no está habilitado en este negocio.')
        actions.push('Activa Telegram en Canales > Telegram.')
      }

      if (!status.telegram.bot.connected) {
        reasons.push('El bot de Telegram no está conectado.')
        actions.push('Revisa el token y vuelve a configurar el bot.')
      }

      if (status.telegram.authStatus === TelegramAuthStatus.ERROR) {
        reasons.push('Existe un error pendiente en la autenticación de Telegram.')
        actions.push('Resuelve el error de autenticación antes de sincronizar con el CRM.')
      }

      options.push({
        key: 'TELEGRAM_BOT',
        type: CRMChannelType.TELEGRAM_BOT,
        label: `Bot @${status.telegram.bot.username}`,
        description: 'Telegram Bot API',
        status: status.telegram.bot.status,
        compatible: reasons.length === 0,
        reasons: reasons.length ? reasons : undefined,
        actions: actions.length ? actions : undefined,
      })
    }

    if (status?.telegram?.personal?.phone) {
      const reasons: string[] = []
      const actions: string[] = []
      const personalStatus = status.telegram.personal.status || TelegramAuthStatus.NOT_CONFIGURED

      if (personalStatus !== TelegramAuthStatus.CONNECTED) {
        reasons.push('La cuenta personal de Telegram no está autenticada.')
        actions.push('Completa el flujo de autenticación personal en Canales > Telegram.')
      }

      options.push({
        key: 'TELEGRAM_PERSONAL',
        type: CRMChannelType.TELEGRAM_PERSONAL,
        label: `Cuenta personal ${status.telegram.personal.phone}`,
        description: 'Telegram modo personal (beta)',
        status: personalStatus,
        compatible: reasons.length === 0,
        reasons: reasons.length ? reasons : undefined,
        actions: actions.length ? actions : undefined,
      })
    }

    if (status?.meta?.messenger?.enabled) {
      const reasons: string[] = []
      const actions: string[] = []

      if (!status.meta.messenger.connected) {
        reasons.push('La página de Facebook no está conectada.')
        actions.push('Conecta la página en Canales > Meta.')
      }

      if (!status.meta.webhook?.verified) {
        reasons.push('El webhook de Meta no está verificado.')
        actions.push('Verifica el webhook proporcionado por Meta para habilitar la sincronización.')
      }

      options.push({
        key: 'MESSENGER',
        type: CRMChannelType.MESSENGER,
        label: 'Facebook Messenger',
        description: status.meta.messenger.pageId ? `Página ${status.meta.messenger.pageId}` : undefined,
        status: status.meta.messenger.connected ? 'CONNECTED' : 'DISCONNECTED',
        compatible: reasons.length === 0,
        reasons: reasons.length ? reasons : undefined,
        actions: actions.length ? actions : undefined,
      })
    }

    if (status?.meta?.instagram?.enabled) {
      const reasons: string[] = []
      const actions: string[] = []

      if (!status.meta.instagram.connected) {
        reasons.push('La cuenta de Instagram no está conectada.')
        actions.push('Autoriza la cuenta de Instagram desde Canales > Meta.')
      }

      if (!status.meta.instagram.accountId) {
        reasons.push('No se detectó el ID de cuenta de Instagram.')
        actions.push('Vincula una cuenta profesional de Instagram.')
      }

      options.push({
        key: 'INSTAGRAM',
        type: CRMChannelType.INSTAGRAM,
        label: 'Instagram Direct',
        description: status.meta.instagram.accountId ? `Cuenta ${status.meta.instagram.accountId}` : undefined,
        status: status.meta.instagram.connected ? 'CONNECTED' : 'DISCONNECTED',
        compatible: reasons.length === 0,
        reasons: reasons.length ? reasons : undefined,
        actions: actions.length ? actions : undefined,
      })
    }

    return options
  }

  async getChannelMappings(businessId: string, access?: AccessOptions) {
    const status = await this.channelConfig.getChannelStatus(businessId, access)
    const options = this.buildChannelOptions(status)

    const connection = await this.safeQuery('CRM connection', () => this.prisma.cRMConnection.findUnique({ where: { businessId } }))
    if (!connection) {
      return { options, enabledKeys: [] }
    }

    const mappings = await this.safeQuery('CRM channel mappings', () =>
      this.prisma.cRMChannelMapping.findMany({
        where: { crmConnectionId: connection.id },
      }),
      [],
    )

    return {
      options,
      enabledKeys: (mappings || []).filter((mapping) => mapping.enabled).map((mapping) => mapping.channelKey),
    }
  }

  async saveChannelMappings(businessId: string, channelKeys: string[], access?: AccessOptions) {
    const connection = await this.prisma.cRMConnection.findUnique({ where: { businessId } })
    if (!connection) {
      throw new NotFoundException('Debes configurar un CRM antes de asignar canales')
    }

    const status = await this.channelConfig.getChannelStatus(businessId, access)
    const options = this.buildChannelOptions(status)
    const allowedKeys = new Map(options.map((option) => [option.key, option]))

    const incompatibleRequested = channelKeys
      .map((key) => ({ key, option: allowedKeys.get(key) }))
      .filter(({ option }) => option && !option.compatible)
      .map(({ key }) => key)

    if (incompatibleRequested.length) {
      const labels = incompatibleRequested
        .map((key) => allowedKeys.get(key)?.label || key)
        .join(', ')
      throw new BadRequestException(
        `Estos canales no están listos para sincronizar con el CRM: ${labels}. Completa la configuración indicada antes de habilitarlos.`,
      )
    }

    const sanitizedKeys = channelKeys.filter((key) => {
      const option = allowedKeys.get(key)
      return Boolean(option && option.compatible)
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.cRMChannelMapping.deleteMany({
        where: {
          crmConnectionId: connection.id,
          channelKey: { notIn: sanitizedKeys.length ? sanitizedKeys : ['__KEEP_NONE__'] },
        },
      })

      for (const key of sanitizedKeys) {
        const option = allowedKeys.get(key)!
        await tx.cRMChannelMapping.upsert({
          where: {
            crmConnectionId_channelKey: {
              crmConnectionId: connection.id,
              channelKey: key,
            },
          },
          update: {
            enabled: true,
            channelType: option.type,
            metadata: option.metadata,
            whatsappAccountId:
              option.type === CRMChannelType.WHATSAPP_API ? option.metadata?.accountId ?? null : null,
          },
          create: {
            businessId,
            crmConnectionId: connection.id,
            channelType: option.type,
            channelKey: key,
            enabled: true,
            metadata: option.metadata,
            whatsappAccountId:
              option.type === CRMChannelType.WHATSAPP_API ? option.metadata?.accountId ?? null : null,
          },
        })
      }
    })

    return { success: true }
  }

  private async safeQuery<T>(label: string, query: () => Promise<T>, fallback: T | null = null): Promise<T | null> {
    try {
      return await query()
    } catch (error: any) {
      this.logger.warn(`[CRM channels] ${label} skipped: ${error.message}`)
      return fallback
    }
  }
}
