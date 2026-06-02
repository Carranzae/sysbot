/**
 * ═══════════════════════════════════════════════════════
 * GENERADOR DE QR UNIVERSAL — PASARELAS DE PAGO
 * ═══════════════════════════════════════════════════════
 * Convierte cualquier link de pago (Culqi, Izipay, MP, etc.)
 * en una imagen QR lista para enviar por WhatsApp.
 */
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { logger } from '../api/utils/logger'

export class QRGeneratorService {

  /**
   * Genera una imagen QR desde cualquier URL de pago.
   * @returns Ruta absoluta de la imagen PNG generada.
   */
  async generateFromUrl(
    url: string,
    fileName: string
  ): Promise<string | null> {
    try {
      const dir = path.join(process.cwd(), 'uploads', 'qrcodes')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const filePath = path.join(dir, `${fileName}.png`)

      await QRCode.toFile(filePath, url, {
        width: 400,
        margin: 2,
        color: {
          dark:  '#1e293b', // Color del QR (slate oscuro)
          light: '#ffffff', // Fondo blanco
        },
        errorCorrectionLevel: 'H', // Alta tolerancia a errores (mejor escaneo)
      })

      logger.info(`[QR] Generado: ${fileName}.png para URL: ${url.slice(0, 60)}...`)
      return filePath
    } catch (err: any) {
      logger.error('[QR] Error generando QR:', err.message)
      return null
    }
  }

  /**
   * Genera un QR para un pago de Culqi.
   * El cliente escanea → se abre el checkout seguro de Culqi en su navegador.
   */
  async generateCulqiQR(culqiOrderId: string, orderId: string): Promise<string | null> {
    // Culqi Checkout URL: el cliente escanea y paga con su tarjeta
    const checkoutUrl = `https://checkout.culqi.com/order/${culqiOrderId}`
    return this.generateFromUrl(checkoutUrl, `QR-CULQI-${orderId.slice(0, 8)}`)
  }

  /**
   * Genera un QR para un pago de Izipay.
   * El cliente escanea → se abre el formulario de pago de Izipay.
   */
  async generateIzipayQR(formToken: string, shopId: string, orderId: string): Promise<string | null> {
    // Izipay Hosted Fields URL con el formToken
    const checkoutUrl = `https://secure.micuentaweb.pe/vads-payment/?vads-form-token=${formToken}&shop=${shopId}`
    return this.generateFromUrl(checkoutUrl, `QR-IZIPAY-${orderId.slice(0, 8)}`)
  }

  /**
   * Genera un QR genérico desde cualquier link.
   * Útil para links de pago custom o transferencias bancarias.
   */
  async generateGenericQR(url: string, label: string): Promise<string | null> {
    return this.generateFromUrl(url, `QR-${label}`)
  }
}

export const qrGeneratorService = new QRGeneratorService()
