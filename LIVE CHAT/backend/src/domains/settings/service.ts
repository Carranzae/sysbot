import { db } from '../../../database/db'
import { fastCache } from '../../../api/utils/cache'

export class SettingsService {
  async getMaintenanceMode() {
    try {
      const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['maintenance_mode'])
      return rows[0]?.value?.enabled || false
    } catch (e) {
      return false
    }
  }

  async setMaintenanceMode(enabled: boolean) {
    await db.query(
      'INSERT INTO site_settings (id, value, updated_at) VALUES ($2, $1, NOW()) ON CONFLICT (id) DO UPDATE SET value = $1, updated_at = NOW()',
      [JSON.stringify({ enabled: !!enabled }), 'maintenance_mode']
    )
    await fastCache.delete('site:maintenance_mode')
    return !!enabled
  }

  async getSystemCredentials() {
    try {
      const cacheKey = 'site:system_credentials'
      const cached = await fastCache.get(cacheKey)
      if (cached !== null) return cached

      const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['system_credentials'])
      const credentials = rows[0]?.value || { shalomEmail: '', shalomPassword: '' }
      await fastCache.set(cacheKey, credentials, 3600)
      return credentials
    } catch (e) {
      return { shalomEmail: '', shalomPassword: '' }
    }
  }

  async setSystemCredentials(credentials: { shalomEmail?: string, shalomPassword?: string }) {
    await db.query(
      'INSERT INTO site_settings (id, value, updated_at) VALUES ($2, $1, NOW()) ON CONFLICT (id) DO UPDATE SET value = $1, updated_at = NOW()',
      [JSON.stringify(credentials), 'system_credentials']
    )
    await fastCache.delete('site:system_credentials')
    return credentials
  }

  async getExchangeRate() {
    try {
      const cacheKey = 'site:exchange_rate'
      const cached = await fastCache.get(cacheKey)
      if (cached !== null) return cached

      const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['exchange_rate'])
      const rate = rows[0]?.value?.rate || 3.80 // Default PEN/USD
      await fastCache.set(cacheKey, rate, 3600) // Cache de 1 hora
      return rate
    } catch (e) {
      return 3.80
    }
  }

  async setExchangeRate(rate: number) {
    await db.query(
      'INSERT INTO site_settings (id, value, updated_at) VALUES ($2, $1, NOW()) ON CONFLICT (id) DO UPDATE SET value = $1, updated_at = NOW()',
      [JSON.stringify({ rate: Number(rate) }), 'exchange_rate']
    )
    await fastCache.delete('site:exchange_rate')
    return Number(rate)
  }

  async getAdVideoConfig() {
    try {
      const cacheKey = 'site:ad_video_config'
      const cached = await fastCache.get(cacheKey)
      if (cached !== null) return cached

      const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['ad_video_config'])
      const config = rows[0]?.value || { enabled: false, video_url: '' }
      await fastCache.set(cacheKey, config, 3600)
      return config
    } catch (e) {
      return { enabled: false, video_url: '' }
    }
  }

  async setAdVideoConfig(config: { enabled: boolean, video_url: string }) {
    await db.query(
      'INSERT INTO site_settings (id, value, updated_at) VALUES ($2, $1, NOW()) ON CONFLICT (id) DO UPDATE SET value = $1, updated_at = NOW()',
      [JSON.stringify(config), 'ad_video_config']
    )
    await fastCache.delete('site:ad_video_config')
    return config
  }
  async getGlobalSettings() {
    try {
      const cacheKey = 'site:global_settings'
      const cached = await fastCache.get(cacheKey)
      if (cached !== null) return cached

      const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['global_settings'])
      const settings = rows[0]?.value || {
        storeName: '✨ @tinestore',
        contactWhatsApp: '989353316',
        contactEmail: 'contacto@tinestore.com',
        websiteUrl: '',
        enableNotifications: true,
        maintenanceMode: false,
        allowProviderRegistration: true,
        allowHomeDelivery: false,
        memoryConfig: {
          value: 10,
          unit: 'days'
        },
        socialLinks: {
          instagram: 'https://www.instagram.com/tines_store',
          facebook: 'https://www.facebook.com/tinestore',
          twitter: 'https://x.com/tines_store',
          youtube: 'https://www.youtube.com/@tines_store',
        }
      }
      await fastCache.set(cacheKey, settings, 3600)
      return settings
    } catch (e) {
      return {}
    }
  }

  async setGlobalSettings(settings: any) {
    await db.query(
      'INSERT INTO site_settings (id, value, updated_at) VALUES ($2, $1, NOW()) ON CONFLICT (id) DO UPDATE SET value = $1, updated_at = NOW()',
      [JSON.stringify(settings), 'global_settings']
    )
    await fastCache.delete('site:global_settings')
    // También invalidar mantenimiento si está incluido
    if (settings.maintenanceMode !== undefined) {
      await fastCache.delete('site:maintenance_mode')
    }
    return settings
  }

  async getNpsStats(userId: string) {
    // 1. Obtener conteo de promotores, pasivos, detractores y promedio de calificaciones
    const { rows: summaryRows } = await db.query(
      `SELECT 
         COUNT(*) as total_surveys,
         COUNT(CASE WHEN score IS NOT NULL THEN 1 END) as total_responses,
         COUNT(CASE WHEN score >= 9 THEN 1 END) as promoters,
         COUNT(CASE WHEN score >= 7 AND score <= 8 THEN 1 END) as passives,
         COUNT(CASE WHEN score >= 0 AND score <= 6 THEN 1 END) as detractors,
         ROUND(AVG(score), 2) as average_score
       FROM nps_surveys
       WHERE user_id = $1`,
      [userId]
    )

    const summary = summaryRows[0] || {
      total_surveys: 0,
      total_responses: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      average_score: 0
    }

    // Calcular el score NPS neto
    // NPS = % Promotores - % Detractores
    const totalResponses = Number(summary.total_responses) || 0
    const promoters = Number(summary.promoters) || 0
    const detractors = Number(summary.detractors) || 0

    let npsScore = 0
    if (totalResponses > 0) {
      npsScore = Math.round(((promoters - detractors) / totalResponses) * 100)
    }

    // 2. Obtener lista de encuestas completadas con detalles del pedido
    const { rows: surveys } = await db.query(
      `SELECT 
         n.id,
         n.order_id,
         n.customer_phone,
         n.score as rating,
         n.comment,
         n.created_at,
         o.customer_name,
         o.payment_reference_code
       FROM nps_surveys n
       LEFT JOIN orders o ON n.order_id = o.id
       WHERE n.user_id = $1 AND n.score IS NOT NULL
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [userId]
    )

    return {
      summary: {
        total_surveys: Number(summary.total_surveys) || 0,
        total_responses: totalResponses,
        promoters,
        passives: Number(summary.passives) || 0,
        detractors,
        average_score: parseFloat(summary.average_score || 0),
        nps_score: npsScore
      },
      surveys
    }
  }

  async getSystemHealth() {
    const startTime = Date.now()
    let dbStatus = 'healthy'
    let dbLatency = 0
    let tableCounts: any = {}

    // 1. Verificar Base de Datos (PostgreSQL)
    try {
      const dbStart = Date.now()
      await db.query('SELECT 1')
      dbLatency = Date.now() - dbStart

      // Consultar volumen físico de tablas clave para telemetría
      const { rows: usersCount } = await db.query("SELECT COUNT(*) FROM users")
      const { rows: productsCount } = await db.query("SELECT COUNT(*) FROM products")
      const { rows: ordersCount } = await db.query("SELECT COUNT(*) FROM orders")
      const { rows: commissionsCount } = await db.query("SELECT COUNT(*) FROM commissions_ledger")

      tableCounts = {
        users: parseInt(usersCount[0]?.count || '0'),
        products: parseInt(productsCount[0]?.count || '0'),
        orders: parseInt(ordersCount[0]?.count || '0'),
        commissions: parseInt(commissionsCount[0]?.count || '0'),
      }
    } catch (e: any) {
      dbStatus = 'error'
      dbLatency = -1
    }

    // 2. Verificar AI Gemini Key Rotator
    let geminiStats: any = { totalKeys: 0, activeKeysCount: 0, cooldownKeysCount: 0, cooldownKeys: [] }
    try {
      const { aiRotatorService } = await import('../../../services/aiRotator.service')
      geminiStats = aiRotatorService.getStats()
    } catch (e) {}

    // 3. Verificar Groq Key Manager
    let groqStats: any = { totalKeys: 0, activeKeysCount: 0, cooldownKeysCount: 0, cooldownKeys: [] }
    try {
      const { keyManager } = await import('../../../services/ai.service')
      groqStats = keyManager.getStats()
    } catch (e) {}

    // 4. Verificar WhatsApp Web Daemon Sessions
    let whatsappStats = { totalSessions: 0, sessions: [] as any[] }
    try {
      const { whatsappWebManager } = await import('../../../services/whatsappWeb.service')
      const list = whatsappWebManager.getAllSessionsStats()
      whatsappStats = {
        totalSessions: list.length,
        sessions: list
      }
    } catch (e) {}

    return {
      status: dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(), // Segundos de actividad del proceso de node
      db: {
        status: dbStatus,
        latencyMs: dbLatency,
        tableCounts
      },
      ai: {
        gemini: geminiStats,
        groq: groqStats
      },
      whatsapp: whatsappStats,
      totalExecutionTimeMs: Date.now() - startTime
    }
  }
}

export const settingsService = new SettingsService()
