/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE INTELIGENCIA COMERCIAL EN TIEMPO REAL
 * "WHAT-IS-TRENDING" ENGINE
 * ═══════════════════════════════════════════════════════════
 * Detecta en tiempo real qué productos se están buscando más,
 * qué palabras usan los clientes, y genera alertas de demanda.
 * Permite al bot hacer up-selling basado en datos REALES.
 * Nivel: 🔱 DIOS
 */

import { db } from '../database/db'
import { logger } from '../api/utils/logger'

export interface TrendAlert {
  keyword: string
  searchCount: number
  trend: 'RISING' | 'PEAK' | 'STABLE'
  suggestion: string
}

class TrendingEngine {
  constructor() {
    this.ensureTable().catch(err => {
      logger.error('❌ [TRENDING] Error inicializando tabla search_trends:', err.message)
    })
  }

  /**
   * Registra una búsqueda o intención de cliente (background, no bloquea)
   */
  async trackSearch(userId: string, messageBody: string): Promise<void> {
    try {
      // Extrae palabras clave significativas (>4 chars)
      const words = messageBody
        .toLowerCase()
        .replace(/[^a-záéíóúñ\s]/gi, '')
        .split(/\s+/)
        .filter(w => w.length > 4)

      for (const word of words) {
        await db.query(
          `INSERT INTO search_trends (user_id, keyword, count, last_searched)
           VALUES ($1, $2, 1, NOW())
           ON CONFLICT (user_id, keyword)
           DO UPDATE SET count = search_trends.count + 1, last_searched = NOW()`,
          [userId, word]
        ).catch(() => {}) // Si la tabla no existe, ignorar
      }
    } catch (e) { /* silent */ }
  }

  /**
   * Obtiene los top 5 productos más buscados en las últimas 24h
   */
  async getHotKeywords(userId: string): Promise<TrendAlert[]> {
    try {
      const { rows } = await db.query(
        `SELECT keyword, count, last_searched FROM search_trends
         WHERE user_id = $1 AND last_searched > NOW() - INTERVAL '24 hours'
         ORDER BY count DESC LIMIT 5`,
        [userId]
      )

      return rows.map(r => ({
        keyword: r.keyword,
        searchCount: r.count,
        trend: r.count > 10 ? 'PEAK' : r.count > 5 ? 'RISING' : 'STABLE',
        suggestion: `El término "${r.keyword}" fue buscado ${r.count} veces hoy. Considera destacar los productos relacionados.`
      }))
    } catch (e) {
      return []
    }
  }

  /**
   * Genera un contexto de tendencias para inyectar en el prompt de la IA
   * Permite que el bot haga up-selling basado en lo que MÁS se busca
   */
  async getTrendingContext(userId: string, messageBody: string): Promise<string> {
    // Registrar la búsqueda en background
    this.trackSearch(userId, messageBody).catch(() => {})

    const hotKeywords = await this.getHotKeywords(userId)
    if (hotKeywords.length === 0) return ''

    const peakItems = hotKeywords.filter(k => k.trend === 'PEAK')
    if (peakItems.length === 0) return ''

    return `\n📈 TENDENCIAS CALIENTES HOY (últimas 24h):\n${peakItems
      .map(k => `• "${k.keyword}" — buscado ${k.searchCount} veces`)
      .join('\n')}\n→ Si es relevante al mensaje del cliente, menciona los productos relacionados con estas palabras como si fueran "muy populares hoy".`
  }

  /**
   * Inicializa la tabla de tendencias si no existe
   */
  async ensureTable(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS search_trends (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          keyword TEXT NOT NULL,
          count INT DEFAULT 1,
          last_searched TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, keyword)
        )
      `)
    } catch (e: any) {
      logger.warn('[TRENDING] No se pudo crear tabla search_trends:', e.message)
    }
  }
}

export const trendingEngine = new TrendingEngine()
