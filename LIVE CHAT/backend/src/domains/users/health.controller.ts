import { Request, Response } from 'express'
import { db } from '../../../database/db'
import { encryption } from '../../../api/utils/encryption'
import { logger } from '../../../api/utils/logger'

export class HealthController {
  /**
   * Verifica la validez de todas las credenciales de un proveedor
   */
  async checkProviderHealth(req: Request, res: Response) {
    const user = (req as any).user
    const results = {
      payments: { status: 'unknown', message: '' },
      whatsapp: { status: 'unknown', message: '' },
      logistics: { status: 'unknown', message: '' }
    }

    try {
      const { rows } = await db.query('SELECT payment_config, logistics_config, agency_credentials FROM users WHERE id = $1', [user.id])
      const config = rows[0]
      if (!config) throw new Error('Usuario no encontrado')

      // 1. Verificar Mercado Pago (si está configurado)
      if (config.payment_config?.access_token) {
        try {
          const token = this.resolveKey(config.payment_config.access_token)
          const mpResp = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            headers: { Authorization: `Bearer ${token}` }
          })
          results.payments = mpResp.ok 
            ? { status: 'healthy', message: 'Conexión con Mercado Pago exitosa' }
            : { status: 'error', message: 'Token de Mercado Pago inválido o expirado' }
        } catch {
          results.payments = { status: 'error', message: 'Fallo al contactar con Mercado Pago' }
        }
      }

      // 2. Verificar WhatsApp Cloud API
      if (config.payment_config?.whatsapp?.access_token) {
        try {
          const waToken = this.resolveKey(config.payment_config.whatsapp.access_token)
          const phoneId = config.payment_config.whatsapp.phone_number_id
          const waResp = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
            headers: { Authorization: `Bearer ${waToken}` }
          })
          results.whatsapp = waResp.ok
            ? { status: 'healthy', message: 'WhatsApp Cloud API conectada' }
            : { status: 'error', message: 'Configuración de WhatsApp incorrecta' }
        } catch {
          results.whatsapp = { status: 'error', message: 'Error de red con Meta API' }
        }
      }

      // 3. Verificar Logística (Olva/Shalom)
      if (config.agency_credentials) {
        // Meticulosidad: Solo verificamos si existen las claves necesarias
        const hasOlva = !!config.agency_credentials.olva?.clientId
        const hasShalom = !!config.agency_credentials.shalom?.apiKey
        results.logistics = (hasOlva || hasShalom)
          ? { status: 'healthy', message: 'Credenciales de logística detectadas' }
          : { status: 'warning', message: 'No hay agencias configuradas' }
      }

      res.json({ success: true, health: results })
    } catch (error: any) {
      logger.error('[Health] Error en HealthCheck:', error)
      res.status(500).json({ error: error.message })
    }
  }

  private resolveKey(key: string): string {
    if (key.includes(':')) return encryption.decrypt(key)
    return key
  }
}

export const healthController = new HealthController()
