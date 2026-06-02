import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'
import { encryption } from '../../../api/utils/encryption'
import { whatsappWebManager } from '../../../services/whatsappWeb.service'

export class WebhookService {
  async handleMercadoPago(providerId: string, action: string, data: any) {
    logger.info(`Webhook MP recibido para proveedor ${providerId}: ${action}`)

    if (action === 'payment.created' || action === 'payment.updated') {
      try {
        const paymentId = data.id
        
        // 1. Obtener credenciales del proveedor (Schema actualizado)
        const { rows: users } = await db.query('SELECT payment_config FROM users WHERE id = $1', [providerId])
        if (!users.length) return

        const config = users[0].payment_config || {}
        let accessToken = config.access_token || ''
        if (accessToken.includes(':')) {
           accessToken = encryption.decrypt(accessToken)
        }
        if (!accessToken) return

        // 2. REVERSE LOOKUP (Blindaje contra Webhook Spoofing)
        // Consultamos la API oficial para verificar que el pago es real
        const mpReq = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
           headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!mpReq.ok) {
           logger.error(`❌ Webhook Spoofing bloqueado o token inválido para proveedor ${providerId}`)
           return
        }
        
        const mpResponse: any = await mpReq.json()

        if (mpResponse.status === 'approved' && mpResponse.external_reference) {
          // 3. Delegar actualización al OrderService para mantener consistencia
          const { orderService } = await import('../orders/service')
          
          // Buscar pedido por referencia
          const { rows: orders } = await db.query('SELECT id, user_id FROM orders WHERE payment_reference_code = $1', [mpResponse.external_reference])
          if (orders.length > 0) {
            await orderService.updateOrder(orders[0].id, {
              status: 'preparando',
              payment_status: 'paid',
              payment_security_code: `MP-${paymentId}`
            }, orders[0].user_id, true)
            
            logger.info(`✅ Pedido ${mpResponse.external_reference} pagado vía MercadoPago.`)
          }
        }
      } catch (err: any) {
        logger.error('Error procesando webhook MP:', err as any)
      }
    }
  }

  async handleIzipay(providerId: string, payload: any) {
    logger.info(`Webhook Izipay recibido para proveedor ${providerId}`)
    return true
  }
}

export const webhookService = new WebhookService()
