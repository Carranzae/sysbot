import { db } from "../database/db"
import { whatsappWebManager } from "./whatsappWeb.service"
import { logger } from "../api/utils/logger"
import { notificationService } from "./notification.service"
import { io } from "../api/server"

export class CartRecoveryService {
  /**
   * Busca pedidos que se quedaron en "pending" por más de 2 horas y envía un recordatorio.
   */
  async checkAndRecover() {
    try {
      logger.info("[RECOVERY] Ejecutando escaneo de carritos abandonados...")
      
      const { rows: abandonedOrders } = await db.query(
        `SELECT o.id, o.customer_name, o.customer_phone, o.user_id, o.total, u.name as store_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.payment_status = 'pending' 
           AND o.created_at < NOW() - INTERVAL '2 hours'
           AND o.created_at > NOW() - INTERVAL '24 hours'
           AND (o.recovery_notified IS NULL OR o.recovery_notified = false)`,
      )

      for (const order of abandonedOrders) {
        const message = `¡Hola ${order.customer_name.split(' ')[0]}! 👋 Soy Atti, tu asistente personal en *${order.store_name}*. 
        
He notado que tu selección de productos por S/ ${order.total} se quedó esperando en el carrito. 🛒✨ 

Solo quería asegurarme de que no tuviste inconvenientes con el proceso. Si lo deseas, puedo ayudarte a finalizar tu pedido ahora mismo para que sea el primero en salir a despacho hoy mismo. 🚀

¿Tienes alguna duda o te ayudo con los métodos de pago? Estaré atento para servirte.`
 
         // Encolar notificación en el sistema de resiliencia industrial
        await notificationService.enqueue(order.user_id, order.customer_phone, message)
        
        // Marcar como notificado para no repetir
        await db.query(`UPDATE orders SET recovery_notified = true WHERE id = $1`, [order.id])
        logger.info(`[RECOVERY] Notificación encolada para ${order.customer_phone} (Pedido #${order.id})`)

        // ── ALERTA EN TIEMPO REAL AL PROVEEDOR ──────────────────────────
        // El proveedor ve en su dashboard que hay un carrito caliente sin pagar
        io.to(`user_${order.user_id}`).emit('cart_recovery_alert', {
          type: 'ABANDONED_CART',
          customerPhone: order.customer_phone,
          customerName: order.customer_name || 'Cliente',
          total: order.total,
          orderId: order.id,
          message: `🛒 Carrito abandonado detectado: *${order.customer_name || 'Cliente'}* tiene S/ ${order.total} sin pagar hace +2h. ¡Puedes intervenir desde el LiveChat!`,
          timestamp: new Date().toISOString(),
          urgency: 'HIGH'
        })
        logger.info(`[RECOVERY] Alerta Socket enviada al proveedor ${order.user_id} para ${order.customer_phone}`)
      }
    } catch (error: any) {
      logger.error("[RECOVERY] Error en el worker de recuperación:", { error: error.message })
    }
  }

  startWorker() {
    // Ejecutar cada hora
    setInterval(() => this.checkAndRecover(), 60 * 60 * 1000)
    // Primera ejecución a los 5 segundos de iniciar
    setTimeout(() => this.checkAndRecover(), 5000)
  }
}

export const cartRecoveryService = new CartRecoveryService()
