import { EventEmitter } from 'events'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConfigScope } from '@prisma/client'

import { PrismaService } from '../database/prisma.service'

type CacheEntry = {
  value: string | null
  expiresAt: number
}

export type ConfigChangeEvent = {
  key: string
  value: string | null
}

type ConfigListener = (event: ConfigChangeEvent) => void

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)
  private readonly cache = new Map<string, CacheEntry>()
  private readonly emitter = new EventEmitter()
  private readonly ttlMs: number

  constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
    const ttlFromEnv = Number(this.configService.get('SETTINGS_CACHE_TTL_MS') ?? 60000)
    this.ttlMs = Number.isFinite(ttlFromEnv) && ttlFromEnv > 0 ? ttlFromEnv : 60000
  }

  async getValue(
    key: string,
    options?: {
      defaultValue?: string | null
      bypassCache?: boolean
    },
  ): Promise<string | null> {
    const now = Date.now()
    if (!options?.bypassCache) {
      const cached = this.cache.get(key)
      if (cached && cached.expiresAt > now) {
        return cached.value
      }
    }

    const record = await this.prisma.systemConfig.findFirst({
      where: { key, scope: ConfigScope.GLOBAL },
      orderBy: { updatedAt: 'desc' },
    })

    const fallback = options?.defaultValue ?? null
    const value = record?.value ?? fallback

    this.cache.set(key, { value, expiresAt: now + this.ttlMs })
    return value
  }

  async getValues(keys: string[], options?: { bypassCache?: boolean; defaults?: Record<string, string | null> }) {
    const entries = await Promise.all(
      keys.map((key) => this.getValue(key, { ...options, defaultValue: options?.defaults?.[key] })),
    )

    return keys.reduce<Record<string, string | null>>((acc, key, index) => {
      acc[key] = entries[index]
      return acc
    }, {})
  }

  async refreshKey(key: string, defaultValue?: string | null) {
    const value = await this.getValue(key, { bypassCache: true, defaultValue })
    const event: ConfigChangeEvent = { key, value }
    this.emitter.emit('config-change', event)
    this.logger.debug?.(`Config key ${key} refreshed`)
    return value
  }

  invalidateKey(key?: string) {
    if (!key) {
      this.cache.clear()
      this.logger.debug?.('Cleared settings cache')
      return
    }

    this.cache.delete(key)
    this.logger.debug?.(`Invalidated config key ${key}`)
  }

  onConfigChange(listener: ConfigListener) {
    this.emitter.on('config-change', listener)
    return () => this.emitter.off('config-change', listener)
  }
}
