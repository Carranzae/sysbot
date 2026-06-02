import { db } from "../database/db"
import { logger } from "../api/utils/logger"
import fs from 'fs'
import path from 'path'

export class HistoryMaintenanceService {
  /**
   * Limpia archivos de audio temporales en uploads/temp mayores a 24 horas.
   */
  async purgeTempFiles() {
    try {
      const tempDir = path.join(process.cwd(), 'uploads', 'temp')
      if (!fs.existsSync(tempDir)) return

      const files = fs.readdirSync(tempDir)
      const now = Date.now()
      const maxAgeMs = 24 * 60 * 60 * 1000 // 24 horas

      let deletedCount = 0
      for (const file of files) {
        const filePath = path.join(tempDir, file)
        const stats = fs.statSync(filePath)
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath)
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        logger.info(`[MAINTENANCE] Se eliminaron ${deletedCount} archivos de audio temporales obsoletos en uploads/temp.`)
      }
    } catch (error: any) {
      logger.error("[MAINTENANCE] Error limpiando archivos temporales:", { error: error.message })
    }
  }

  /**
   * Limpia el historial de conversaciones antiguo para mantener la DB ligera y analítica.
   */
  async purgeOldHistory() {
    try {
      logger.info("[MAINTENANCE] Iniciando limpieza dinámica de memoria de chat...")
      
      // 1. Limpieza de archivos físicos obsoletos
      await this.purgeTempFiles()

      // 2. Obtener la configuración global de retención desde la Base de Datos
      const { rows } = await db.query("SELECT value FROM site_settings WHERE id = 'global_settings'")
      const settings = rows[0]?.value || {}
      const memoryConfig = settings.memoryConfig || { value: 10, unit: 'days' }

      const unit = ['days', 'hours', 'minutes'].includes(memoryConfig.unit) ? memoryConfig.unit : 'days'
      const val = typeof memoryConfig.value === 'number' ? memoryConfig.value : 10
      const intervalStr = `${val} ${unit}`

      // 3. Limpieza de historial IA (conversation_history)
      const { rowCount: iaRowCount } = await db.query(
        `DELETE FROM conversation_history WHERE created_at < NOW() - $1::INTERVAL`,
        [intervalStr]
      )
      
      // 4. Limpieza de mensajes UI de LiveChat (whatsapp_messages)
      const { rowCount: uiRowCount } = await db.query(
        `DELETE FROM whatsapp_messages WHERE sent_at < NOW() - $1::INTERVAL`,
        [intervalStr]
      )

      // 5. Limpieza de memoria semántica de clientes (customer_memory)
      const { rowCount: memRowCount } = await db.query(
        `DELETE FROM customer_memory WHERE last_updated < NOW() - $1::INTERVAL`,
        [intervalStr]
      )

      // 6. Limpieza de estados de conversación (carts / rounds en conversation_states)
      const { rowCount: stateRowCount } = await db.query(
        `DELETE FROM conversation_states WHERE updated_at < NOW() - $1::INTERVAL`,
        [intervalStr]
      )
      
      logger.info(`[MAINTENANCE] Configuración activa: retener ${intervalStr}. Se limpiaron: ${iaRowCount} registros IA, ${uiRowCount} mensajes UI, ${memRowCount} memorias semánticas, ${stateRowCount} estados de compra. DB Higiénica. ✅`)
    } catch (error: any) {
      logger.error("[MAINTENANCE] Error en limpieza de historial:", { error: error.message })
    }
  }

  startWorker() {
    // Ejecutar cada 12 horas
    setInterval(() => this.purgeOldHistory(), 12 * 60 * 60 * 1000)
    // Primera ejecución a los 30 segundos
    setTimeout(() => this.purgeOldHistory(), 30000)
  }
}

export const historyMaintenanceService = new HistoryMaintenanceService()
