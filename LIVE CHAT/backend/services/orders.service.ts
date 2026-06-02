import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { whatsappWebManager } from './whatsappWeb.service'

export class OrdersService {
  /**
   * Crea un pedido a partir del estado conversacional (carrito)
   */
  async createOrderFromCart(userId: string, customerPhone: string, cartItems: any[], total: number) {
    const client = await db.getClient()
    try {
      if (cartItems.length === 0) return null

      await client.query('BEGIN')

      // Generar código de referencia
      const refCode = `PED-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${customerPhone.slice(-4)}`

      const { rows: providerData } = await client.query('SELECT name FROM users WHERE id = $1', [userId])
      const providerName = providerData[0]?.name || 'Tienda'

      // Detectar si hay algún producto internacional en el carrito
      const hasInternational = cartItems.some(i => i.catalog_type === 'global' || i.catalog_type === 'international');
      const shippingType = hasInternational ? 'international' : 'national';

      // Ordenar productos por ID para prevenir DEADLOCKS en concurrencia (Industrial Elite)
      const sortedCartItems = [...cartItems].sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))

      // Descontar Stock Atómicamente
      for (const item of sortedCartItems) {
        if (item.id && item.qty) {
          const { rows: check } = await client.query('SELECT name, stock FROM products WHERE id = $1', [item.id])
          if (check.length === 0) throw new Error(`Producto no encontrado: ${item.id}`)
          
          const { rowCount } = await client.query(
            'UPDATE products SET stock = stock - $2, updated_at = NOW() WHERE id = $1 AND stock >= $2',
            [item.id, item.qty]
          )
          if (rowCount === 0) {
            throw new Error(`Stock insuficiente para "${check[0]?.name || item.id}". Disponible: ${check[0]?.stock || 0}`)
          }
        }
      }

      // ════════════════════════════════════════
      // EXTRAER DATOS DEL CLIENTE PARA EL PEDIDO (DNI, Dirección, Nombre WhatsApp y Canal Bot)
      // ════════════════════════════════════════
      let dni = ''
      let address = ''
      let realName = ''

      // 1. Obtener datos tributarios desde la Memoria a Largo Plazo
      const { customerMemoryService } = await import('./customerMemory.service')
      const billingInfo = await customerMemoryService.getBillingInfo(userId, customerPhone)
      if (billingInfo) {
        realName = billingInfo.name
        dni = billingInfo.dni
      }

      // 2. Consultar historial reciente para extraer Dirección (y DNI fallback si no hay memoria)
      const { rows: history } = await client.query(
        "SELECT role, content FROM conversation_history WHERE customer_phone = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 20",
        [customerPhone, userId]
      )

      if (!dni) {
        for (const msg of history) {
          const dniMatch = msg.content.match(/\b\d{8,11}\b/)
          if (dniMatch) {
            dni = dniMatch[0]
            break
          }
        }
      }

      // Buscar dirección en el historial
      for (const msg of history) {
        if (msg.role === 'user') {
          const addrMatch = msg.content.match(/(?:direccion|dirección|envio|envío|agencia|calle|av\.|jr\.)\s*:\s*([^\n]+)/i)
          if (addrMatch && !address) address = addrMatch[1].trim()
        }
      }

      // Si no hay dirección explícita, buscar palabras clave de agencias o calles
      if (!address) {
        const addressMsgs = history.filter(h => h.role === 'user' && (
          h.content.toLowerCase().includes('calle') ||
          h.content.toLowerCase().includes('av.') ||
          h.content.toLowerCase().includes('jr.') ||
          h.content.toLowerCase().includes('avenida') ||
          h.content.toLowerCase().includes('jiron') ||
          h.content.toLowerCase().includes('jirón') ||
          h.content.toLowerCase().includes('urbanizacion') ||
          h.content.toLowerCase().includes('urb.') ||
          h.content.toLowerCase().includes('shalo') ||
          h.content.toLowerCase().includes('olva')
        ))
        if (addressMsgs.length > 0) {
          address = addressMsgs[0].content.trim()
        }
      }

      // Buscar nombre de WhatsApp en la tabla de mensajes como fallback
      if (!realName) {
        const { rows: pushRows } = await client.query(
          "SELECT customer_pushname FROM whatsapp_messages WHERE customer_phone = $1 AND user_id = $2 AND customer_pushname IS NOT NULL ORDER BY created_at DESC LIMIT 1",
          [customerPhone, userId]
        )
        if (pushRows.length > 0 && pushRows[0].customer_pushname) {
          realName = pushRows[0].customer_pushname
        }
      }

      const finalName = realName ? `${realName}` : `Cliente WA (${customerPhone.slice(-4)})`
      
