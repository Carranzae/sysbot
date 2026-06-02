import { redis } from './redis'
import { logger } from './logger'

class SimpleCache {
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map()

  async set(key: string, data: any, ttlSeconds: number = 60) {
    try {
      // 1. Intentar en Redis si está disponible
      if (redis && redis.status === 'ready') {
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds)
        return
      }
    } catch (error: any) {
      logger.warn(`[Cache] Falló Redis al guardar ${key}, usando memoria.`, { error: error.message })
    }

    // 2. Fallback a Memoria
    const expiry = Date.now() + ttlSeconds * 1000
    this.memoryCache.set(key, { data, expiry })
  }

  async get(key: string) {
    try {
      // 1. Intentar en Redis
      if (redis && redis.status === 'ready') {
        const cached = await redis.get(key)
        if (cached) return JSON.parse(cached)
      }
    } catch (error: any) {
      logger.warn(`[Cache] Falló Redis al leer ${key}, revisando memoria.`, { error: error.message })
    }

    // 2. Revisar en Memoria
    const item = this.memoryCache.get(key)
    if (!item) return null
    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key)
      return null
    }
    return item.data
  }

  async delete(key: string) {
    try {
      if (redis && redis.status === 'ready') {
        await redis.del(key)
      }
    } catch (e) {}
    this.memoryCache.delete(key)
  }

  async deleteByPattern(pattern: string) {
    try {
      if (redis && redis.status === 'ready') {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
          logger.info(`🎯 [Cache] Invalidación quirúrgica: ${keys.length} llaves eliminadas para patrón ${pattern}`)
        }
        return
      }
    } catch (e) {
      logger.warn(`[Cache] Falló deleteByPattern en Redis, recurriendo a limpieza de memoria.`)
    }

    // Fallback memoria: Filtrar por regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*'))
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key)
      }
    }
  }

  async clear() {
    try {
      if (redis && redis.status === 'ready') {
        await redis.flushdb()
        logger.info('🧹 [Cache] Redis limpiado (FlushDB)')
      }
    } catch (e) {}
    this.memoryCache.clear()
    logger.info('🧹 [Cache] Memoria local limpia')
  }
}

export const fastCache = new SimpleCache()
