import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { aiService } from './ai.service'
import { notificationService } from './notification.service'

class FollowUpService {
  /**
   * Escanea carritos abandonados en flujo conversacional (más de 30 minutos de inactividad)
   */
  async processAbandonedCarts() {
    try {
      logger.info('🚀 [REMARKETING] Iniciando escaneo dinámico de carritos abandonados (30 min)...')
      
      // Buscar carritos en conversation_states con inactividad entre 30 min y 2 horas,
      // con productos agregados, y que no hayan completado el checkout ni recibido remarketing.
      const { rows: sessions } = await db.query(`
        SELECT s.user_id, s.customer_phone, s.state, m.summary
        FROM conversation_states s
        LEFT JOIN customer_memory m ON s.customer_phone = m.customer_phone AND s.user_id::text = m.user_id::text
        WHERE s.updated_at < NOW() - INTERVAL '30 minutes'
          AND s.updated_at > NOW() - INTERVAL '2 hours'
      `)

      const { conversationStateService } = await import('./conversationState.service')

      for (const session of sessions) {
        const stateObj = typeof session.state === 'string' ? JSON.parse(session.state) : (session.state || {})
        const cart = stateObj.cartItems || []
        
        // Solo recuperar si tienen productos en el carrito, no han terminado y no se les ha enviado remarketing
        if (cart.length === 0) continue
        if (stateObj.stage === 'COMPLETED' || stateObj.remarketingSent) continue

        const { rows: provider } = await db.query('SELECT name FROM users WHERE id = $1', [session.user_id])
        const providerName = provider[0]?.name || 'Tienda'

        const cartSummary = cart.map((i: any) => `${i.name} (Cant: ${i.qty})`).join(', ')
        
        // Generar mensaje de seguimiento persuasivo con IA Atti (Gemini Rotator)
        const followUpPrompt = `
          Eres *Atti*, la IA vendedora estrella de la tienda de "${providerName}".
          El cliente, cuyo perfil es "${session.summary || 'Interesado en comprar'}", ha dejado abandonado su carrito de compras en WhatsApp con estos productos: ${cartSummary}.
          Su última actividad en el chat fue hace 30 minutos.
          Redacta un mensaje de WhatsApp corto, súper amable, empático y persuasivo para saludarlo, recordarle su carrito y ofrecerle un incentivo sutil y exclusivo (como envío gratis local, o un pequeño bono/descuento de S/10 o S/15 sin salirte de los márgenes) para animarlo a cerrar la compra.
          Reglas del mensaje:
          - Escribe en primera persona de manera natural como Atti.
          - Sé muy amigable, no uses frases corporativas aburridas o frías. Usa emojis.
          - Que sea de máximo 2 a 3 oraciones cortas.
          Devuelve ÚNICAMENTE el texto final del mensaje para enviar directamente al cliente.
        `

        const result = await aiService.chat(followUpPrompt)
        const msg = result.text.trim()

        // Encolar notificación en el sistema de resiliencia industrial
        await notificationService.enqueue(session.user_id, session.customer_phone, msg)
        logger.info(`✨ [REMARKETING] Notificación encolada para ${session.customer_phone} (${providerName})`)
        
        // Marcar como remarketing enviado en el estado para evitar spams
        await conversationStateService.set(session.user_id, session.customer_phone, {
          remarketingSent: true
        } as any)
      }
    } catch (error: any) {
      logger.error('❌ [REMARKETING] Error en Remarketing Service:', error.message)
    }
  }

  startWorker() {
    // Escaneo continuo cada 15 minutos
    setInterval(() => this.processAbandonedCarts(), 15 * 60 * 1000)
    // Primera ejecución a los 30 segundos
    setTimeout(() => this.processAbandonedCarts(), 30000)
  }
}

export const followUpService = new FollowUpService()