      // Obtener datos de envío estructurados desde la Memoria
      const shippingInfo = await customerMemoryService.getShippingInfo(userId, customerPhone)
      let finalAddress = ''
      if (shippingInfo) {
        finalAddress = `Método: ${shippingInfo.deliveryMethod} | Provincia: ${shippingInfo.province} | Distrito: ${shippingInfo.district}`
        if (shippingInfo.details) {
          finalAddress += ` | Detalle: ${shippingInfo.details}`
        }
      } else {
        finalAddress = [
          address ? `Dirección: ${address}` : '',
          dni ? `DNI/RUC: ${dni}` : ''
        ].filter(Boolean).join(' | ') || 'Recojo en Agencia / Dirección por coordinar en chat'
      }

      // Calcular el pago inicial esperado (completo, adelanto de importación del 50%, o adelanto negociado)
      let advanceToPay = total
      try {
        const { conversationStateService } = await import('./conversationState.service')
        const stateObj = await conversationStateService.get(userId, customerPhone)
        const negotiated = stateObj?.negotiatedAdvance
        const SPLIT_THRESHOLD = 200
        const shouldSplit = shippingType === 'international' && total > SPLIT_THRESHOLD

        if (negotiated && negotiated > 0 && negotiated < total) {
          advanceToPay = negotiated
        } else if (shouldSplit) {
          advanceToPay = total * 0.5
        }
      } catch (err: any) {
        logger.warn(`[ORDER-CREATION] No se pudo obtener el estado de conversación para calcular adelanto: ${err.message}`)
      }

      const paymentDetails = {
        expected_payment_amount: advanceToPay,
        is_split_payment: advanceToPay < total
      }

      const insertQuery = `
        INSERT INTO orders (
          user_id,
          customer_name,
          customer_email,
          customer_phone,
          products,
          total,
          paid_amount,
          pending_amount,
          status,
          payment_status,
          payment_reference_code,
          payment_method,
          shipping_type,
          shipping_address,
          payment_details
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `;

      const { rows } = await client.query(insertQuery, [
        userId,
        finalName,
        `${customerPhone}@whatsapp.com`,
        customerPhone,
        JSON.stringify(cartItems.map(i => ({ id: i.id, name: i.variant_details ? `${i.name} - ${i.variant_details}` : i.name, quantity: i.qty, price: i.price }))),
        total,
        0, // paid_amount inicial
        total, // pending_amount inicial (todo pendiente)
        'preparando',
        'pending',
        refCode,
        'transferencia',
        shippingType,
        finalAddress,
        JSON.stringify(paymentDetails)
      ]);

      const newOrder = rows[0]
      await client.query('COMMIT')
      logger.info(`Pedido #${refCode} creado automáticamente desde WhatsApp para ${customerPhone} y stock descontado`)

      // NOTIFICACIÓN AL ALMACÉN (Opcional en la creación, pero útil para visibilidad)
      const { rows: providerRows } = await db.query('SELECT almacen_phone FROM users WHERE id = $1', [userId])
      const almacenPhone = providerRows[0]?.almacen_phone
      
      if (almacenPhone) {
        const productList = cartItems.map((p: any) => `• ${p.qty}x ${p.name}`).join('\n')
        const warehouseMsg = `🕒 *PEDIDO EN PROCESO DE PAGO* #${refCode}\n\n👤 *Cliente:* ${customerPhone}\n📋 *Items:*\n${productList}\n\n⚠️ El cliente está por pagar. Se confirmará automáticamente al recibir el voucher.`
        await whatsappWebManager.sendMessage(userId, almacenPhone, warehouseMsg).catch(() => {})
      }

      return newOrder
    } catch (error: any) {
      await client.query('ROLLBACK')
      logger.error('Error creando pedido desde el bot:', { error: error.message })
      return null
    } finally {
      client.release()
    }
  }
  /**
   * Obtiene pedidos recientes por número de teléfono
   */
  async getOrdersByPhone(userId: string, phone: string) {
    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-9)
      const { rows } = await db.query(
        `SELECT id, payment_reference_code, status, fulfillment_status, total, paid_amount, pending_amount, created_at, guide_number, courier_agency, shipping_type 
         FROM orders 
         WHERE user_id = $1 AND (customer_phone LIKE $2 OR customer_phone = $3)
         ORDER BY created_at DESC LIMIT 3`,
        [userId, `%${cleanPhone}`, phone]
      )
      return rows
    } catch (error: any) {
      logger.error('Error buscando pedidos por teléfono:', { error: error.message })
      return []
    }
  }
}

export const ordersService = new OrdersService()
