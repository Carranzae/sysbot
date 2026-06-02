import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { aiService } from './ai.service'
import { whatsappWebManager } from './whatsappWeb.service'

export class RecoveryService {
  /**
   * Escanea carritos que no han tenido actividad en más de 30 minutos
   * y que pertenecen a usuarios con teléfono registrado.
   */
  async runAbandonedCartRecovery() {
    try {
      logger.info('Iniciando escaneo de carritos abandonados...')
      
      // Obtener carritos con más de 30 mins sin actividad, de usuarios con teléfono
      // y que no hayan sido notificados hoy.
      const query = `
        SELECT 
          c.user_id as customer_id, 
          u.name as customer_name, 
          u.phone as customer_phone, 
          prov.id as provider_id,
          ARRAY_AGG(p.name) as product_names, 
          SUM(p.price * c.quantity) as total,
          MAX(p.catalog_type) as catalog_type
        FROM carts c
        JOIN users u ON c.user_id = u.id
        JOIN products p ON c.product_id = p.id
        JOIN users prov ON p.user_id = prov.id
        WHERE c.updated_at < NOW() - INTERVAL '30 minutes'
        AND c.updated_at > NOW() - INTERVAL '24 hours'
        AND u.phone IS NOT NULL
        AND prov.is_active = true
        GROUP BY c.user_id, u.name, u.phone, prov.id
      `
      
      const { rows: abandonedCarts } = await db.query(query)

      for (const cart of abandonedCarts) {
        await this.sendRecoveryMessage(cart)
      }
    } catch (error: any) {
      logger.error('Error en runAbandonedCartRecovery:', { error: error.message })
    }
  }

  private async sendRecoveryMessage(cart: any) {
    try {
      const isGlobal = cart.catalog_type === 'global'
      const systemPrompt = `Eres Atines, la Concierge de Elite. 
      Un cliente llamado ${cart.customer_name} dejó estos productos en su carrito: ${cart.product_names.join(', ')}. 
      El total es S/ ${Number(cart.total).toFixed(2)}.
      ${isGlobal ? '⚠️ IMPORTANTE: Los productos son de IMPORTACIÓN GLOBAL (10-20 días).' : ''}
      Tu objetivo es enviarle un mensaje por WhatsApp persuasivo, elegante y amable para que regrese a completar su compra.
      Ofrécele ayuda si tuvo problemas con el pago.
      Usa emojis y mantén el tono de Concierge.`

      const aiRes = await aiService.chat(systemPrompt, [])
      const message = aiRes.text

      if (message && cart.customer_phone && cart.provider_id) {
        // Enviar vía el bot del proveedor que tiene los productos
        await whatsappWebManager.sendMessage(cart.provider_id, cart.customer_phone, message)
        logger.info(`Mensaje de recuperación enviado a ${cart.customer_phone} desde bot ${cart.provider_id}`)
        
        // Marcar como notificado
        await db.query('UPDATE carts SET updated_at = NOW() WHERE user_id = $1', [cart.customer_id])
      }
    } catch (error: any) {
      logger.error('Error enviando mensaje de recuperación:', { error: error.message })
    }
  }
}

export const recoveryService = new RecoveryService()
