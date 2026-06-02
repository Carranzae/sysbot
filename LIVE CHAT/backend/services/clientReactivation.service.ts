/**
 * MOTOR 5 — Client Reactivation Engine
 * Worker que busca clientes inactivos y les envía mensajes personalizados
 * para recuperar la relación y generar ventas recurrentes.
 * Se ejecuta cada 24 horas automáticamente.
 */

import { db } from '../database/db'
import { logger } from '../api/utils/logger'

// Umbral: clientes que compraron hace más de 7 días y no han vuelto
const REACTIVATION_DAYS = 7
// Máximo de clientes a reactivar por ejecución (para no saturar)
const MAX_BATCH = 20

class ClientReactivationService {
  async runReactivationScan(sendMessageFn: (userId: string, phone: string, msg: string) => Promise<void>): Promise<void> {
    logger.info('[REACTIVATION] Iniciando escaneo de clientes inactivos...')

    try {
      // Buscar clientes que compraron hace 7-30 días y no han vuelto a comprar
      const { rows: inactiveClients } = await db.query(`
        SELECT DISTINCT
          o.user_id,
          o.customer_phone,
          o.customer_name,
          MAX(o.created_at) as last_order_date,
          COUNT(o.id) as total_orders,
          SUM(o.total) as total_spent
        FROM orders o
        WHERE 
          o.status IN ('delivered', 'completed', 'pagado')
          AND o.created_at < NOW() - INTERVAL '${REACTIVATION_DAYS} days'
          AND o.created_at > NOW() - INTERVAL '30 days'
          AND o.customer_phone IS NOT NULL
          AND o.customer_phone != ''
          AND NOT EXISTS (
            SELECT 1 FROM orders o2 
            WHERE o2.user_id = o.user_id 
              AND o2.customer_phone = o.customer_phone
              AND o2.created_at > NOW() - INTERVAL '${REACTIVATION_DAYS} days'
          )
        GROUP BY o.user_id, o.customer_phone, o.customer_name
        ORDER BY last_order_date DESC
        LIMIT ${MAX_BATCH}
      `)

      if (inactiveClients.length === 0) {
        logger.info('[REACTIVATION] Sin clientes inactivos para reactivar hoy.')
        return
      }

      logger.info(`[REACTIVATION] Encontrados ${inactiveClients.length} clientes a reactivar.`)

      for (const client of inactiveClients) {
        try {
          // Obtener el producto más popular del proveedor para personalizar el mensaje
          const { rows: topProducts } = await db.query(
            `SELECT name, price FROM products WHERE user_id = $1 AND stock > 0 ORDER BY created_at DESC LIMIT 1`,
            [client.user_id]
          )

          const productPromo = topProducts[0]
          const firstName = client.customer_name?.split(' ')[0] || 'amigo/a'
          const ltv = parseFloat(client.total_spent) || 0
          const totalOrders = parseInt(client.total_orders) || 0

          let message: string

          // ════════════════════════════════════════
          // SEGMENTACIÓN POR LTV (Lifetime Value)
          // ════════════════════════════════════════
          if (ltv >= 500 || totalOrders >= 3) {
            // 🌟 CLIENTE VIP — Tratamiento premium personalizado
            const { rows: providerRows } = await db.query('SELECT name FROM users WHERE id = $1', [client.user_id])
            const providerName = providerRows[0]?.name?.split(' ')[0] || 'nosotros'
            message = `✨ ¡Hola ${firstName}! Soy *Atti*, de parte de *${providerName}* 🌟\n\n` +
              `Como uno de nuestros clientes VIP (con ${totalOrders} compras y S/ ${ltv.toFixed(0)} invertidos con nosotros), ` +
              `hemos reservado algo especial para ti esta semana 👑\n\n` +
              (productPromo
                ? `🔥 *${productPromo.name}* — Precio especial VIP: *S/ ${(parseFloat(productPromo.price) * 0.9).toFixed(2)}* _(10% menos, solo para ti)_\n\n`
                : ``) +
              `Responde este mensaje y te aplico el precio VIP de inmediato. ¡Tu lealtad tiene recompensa! 💙`
          } else if (ltv >= 100) {
            // 🟡 CLIENTE MEDIO — Oferta estándar con producto destacado
            message = `¡Hola ${firstName}! 👋 Hace un tiempo nos visitaste y tenemos novedades que te van a encantar 🌟\n\n` +
              (productPromo
                ? `✨ *${productPromo.name}* — Solo *S/ ${productPromo.price}*\n\n`
                : ``) +
              `¿Te interesa saber más? Solo responde este mensaje y Atti te ayuda al toque 😊\n\n` +
              `_(Tus compras anteriores te dan prioridad de atención)_ 💙`
          } else {
            // 🆕 CLIENTE NUEVO — Bienvenida al catálogo con incentivo de reenganche
            message = `¡Hola ${firstName}! 👋 Nos alegra verte de nuevo 😊\n\n` +
              `Tenemos novedades increíbles esta semana y queremos que seas de los primeros en verlas 🚀\n\n` +
              `Responde *"catálogo"* y te mando el PDF completo con precios. ¡Atti al servicio! 🤖`
          }

          await sendMessageFn(client.user_id, client.customer_phone, message)
          logger.info(`[REACTIVATION] Mensaje enviado a ${client.customer_phone}`)

          // Pequeña pausa entre mensajes para no saturar WhatsApp
          await new Promise(resolve => setTimeout(resolve, 3000))

        } catch (clientError: any) {
          logger.error(`[REACTIVATION] Error enviando a ${client.customer_phone}:`, { error: clientError?.message })
        }
      }

      logger.info(`[REACTIVATION] ✅ Ciclo de reactivación completado. ${inactiveClients.length} clientes contactados.`)

    } catch (error: any) {
      logger.error('[REACTIVATION] Error en el escaneo:', { error: error?.message })
    }
  }

  /**
   * Inicia el worker de reactivación con un intervalo de 24 horas.
   */
  startWorker(sendMessageFn: (userId: string, phone: string, msg: string) => Promise<void>): void {
    logger.info('[REACTIVATION] Worker de reactivación iniciado (cada 24h)')
    
    // Primera ejecución después de 5 minutos del arranque (no al instante)
    const INITIAL_DELAY = 5 * 60 * 1000
    const INTERVAL = 24 * 60 * 60 * 1000 // 24 horas

    setTimeout(() => {
      this.runReactivationScan(sendMessageFn)
      setInterval(() => this.runReactivationScan(sendMessageFn), INTERVAL)
    }, INITIAL_DELAY)
  }
}

export const clientReactivationService = new ClientReactivationService()
