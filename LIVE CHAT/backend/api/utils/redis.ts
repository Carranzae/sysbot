import Redis from 'ioredis'
import { logger } from './logger'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

let redis: Redis | null = null

try {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('⚠️ [Redis] No se pudo conectar tras 3 intentos. Trabajando en modo memoria (Fallback).')
        return null // Deja de reintentar
      }
      return Math.min(times * 200, 2000)
    }
  })

  redis.on('error', (err) => {
    logger.error('❌ [Redis] Error de conexión:', { error: err.message })
  })

  redis.on('connect', () => {
    logger.info('🚀 [Redis] Conexión establecida con éxito')
  })
} catch (error: any) {
  logger.error('❌ [Redis] Error inicializando cliente:', { error: error.message })
}

export { redis }
