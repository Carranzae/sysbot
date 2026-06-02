import { db } from '../../../database/db'
import { whatsappRouter } from '../../../services/whatsappRouter.service'
import { notificationService } from '../../../services/notification.service'
import { logger } from '../../../api/utils/logger'

export interface BillingPayload {
  orderId: string
  userId: string // Proveedor
  customerData: {
    name: string
    email: string
    phone: string
    idNumber?: string // DNI/RUC del cliente
  }
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  type: 'boleta' | 'factura'
}

class BillingService {
  /**
   * Genera el comprobante electrónico y lo envía por WhatsApp
   */
  async processBilling(payload: BillingPayload) {
    try {
      logger.info(`📄 [Billing] Iniciando proceso para Pedido #${payload.orderId}`)

      // 1. Obtener configuración fiscal del proveedor
      const { rows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [payload.userId])
      const config = rows[0]?.payment_config?.billing

      if (!config || !config.enabled) {
        logger.info(`[Billing] Facturación desactivada para el proveedor ${payload.userId}. Omitiendo.`)
        return
      }

      // 2. Generar el comprobante (Simulación de integración con OSE como Nubefact)
      // En una integración real, aquí se haría un fetch a Nubefact
      const invoiceData = await this.generateWithOSE(payload, config)

      if (invoiceData.success) {
        logger.info(`✅ [Billing] Comprobante generado: ${invoiceData.series}-${invoiceData.number}`)

        if (true) { // El Router se encarga de resolver la config
          const message = `📄 *Tu comprobante electrónico está listo*\n\nHola ${payload.customerData.name}, adjuntamos tu ${payload.type} por la compra del pedido #${payload.orderId}.`
          
          await whatsappRouter.sendDocument(
            payload.userId,
            payload.customerData.phone,
            invoiceData.pdfUrl,
            `${payload.type}_${invoiceData.series}_${invoiceData.number}.pdf`,
            message
          )
          logger.info(`📲 [Billing] Comprobante enviado por WhatsApp al cliente.`)

          // 🔔 Notificación visual para el panel
          await notificationService.notify({
            userId: payload.userId,
            title: `Comprobante Generado`,
            message: `${payload.type.toUpperCase()} ${invoiceData.series}-${invoiceData.number} para ${payload.customerData.name}`,
            type: 'success',
            link: `/provider/orders`
          })
        }
      }
    } catch (error: any) {
      logger.error(`❌ [Billing] Error procesando facturación:`, error.message)
    }
  }

  /**
   * Simulación de integración con OSE (Nubefact/Facturacion.pe)
   */
  private async generateWithOSE(payload: BillingPayload, config: any) {
    // Aquí iría el fetch real a la API del OSE usando config.ose_token
    // Por ahora, simulamos una respuesta exitosa con un PDF de prueba
    
    // Simulamos un delay de red
    await new Promise(resolve => setTimeout(resolve, 1500))

    return {
      success: true,
      series: payload.type === 'boleta' ? 'B001' : 'F001',
      number: Math.floor(Math.random() * 10000),
      pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // PDF de prueba
      xmlUrl: '',
      hash: 'abc123industrial'
    }
  }
}

export const billingService = new BillingService()
