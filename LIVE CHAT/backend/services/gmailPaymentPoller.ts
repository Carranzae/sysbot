import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { scanGmailPayments } from './paymentEmailVerifier.service'
import { encryption } from '../api/utils/encryption'

export function startGmailPaymentPoller() {
  const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutos por defecto
  let isPolling = false

  const pollAllProviders = async () => {
    if (isPolling) return
    isPolling = true
    
    try {
      // 1. Obtener todos los proveedores que tienen configurado Gmail
      const { rows: providers } = await db.query(`
        SELECT id, name, payment_config 
        FROM users 
        WHERE (payment_config->'gmail'->>'refreshToken') IS NOT NULL
      `)

      logger.info(`[POLLER] Iniciando ronda de escaneo para ${providers.length} proveedores.`)

      for (const provider of providers) {
        try {
          const gmailCfg = provider.payment_config.gmail
          if (gmailCfg.enabled === false) continue

          const refreshToken = encryption.decrypt(gmailCfg.refreshToken)
          
          await scanGmailPayments({
            refreshToken,
            providerId: provider.id,
            userId: 'me',
            labelName: gmailCfg.processedLabel || 'ATINES_PROCESSED'
          })

          logger.info(`[POLLER] Escaneo completado para ${provider.name}`)
        } catch (err: any) {
          logger.error(`[POLLER] Error escaneando Gmail para ${provider.name}:`, err.message)
        }
      }
    } catch (error: any) {
      logger.error('[POLLER] Error crítico en el ciclo de escaneo:', error.message)
    } finally {
      isPolling = false
    }
  }

  // Ejecutar primera vez
  pollAllProviders()

  // Programar intervalo
  setInterval(pollAllProviders, POLL_INTERVAL)
}
