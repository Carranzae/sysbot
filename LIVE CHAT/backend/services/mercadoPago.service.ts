import { MercadoPagoConfig, Preference } from 'mercadopago'
import { config } from '../config/env'
import { logger } from '../api/utils/logger'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

export class MercadoPagoService {
  /**
   * Crea una preferencia de pago para un pedido específico usando las credenciales del proveedor.
   */
  async createOrderPreference(
    providerAccessToken: string,
    order: {
      id: string
      total: number
      customer_email: string
      customer_name: string
    },
    items: Array<{ name: string; quantity: number; unit_price: number }>
  ) {
    try {
      const client = new MercadoPagoConfig({
        accessToken: providerAccessToken,
        options: { timeout: 5000 }
      })

      const preference = new Preference(client)

      const result = await preference.create({
        body: {
          items: items.map(item => ({
            id: order.id,
            title: item.name,
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
            currency_id: 'PEN'
          })),
          payer: {
            email: order.customer_email,
            name: order.customer_name
          },
          back_urls: {
            success: config.server.frontendUrl.includes('localhost') 
              ? `https://atines.pe/track-order?code=${order.id}&payment=success`
              : `${config.server.frontendUrl}/track-order?code=${order.id}&payment=success`,
            failure: config.server.frontendUrl.includes('localhost')
              ? `https://atines.pe/track-order?code=${order.id}&payment=failure`
              : `${config.server.frontendUrl}/track-order?code=${order.id}&payment=failure`,
            pending: config.server.frontendUrl.includes('localhost')
              ? `https://atines.pe/track-order?code=${order.id}&payment=pending`
              : `${config.server.frontendUrl}/track-order?code=${order.id}&payment=pending`
          },
          auto_return: 'approved',
          external_reference: order.id,
          notification_url: (config.api.url.includes('localhost') || config.api.url.includes('192.168.') || config.api.url.includes('127.0.0.1'))
            ? `https://atines.pe/api/payments/mercadopago/webhook`
            : `${config.api.url}/payments/mercadopago/webhook`,
          metadata: {
            order_id: order.id
          }
        }
      })

      return {
        id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point
      }
    } catch (error: any) {
      console.error('MERCADO PAGO ERROR DETAIL:', error);
      logger.error('Error creando preferencia en Mercado Pago:', { error: error.message, orderId: order.id })
      throw new Error('No se pudo iniciar el proceso de pago con Mercado Pago')
    }
  }

  /**
   * Genera un QR de pago dinámico para un pedido
   * Retorna tanto el link como la imagen en Base64
   */
  async generateOrderQR(
    providerAccessToken: string,
    order: {
      id: string
      total: number
      customer_email: string
      customer_name: string
    },
    items: Array<{ name: string; quantity: number; unit_price: number }>
  ) {
    try {
      // 1. Crear la preferencia de pago
      const preference = await this.createOrderPreference(providerAccessToken, order, items)
      
      const initPoint = preference.init_point || ''
      
      // 2. Generar el QR a partir del init_point
      const qrDataUrl = await QRCode.toDataURL(initPoint, {
        margin: 2,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })

      // 3. Opcional: Guardar el QR como archivo físico para el bot si fuera necesario
      const fileName = `qr-mp-${order.id}.png`
      const uploadDir = path.join(process.cwd(), 'uploads', 'payments')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      
      const filePath = path.join(uploadDir, fileName)
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "")
      fs.writeFileSync(filePath, base64Data, 'base64')

      return {
        preferenceId: preference.id,
        initPoint: preference.init_point,
        qrBase64: qrDataUrl,
        qrFilePath: filePath
      }
    } catch (error: any) {
      logger.error('Error generando QR de Mercado Pago:', { error: error.message, orderId: order.id })
      throw error
    }
  }
}

export const mercadoPagoService = new MercadoPagoService()
