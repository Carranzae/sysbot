import axios from 'axios'
import { db } from '../database/db'
import { logger } from '../api/utils/logger'

/**
 * Servicio para disparar alarmas físicas en móviles Android/iOS vía IFTTT.
 * Requiere configurar un Applet en ifttt.com con Webhooks como Trigger.
 */
export class IFTTTService {
  private readonly baseUrl = 'https://maker.ifttt.com/trigger'
  
  async triggerAlarm(userId: string, orderData: { customerName: string; total: number }, message: string = '¡Venta Exitosa en Atines!') {
    try {
      // 1. Intentar obtener clave específica del usuario desde la DB
      const { rows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [userId])
      const userConfig = rows[0]?.payment_config || {}
      
      let key = userConfig.ifttt_key || process.env.IFTTT_WEBHOOK_KEY
      
      // Desencriptar si es necesario
      const { encryption } = await import('../api/utils/encryption')
      if (key && key.includes(':')) {
        key = encryption.decrypt(key)
      }
      
      if (!key) {
        logger.warn(`[IFTTT] No hay clave configurada para el usuario ${userId}`)
        return
      }

      const eventName = userConfig.ifttt_event_name || process.env.IFTTT_EVENT_NAME || 'atines_new_sale'
      const url = `${this.baseUrl}/${eventName}/with/key/${key}`
      
      await axios.post(url, {
        value1: orderData.customerName,
        value2: orderData.total.toString(),
        value3: message
      })

      logger.info(`[IFTTT] Alarma móvil disparada para ${orderData.customerName} (User: ${userId})`)
    } catch (error: any) {
      logger.error('[IFTTT] Error disparando alarma móvil:', { error: error.message })
    }
  }
}

export const iftttService = new IFTTTService()
