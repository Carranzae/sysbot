import { db } from "../database/db"
import { logger } from "../api/utils/logger"
import { scanGmailPayments } from "./paymentEmailVerifier.service"
import { encryption } from "../api/utils/encryption"

class PaymentCronService {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  /**
   * Inicia el proceso de Auto-Match de pagos en segundo plano.
   * Por defecto, se ejecuta cada 2 minutos (120,000 ms).
   */
  start(intervalMs = 120000) {
    if (this.intervalId) return

    logger.info(`[PAYMENT-CRON] Iniciando servicio de auto-match de pagos cada ${intervalMs / 1000}s...`)
    
    this.intervalId = setInterval(async () => {
      await this.runAutoMatch()
    }, intervalMs)

    // Ejecutar la primera vez inmediatamente
    this.runAutoMatch()
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info(`[PAYMENT-CRON] Servicio de auto-match detenido.`)
    }
  }

  /**
   * Busca todos los proveedores que tienen Gmail configurado y tienen pedidos pendientes,
   * y ejecuta un escaneo silencioso en sus bandejas de entrada para auto-aprobar pagos.
   */
  async runAutoMatch() {
    if (this.isRunning) return
    this.isRunning = true

    try {
      // Obtener todos los proveedores que tienen configuración de Gmail y al menos un pedido pendiente en las últimas 72 horas
      const { rows: providers } = await db.query(`
        SELECT DISTINCT u.id, u.payment_config
        FROM users u
        JOIN orders o ON o.user_id = u.id
        WHERE o.payment_status = 'pending' 
          AND o.created_at >= NOW() - INTERVAL '3 days'
          AND u.payment_config->'gmail'->>'refreshToken' IS NOT NULL
      `)

      if (providers.length === 0) {
        this.isRunning = false
        return
      }

      for (const provider of providers) {
        const gmailCfg = provider.payment_config.gmail
        if (!gmailCfg || !gmailCfg.refreshToken) continue

        try {
          const decryptedToken = encryption.decrypt(gmailCfg.refreshToken)
          
          // Ejecutamos el scan sin 'query' específica para que procese todos los no leídos
          // El 'scanGmailPayments' ya está diseñado para auto-matchear por monto y teléfono si no hay ID.
          const scanResult = await scanGmailPayments({
            providerId: provider.id,
            refreshToken: decryptedToken,
            // 'query' por defecto es 'is:unread' que es perfecto para el cron
          })

          if (scanResult.paid > 0) {
            logger.info(`[PAYMENT-CRON] 💰 ¡Auto-Match Exitoso! ${scanResult.paid} pedido(s) aprobado(s) automáticamente para el proveedor ${provider.id}.`)
            
            // Nota: scanGmailPayments ya envía un correo electrónico al cliente.
            // Opcionalmente, aquí podríamos disparar un WhatsApp al cliente, pero el cliente ya es notificado
            // por correo, y el estado de su pedido se actualiza en la app.
            
            // Para informar al almacén del dueño:
            const { rows: pData } = await db.query('SELECT phone, almacen_phone FROM users WHERE id = $1', [provider.id])
            if (pData.length > 0) {
               const { whatsappWebManager } = await import("./whatsappWeb.service")
               const p = pData[0]
               if (p.almacen_phone) {
                 whatsappWebManager.sendMessage(provider.id, p.almacen_phone, `🤖 *AUTO-MATCH ACTIVO*\nSe han aprobado ${scanResult.paid} pagos automáticamente en segundo plano. Revisar el panel de pedidos.`).catch(() => {})
               }
            }
          }
        } catch (error: any) {
          logger.error(`[PAYMENT-CRON] Error escaneando Gmail para proveedor ${provider.id}:`, error.message)
        }
      }

    } catch (err: any) {
      logger.error('[PAYMENT-CRON] Error general en el loop de Auto-Match:', err.message)
    } finally {
      this.isRunning = false
    }
  }
}

export const paymentCronService = new PaymentCronService()
