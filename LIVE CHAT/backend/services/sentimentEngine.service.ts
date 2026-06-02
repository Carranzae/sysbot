/**
 * MOTOR 8 — Sentiment Engine + Escalamiento
 * Detecta el estado emocional del cliente y acciona en consecuencia.
 * No requiere IA — usa análisis léxico de alta velocidad.
 */

import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { io } from '../api/server'

export type SentimentType = 'FURIOUS' | 'FRUSTRATED' | 'NEUTRAL' | 'HAPPY' | 'VERY_HAPPY'

interface SentimentResult {
  sentiment: SentimentType
  score: number // -2 a +2
  shouldEscalate: boolean
  responseModifier: string // Instrucción adicional para el prompt de IA
}

const SENTIMENT_RULES = {
  furious: {
    keywords: ['estafa', 'fraude', 'ladrón', 'ladrones', 'denuncia', 'denunciar', 'indecopi', 'devuélveme', 'robo', 'pésimo', 'porquería'],
    score: -2,
  },
  frustrated: {
    keywords: ['molesto', 'molesta', 'enojado', 'horrible', 'terrible', 'mal', 'malo', 'nunca llegó', 'no llegó', 'esperando', 'dónde está', 'mentira', 'engaño', 'mentirosos', 'tardaron', 'no funciona'],
    score: -1,
  },
  happy: {
    keywords: ['gracias', 'excelente', 'perfecto', 'genial', 'buenísimo', 'encanta', 'me gustó', 'feliz', 'contento', 'satisfecho', 'rápido', 'recomiendo'],
    score: 1,
  },
  very_happy: {
    keywords: ['increíble', 'espectacular', 'lo mejor', 'top', '10/10', 'fantástico', 'maravilloso', 'siempre compro aquí', 'fiel cliente'],
    score: 2,
  },
}

class SentimentEngineService {
  analyze(message: string): SentimentResult {
    const lower = message.toLowerCase()
    let totalScore = 0
    let matched = false

    for (const kw of SENTIMENT_RULES.furious.keywords) {
      if (lower.includes(kw)) { totalScore += SENTIMENT_RULES.furious.score; matched = true }
    }
    for (const kw of SENTIMENT_RULES.frustrated.keywords) {
      if (lower.includes(kw)) { totalScore += SENTIMENT_RULES.frustrated.score; matched = true }
    }
    for (const kw of SENTIMENT_RULES.happy.keywords) {
      if (lower.includes(kw)) { totalScore += SENTIMENT_RULES.happy.score; matched = true }
    }
    for (const kw of SENTIMENT_RULES.very_happy.keywords) {
      if (lower.includes(kw)) { totalScore += SENTIMENT_RULES.very_happy.score; matched = true }
    }

    const clampedScore = Math.max(-2, Math.min(2, totalScore))

    let sentiment: SentimentType = 'NEUTRAL'
    let shouldEscalate = false
    let responseModifier = ''

    if (clampedScore <= -2) {
      sentiment = 'FURIOUS'
      shouldEscalate = true
      responseModifier = `
⚠️ ALERTA DE SENTIMIENTO: El cliente está MUY MOLESTO. 
- Comienza SIEMPRE con una disculpa sincera y empática.
- NO intentes vender nada ahora.
- Di que un agente humano lo contactará pronto.
- Sé extremadamente calmado y profesional.
- Ejemplo: "Entiendo perfectamente tu molestia y lamentamos mucho lo ocurrido. Voy a escalar tu caso de inmediato para que un especialista te contacte en los próximos minutos. 🙏"`
    } else if (clampedScore === -1) {
      sentiment = 'FRUSTRATED'
      shouldEscalate = false
      responseModifier = `
⚠️ SENTIMIENTO: El cliente está algo frustrado. 
- Empieza con empatía: "Entiendo tu preocupación".
- Ofrece solución concreta y rápida.
- No uses emojis excesivos.`
    } else if (clampedScore === 1) {
      sentiment = 'HAPPY'
      shouldEscalate = false
      responseModifier = `
✅ SENTIMIENTO: El cliente está contento. 
- Aprovecha para hacer upselling o sugerir otro producto.
- Invita a dejar una reseña o compartir con amigos.`
    } else if (clampedScore >= 2) {
      sentiment = 'VERY_HAPPY'
      shouldEscalate = false
      responseModifier = `
🌟 SENTIMIENTO: El cliente está muy satisfecho. 
- Agradece con entusiasmo.
- Sugiere un producto premium o complementario.
- Invita al programa de referidos si existe.`
    }

    return { sentiment, score: clampedScore, shouldEscalate, responseModifier }
  }

  async notifyEscalation(userId: string, customerPhone: string, message: string, sentiment: SentimentType): Promise<void> {
    try {
      // Emitir alerta en tiempo real al dashboard del proveedor
      io.to(`user_${userId}`).emit('sentiment_alert', {
        type: 'ESCALATION',
        sentiment,
        customerPhone,
        message: message.slice(0, 200),
        timestamp: new Date().toISOString(),
        urgency: sentiment === 'FURIOUS' ? 'HIGH' : 'MEDIUM',
      })

      // Registrar en la base de datos para análisis posterior
      await db.query(
        `INSERT INTO sentiment_alerts (user_id, customer_phone, sentiment, message_preview, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [userId, customerPhone, sentiment, message.slice(0, 200)]
      ).catch(() => {
        // Si la tabla no existe, no es crítico
        logger.warn('[SENTIMENT] Tabla sentiment_alerts no encontrada, omitiendo registro.')
      })

      // NOTIFICACIÓN WHATSAPP AL DUEÑO
      const { rows: providerRows } = await db.query('SELECT phone FROM users WHERE id = $1', [userId])
      const ownerPhone = providerRows[0]?.phone
      if (ownerPhone && (sentiment === 'FURIOUS' || sentiment === 'FRUSTRATED')) {
        const { whatsappWebManager } = await import('./whatsappWeb.service')
        const alertMsg = `🚨 *ALERTA DE CLIENTE CRÍTICO* 🚨\n\n👤 *Cliente:* ${customerPhone}\n🎭 *Sentimiento:* ${sentiment}\n💬 *Mensaje:* "${message.slice(0, 100)}..."\n\n⚠️ Por favor, revisa el chat de inmediato para evitar una mala experiencia.`
        await whatsappWebManager.sendMessage(userId, ownerPhone, alertMsg).catch(() => {})
      }

      logger.warn(`[SENTIMENT] Escalamiento: ${sentiment} de ${customerPhone} para usuario ${userId}`)
    } catch (err: any) {
      logger.error('[SENTIMENT] Error en notificación de escalamiento:', { error: err?.message })
    }
  }
}

export const sentimentEngine = new SentimentEngineService()
