import axios from 'axios'
import { logger } from '../api/utils/logger'

export class CulqiService {
  /**
   * Crea una orden en Culqi (v2)
   * Documentación: https://culqi.com/desarrolladores/
   */
  async createOrder(
    secretKey: string,
    order: { id: string; total: number; customer_email: string; customer_name: string }
  ) {
    try {
      const response = await axios.post(
        'https://api.culqi.com/v2/orders',
        {
          amount: Math.round(order.total * 100), // En céntimos
          currency_code: 'PEN',
          description: `Pedido #${order.id}`,
          order_number: order.id,
          client_details: {
            first_name: order.customer_name.split(' ')[0],
            last_name: order.customer_name.split(' ').slice(1).join(' ') || 'Cliente',
            email: order.customer_email
          },
          expiration_date: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
        },
        {
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return {
        culqiOrderId: response.data.id,
        amount: response.data.amount
      }
    } catch (error: any) {
      logger.error('Error en CulqiService:', error.response?.data || error.message)
      throw new Error('No se pudo conectar con el servidor de Culqi')
    }
  }
  async createCharge(
    secretKey: string,
    data: { token: string; amount: number; email: string; description: string }
  ) {
    try {
      const response = await axios.post(
        'https://api.culqi.com/v2/charges',
        {
          amount: data.amount,
          currency_code: 'PEN',
          email: data.email,
          source_id: data.token,
          description: data.description
        },
        {
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      )
      return response.data
    } catch (error: any) {
      logger.error('Error en Culqi Charge:', error.response?.data || error.message)
      const errData = error.response?.data
      throw new Error(errData?.user_message || 'Error al procesar el cargo con Culqi')
    }
  }
}

export const culqiService = new CulqiService()
