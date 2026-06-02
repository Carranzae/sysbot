import axios from 'axios'
import { logger } from '../api/utils/logger'

export class IzipayService {
  /**
   * Genera un token de formulario (formToken) para Izipay usando el SDK de Lyra.
   * Documentación: https://izipay.pe/desarrolladores
   */
  async createPaymentForm(
    shopId: string,
    password: string,
    order: { id: string; total: number; customer_email: string }
  ) {
    try {
      const auth = Buffer.from(`${shopId}:${password}`).toString('base64')
      
      const response = await axios.post(
        'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment',
        {
          amount: Math.round(order.total * 100), // En céntimos
          currency: 'PEN',
          orderId: order.id,
          customer: {
            email: order.customer_email
          }
        },
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.status !== 'SUCCESS') {
        throw new Error(response.data.answer?.errorMessage || 'Error en Izipay')
      }

      return {
        formToken: response.data.answer.formToken,
        publicKey: shopId // En Izipay, el ShopID se usa a veces como clave pública en el front
      }
    } catch (error: any) {
      logger.error('Error en IzipayService:', error.response?.data || error.message)
      throw new Error('No se pudo conectar con el servidor de Izipay')
    }
  }
}

export const izipayService = new IzipayService()
