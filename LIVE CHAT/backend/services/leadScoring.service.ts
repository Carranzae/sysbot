/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE SCORE DE CLIENTE (Lead Scoring)
 * ═══════════════════════════════════════════════════════════
 * Asigna un puntaje de 0 a 100 a cada cliente para priorizar
 * atención humana y campañas de remarketing personalizadas.
 * Nivel: 🔱 DIOS
 */

import { db } from '../database/db'
import { logger } from '../api/utils/logger'

export type LeadTier = 'HOT' | 'WARM' | 'COLD' | 'GHOST'

export interface LeadScore {
  score: number      // 0-100
  tier: LeadTier
  label: string
  reasons: string[]
  priority: number   // 1 = Atender AHORA, 5 = Bajo interés
}

class LeadScoringEngine {
  /**
   * Calcula el Lead Score de un cliente basándose en su comportamiento histórico.
   */
  async calculate(userId: string, customerPhone: string): Promise<LeadScore> {
    let score = 0
    const reasons: string[] = []

    try {
      // 1. ¿Ya compró antes? (+40 pts)
      const { rows: orders } = await db.query(
        `SELECT COUNT(*) as count, SUM(total) as total_spent 
         FROM orders WHERE user_id = $1 AND customer_phone LIKE $2 AND payment_status = 'confirmed'`,
        [userId, `%${customerPhone.slice(-9)}`]
      )
      const orderCount = parseInt(orders[0]?.count || '0', 10)
      const totalSpent = parseFloat(orders[0]?.total_spent || '0')
      
      if (orderCount > 0) {
        score += Math.min(40, orderCount * 15)
        reasons.push(`✅ ${orderCount} compra(s) previas (S/ ${totalSpent.toFixed(0)} gastados)`)
      }

      // 2. ¿Mensajes en las últimas 24h? (+20 pts de calor)
      const { rows: recentMsgs } = await db.query(
        `SELECT COUNT(*) as count FROM conversation_history 
         WHERE user_id = $1 AND customer_phone = $2 AND role = 'user' AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId, customerPhone]
      )
      const recentCount = parseInt(recentMsgs[0]?.count || '0', 10)
      if (recentCount > 0) {
        score += Math.min(20, recentCount * 3)
        reasons.push(`🔥 ${recentCount} mensaje(s) en las últimas 24h`)
      }

      // 3. ¿Tiene cosas en el carrito? (+25 pts)
      const { rows: cartState } = await db.query(
        `SELECT state FROM conversation_states WHERE user_id = $1 AND customer_phone = $2`,
        [userId, customerPhone]
      )
      const stateObj = cartState[0]?.state || {}
      const cartItems = stateObj.cartItems || []
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        score += 25
        reasons.push(`🛒 ${cartItems.length} producto(s) en carrito sin pagar`)
      }

      // 4. ¿Lleva más de 3 días sin comprar pero escribe frecuentemente? (+10 pts de loyaltad)
      const { rows: allMsgs } = await db.query(
        `SELECT COUNT(*) as count FROM conversation_history 
         WHERE user_id = $1 AND customer_phone = $2 AND role = 'user'`,
        [userId, customerPhone]
      )
      const totalMsgs = parseInt(allMsgs[0]?.count || '0', 10)
      if (totalMsgs > 10) {
        score += 10
        reasons.push(`💬 Cliente frecuente: ${totalMsgs} mensajes históricos`)
      }

      // 5. Normalizar a 100
      score = Math.min(100, score)

      // Clasificar
      let tier: LeadTier
      let label: string
      let priority: number

      if (score >= 70) {
        tier = 'HOT'
        label = '🔥 LEAD CALIENTE — Atención prioritaria'
        priority = 1
      } else if (score >= 40) {
        tier = 'WARM'
        label = '🌤️ LEAD TIBIO — Seguimiento activo'
        priority = 2
      } else if (score >= 10) {
        tier = 'COLD'
        label = '❄️ LEAD FRÍO — Remarketing automático'
        priority = 4
      } else {
        tier = 'GHOST'
        label = '👻 FANTASMA — Mínima interacción'
        priority = 5
      }

      return { score, tier, label, reasons, priority }
    } catch (e: any) {
      logger.error('[LEAD SCORING] Error calculando score:', e.message)
      return { score: 0, tier: 'COLD', label: '❓ Sin datos', reasons: [], priority: 5 }
    }
  }

  /**
   * Guarda el score en la DB para reportes del admin
   */
  async saveScore(userId: string, customerPhone: string, score: LeadScore) {
    try {
      await db.query(
        `INSERT INTO customer_lead_scores (user_id, customer_phone, score, tier, reasons, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, customer_phone) 
         DO UPDATE SET score = $3, tier = $4, reasons = $5, updated_at = NOW()`,
        [userId, customerPhone, score.score, score.tier, JSON.stringify(score.reasons)]
      ).catch(() => {}) // Si la tabla no existe, no es crítico
    } catch (e) { /* silent */ }
  }
}

export const leadScoringEngine = new LeadScoringEngine()
