import { db } from '../../../database/db'
import { emailService } from '../../../services/email.service'
import { whatsappWebManager } from '../../../services/whatsappWeb.service'
import { aiService } from '../../../services/ai.service'
import { logger } from '../../../api/utils/logger'
import { io } from '../../../api/server'
import { iftttService } from '../../../services/ifttt.service'
import { subscriptionService } from '../subscriptions/service'
import { billingService } from '../monetization/billing.service'
import { notificationService } from '../../../services/notification.service'

export class OrderService {
  /**
   * Obtiene un pedido por código público, tracking o ID.
   * Sanitiza datos sensibles.
   */
  async getOrderByPublicCode(code: string, email?: string) {
    const safeSelect = 'id, user_id, customer_user_id, customer_name, customer_email, customer_phone, total, paid_amount, pending_amount, status, payment_status, payment_method, payment_reference_code, tracking_number, shipping_type, fulfillment_status, fulfillment_updated_at, fulfillment_notes, courier_agency, guide_number, created_at'
    
    let query = `SELECT ${safeSelect} FROM orders WHERE payment_reference_code = $1 OR tracking_number = $1`
    let params = [code]

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) {
      query += ` OR id = $1`
    }

    const { rows } = await db.query(`${query} ORDER BY created_at DESC LIMIT 1`, params)
    const order = rows[0]

    if (!order) return null
    if (email && order.customer_email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Código o email incorrecto')
    }

    const { fulfillmentService } = await import('../fulfillment/service')
    const steps = fulfillmentService.getSteps(order.shipping_type)

    return {
      ...order,
      customer_email: this.maskEmail(order.customer_email),
      customer_phone: this.maskPhone(order.customer_phone),
      fulfillment_steps: steps
    }
  }

  /**
   * Crea un pedido nuevo y dispara todas las automatizaciones.
   */
  async createOrder(orderData: any, providerEmail?: string) {
    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      // 1. Validar Proveedor Activo y Obtener Configuración
      const { rows: providerStatus } = await client.query('SELECT is_active, almacen_phone, payment_config FROM users WHERE id = $1', [orderData.user_id])
      if (providerStatus.length === 0 || !providerStatus[0].is_active) {
        throw new Error('TIENDA NO DISPONIBLE')
      }
      const providerConfig = providerStatus[0]

      const products = Array.isArray(orderData.products) ? orderData.products : JSON.parse(orderData.products || '[]')
      
      // Ordenar productos por ID para prevenir DEADLOCKS en concurrencia masiva (Industrial Elite)
      const sortedProducts = [...products].sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))

      // 2. Descontar Stock Atómicamente y Recalcular Total Blindado
      let secureSubtotal = 0
      const secureProducts = []

      for (const item of sortedProducts) {
        if (item.id && item.quantity) {
          // Obtener datos reales de la BD
          const { rows: check } = await client.query('SELECT name, stock, price FROM products WHERE id = $1', [item.id])
          if (check.length === 0) throw new Error(`Producto no encontrado: ${item.id}`)
          
          const realPrice = parseFloat(check[0].price) || 0
          secureSubtotal += realPrice * item.quantity
          
          // Reconstruir el item con el precio y nombre reales de la BD para evitar inyecciones
          secureProducts.push({
             ...item,
             name: check[0].name,
             price: realPrice
          })

          const { rowCount } = await client.query(
            'UPDATE products SET stock = stock - $2, updated_at = NOW() WHERE id = $1 AND stock >= $2',
            [item.id, item.quantity]
          )
          if (rowCount === 0) {
            throw new Error(`Stock insuficiente para "${check[0]?.name || item.id}". Disponible: ${check[0]?.stock || 0}`)
          }
        }
      }

      // Calcular envío real basado en la configuración del proveedor
      const shippingCfg = providerConfig.payment_config?.shipping || { type: 'free_over_threshold', flat_amount: 10, free_threshold: 50 }
      let secureShipping = 0
      
      if (shippingCfg.type === 'flat') {
        secureShipping = Math.max(0, shippingCfg.flat_amount || 0)
      } else if (shippingCfg.type === 'free_over_threshold') {
        if (!(typeof shippingCfg.free_threshold === 'number' && secureSubtotal >= shippingCfg.free_threshold)) {
           secureShipping = Math.max(0, shippingCfg.flat_amount || 0)
        }
      }

      const secureTotal = secureSubtotal + secureShipping

      // 3. Insertar Pedido
      const insertQuery = `
        INSERT INTO orders (
          user_id, customer_user_id, customer_name, customer_email, customer_phone,
          products, total, paid_amount, pending_amount, status, payment_method, payment_status, payment_reference_code,
          shipping_address, shipping_type, tracking_number, payment_security_code,
          customer_id_number, fulfillment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `
      const { rows } = await client.query(insertQuery, [
        orderData.user_id, orderData.customer_user_id || null, orderData.customer_name,
        orderData.customer_email, orderData.customer_phone || null, JSON.stringify(secureProducts),
        secureTotal, orderData.paid_amount || 0, secureTotal,
        orderData.status || 'preparando', orderData.payment_method || null,
        orderData.payment_status || 'pending', orderData.payment_reference_code || null,
        orderData.shipping_address || null, orderData.shipping_type || 'national',
        orderData.tracking_number || null, orderData.payment_security_code || null,
        orderData.customer_id_number || null, orderData.shipping_type === 'international' ? 'pending' : null
      ])
      const order = rows[0]

      await client.query('COMMIT')

      // Notificar en tiempo real al proveedor
      io.to(`user_${order.user_id}`).emit('new_order', { 
        orderId: order.id,
        customerName: order.customer_name,
        total: order.total
      })

      // DISPARAR ALARMA MÓVIL (IFTTT)
      iftttService.triggerAlarm(order.user_id, { 
        customerName: order.customer_name, 
        total: order.total 
      }, '🛒 Nuevo Pedido Creado')

      // 4. Notificaciones Asíncronas
      this.handlePostCreateAutomation(order, providerEmail, providerStatus[0].almacen_phone)

      return order
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Actualiza un pedido y dispara lógica de hitos (Fulfillment, WA, Stock).
   */
  async updateOrder(id: string, updates: any, userId: string, isAdmin: boolean) {
    // Verificar propiedad
    const { rows: ownerRows } = await db.query('SELECT user_id, status, products, customer_phone, payment_reference_code, shipping_address, shipping_type FROM orders WHERE id = $1', [id])
    if (!ownerRows.length) throw new Error('Pedido no encontrado')
    if (!isAdmin && ownerRows[0].user_id !== userId) throw new Error('No autorizado')

    const oldData = ownerRows[0]
    const entries = Object.entries(updates).filter(([k]) => ![ 'id', 'created_at', 'user_id' ].includes(k))
    if (!entries.length) return oldData

    const setClauses = entries.map(([key], idx) => `${key} = $${idx + 2}`)
    const values = entries.map(([, val]) => val)

    const { rows } = await db.query(`UPDATE orders SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values])
    const newData = rows[0]

    // Notificar en tiempo real
    io.to(`user_${newData.user_id}`).emit('order_updated', { order: newData })

    // Lógica post-update
    this.handlePostUpdateAutomation(oldData, newData, updates)

    return newData
  }

  async listOrders(options: { 
    userId?: string; 
    isAdmin: boolean; 
    status?: string; 
    search?: string; 
    page?: number; 
    limit?: number;
    asCustomer?: boolean;
    shippingType?: string;
  }) {
    const { userId, isAdmin, status, search, page = 1, limit = 20, asCustomer, shippingType } = options
    const offset = (page - 1) * limit
    const params: any[] = []
    let whereClauses: string[] = []

    // 1. Filtrado de Propiedad (Seguridad)
    if (asCustomer && userId) {
      params.push(userId)
      whereClauses.push(`customer_user_id = $${params.length}`)
    } else if (isAdmin) {
      // Admin ve TODO en la sección financiera si no se especifica un userId
      if (userId) { // Si viene un userId de filtro
        params.push(userId)
        whereClauses.push(`user_id = $${params.length}`)
      }
    } else if (!isAdmin && userId) {
      // Proveedor normal ve sus pedidos directos O pedidos que contienen sus productos (vía JSONB)
      params.push(userId)
      const userIdx = params.length
      whereClauses.push(`(
        user_id = $${userIdx} OR 
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(products) AS p
          WHERE (p->>'id') IN (SELECT CAST(id AS TEXT) FROM products WHERE user_id = $${userIdx})
        )
      )`)
    }
    // Si es Admin y NO envía userId, ve TODO.

    // 2. Filtro por Estado
    if (status) {
      params.push(status)
      whereClauses.push(`status = $${params.length}`)
    }

    // 3. Filtro por Tipo de Envío (Nacional vs Global/Internacional)
    // OPTIMIZACIÓN: Si hay una búsqueda activa, relajamos este filtro para encontrar el pedido en cualquier sección
    if (shippingType) {
      params.push(shippingType)
      if (shippingType === 'national') {
        whereClauses.push(`(shipping_type = $${params.length} OR shipping_type IS NULL OR shipping_type = '')`)
      } else {
        whereClauses.push(`shipping_type = $${params.length}`)
      }
    }

    // 4. Búsqueda Avanzada (Motor Industrial Multi-Campo)
    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`)
      const searchIdx = params.length
      whereClauses.push(`(
        LOWER(customer_name) LIKE $${searchIdx} OR 
        LOWER(payment_reference_code) LIKE $${searchIdx} OR 
        LOWER(tracking_number) LIKE $${searchIdx} OR
        LOWER(customer_email) LIKE $${searchIdx} OR
        LOWER(customer_phone) LIKE $${searchIdx} OR
        LOWER(CAST(id AS TEXT)) LIKE $${searchIdx} OR
        LOWER(CAST(customer_id_number AS TEXT)) LIKE $${searchIdx} OR
        LOWER(payment_security_code) LIKE $${searchIdx} OR
        LOWER(shipping_address) LIKE $${searchIdx}
      )`)
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

        
    // 4. Obtener Estadísticas Globales (Sin paginación)
    const statsQuery = `
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(*) FILTER (WHERE status = 'preparando' OR status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'entregado' OR status = 'completed') as completed_count
      FROM orders
      ${whereStr}
    `
    const { rows: statsRows } = await db.query(statsQuery, params)
    const stats = statsRows[0]
    const totalCount = parseInt(stats.total_count)

    // 5. Ejecutar Consulta Paginada
    const query = `
      SELECT * FROM orders
      ${whereStr}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const { rows: orders } = await db.query(query, [...params, limit, offset])

    return {
      orders,
      stats: {
        total: totalCount,
        revenue: parseFloat(stats.total_revenue),
        pending: parseInt(stats.pending_count),
        completed: parseInt(stats.completed_count)
      },
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    }
  }

  // --- MÉTODOS PRIVADOS DE AUTOMATIZACIÓN ---

  private async handlePostCreateAutomation(order: any, providerEmail?: string, almacenPhone?: string) {
    // Email Cliente
    emailService.sendOrderConfirmation(order, order.customer_email).catch(e => logger.warn('Email confirmation error:', e))
    
    // Email Proveedor
    if (providerEmail) {
      emailService.sendOrderNotificationToProvider(order, providerEmail).catch(e => logger.warn('Provider email error:', e))
    }

    // WhatsApp Cliente (Magic Link + IA Welcome)
    if (order.customer_phone && order.user_id) {
      try {
        const { magicLinkService } = await import('../../../services/magicLink.service')
        const magicLink = await magicLinkService.getOrCreateMagicLink(order.customer_phone, order.customer_name)
        const isInt = order.shipping_type === 'international'
        const welcomeMessage = `👋 ¡Hola ${order.customer_name}!\n\n🛍️ *Hemos recibido tu pedido* #${order.payment_reference_code || order.id.slice(0, 8)}.\n💰 *Total:* S/ ${order.total}\n${isInt ? '✈️ *Tipo:* Importación Global (10-20 días hábiles)\n' : ''}\n📍 *Sigue tu pedido aquí:* https://atines.pe/track/${order.id}\n\n🔐 *Accede a tu cuenta:* ${magicLink}`
        await whatsappWebManager.sendMessage(order.user_id, order.customer_phone, welcomeMessage)
        
        // WhatsApp Almacén
        if (almacenPhone) {
          const productList = (typeof order.products === 'string' ? JSON.parse(order.products) : order.products).map((p: any) => `• ${p.quantity}x ${p.name}`).join('\n')
          const warehouseMsg = `🛍️ *NUEVO PEDIDO ALMACÉN* #${order.payment_reference_code || order.id.slice(0, 8)}\n👤 *Cliente:* ${order.customer_name}\n📋 *Picking:*\n${productList}`
          await whatsappWebManager.sendMessage(order.user_id, almacenPhone, warehouseMsg)
        }
      } catch (e) { logger.error('Post-create WA error:', e as any) }
    }
  }

  private async handlePostUpdateAutomation(oldData: any, newData: any, updates: any) {
    // 1. Notificación 'Enviado' o 'Empaquetado'
    if (updates.status && updates.status !== oldData.status && newData.customer_phone) {
       this.notifyStatusChange(newData, updates.status)
       
       if (updates.status === 'entregado') {
         const { npsService } = await import('../../../services/nps.service')
         npsService.triggerSurvey(newData).catch(e => logger.error('NPS trigger error:', e))
       }
    }

    // 2. Hitos de Importación
    if (updates.fulfillment_status && updates.fulfillment_status !== oldData.fulfillment_status) {
       this.notifyFulfillmentHito(newData, updates.fulfillment_status)
    }

    // 3. Devolución de Stock si se cancela y Reversión de Comisión
    if (updates.status === 'cancelado' && oldData.status !== 'cancelado') {
      this.restoreStock(newData.products)
      
      // 💸 MONETIZACIÓN: Reversión de Comisión (Forense)
      db.query(`UPDATE commissions_ledger SET status = 'cancelled', updated_at = NOW() WHERE order_id = $1`, [newData.id])
        .then(() => logger.info(`♻️ [MONETIZACIÓN] Comisión revertida para pedido cancelado: ${newData.id}`))
        .catch(e => logger.error('❌ Error revirtiendo comisión:', e))
    }

    // 4. Alarma Móvil Industrial (IFTTT) — Solo en pago confirmado
    if (updates.payment_status === 'paid' && oldData.payment_status !== 'paid') {
      iftttService.triggerAlarm(newData.user_id, { 
        customerName: newData.customer_name, 
        total: newData.total 
      }, '💰 ¡PAGO CONFIRMADO!')
      
      
      // 🚀 MOTOR DE MONETIZACIÓN: Registrar Comisión de Admin
      this.processAdminCommission(newData)

      // 📄 FACTURACIÓN ELECTRÓNICA: Generar y enviar comprobante por WhatsApp
      billingService.processBilling({
        orderId: newData.id,
        userId: newData.user_id,
        customerData: {
          name: newData.customer_name,
          email: newData.customer_email,
          phone: newData.customer_phone,
          idNumber: newData.customer_id_number
        },
        items: typeof newData.products === 'string' ? JSON.parse(newData.products) : newData.products,
        total: parseFloat(newData.total),
        type: newData.customer_id_number && newData.customer_id_number.length === 11 ? 'factura' : 'boleta'
      })

      // 🔔 NOTIFICACIÓN UI: Aviso instantáneo al panel
      notificationService.notify({
        userId: newData.user_id,
        title: '💰 Pago Confirmado',
        message: `Se ha confirmado el pago de S/ ${newData.total} para el pedido #${newData.payment_reference_code || newData.id.slice(0,8)}`,
        type: 'success',
        link: `/provider/orders`
      })
    }
  }

  private async processAdminCommission(order: any) {
    try {
      const total = parseFloat(order.total)
      if (!total || total <= 0) return

      // 🎯 SINGLE SOURCE OF TRUTH: Obtener configuración financiera en caliente desde users
      const { rows: providerRows } = await db.query(
        'SELECT name, commission_rate, commission_mode FROM users WHERE id = $1',
        [order.user_id]
      )

      if (providerRows.length === 0) {
        logger.warn(`⚠️ [MONETIZACIÓN] No se encontró proveedor ${order.user_id} para procesar comisión.`)
        return
      }

      const provider = providerRows[0]
      const rate = parseFloat(provider.commission_rate) || 0
      const mode = provider.commission_mode || 'percentage'

      // Si la comisión es 0, es Plan Elite o Comisión 0%
      if (rate === 0) {
        logger.info(`👑 [MONETIZACIÓN] Comisión de 0% o S/ 0 configurada para ${provider.name} (${order.user_id}) — Omitiendo registro para pedido ${order.id}`)
        return
      }

      let commissionAmount = 0
      if (mode === 'fixed') {
        commissionAmount = parseFloat(rate.toFixed(2))
      } else {
        commissionAmount = parseFloat(((total * rate) / 100).toFixed(2))
      }

      // Asegurar que la comisión no sea mayor al total del pedido
      const secureCommission = Math.min(commissionAmount, total)
      const netAmount = parseFloat((total - secureCommission).toFixed(2))

      // Registrar en el Libro Mayor (Ledger)
      await db.query(`
        INSERT INTO commissions_ledger (order_id, provider_id, total_order_amount, commission_amount, net_amount_provider, status)
        VALUES ($1, $2, $3, $4, $5, 'recorded')
      `, [order.id, order.user_id, total, secureCommission, netAmount])

      logger.info(`💸 [MONETIZACIÓN] ${provider.name} (${mode === 'fixed' ? 'Monto Fijo' : 'Porcentaje'}) → Tasa: ${rate} → Comisión Cobrada: S/ ${secureCommission} por pedido ${order.id}`)

      // Notificar al Admin General vía Socket en tiempo real
      io.to('admin_room').emit('new_commission', {
        amount: secureCommission,
        mode,
        rate,
        providerName: provider.name,
        providerId: order.user_id,
        orderId: order.id
      })

    } catch (e) {
      logger.error('❌ Error procesando comisión de admin:', { error: (e as any).message })
    }
  }

  private async notifyStatusChange(order: any, status: string) {
    const isInt = order.shipping_type === 'international'
    let prompt = `Genera un mensaje de WhatsApp emocionante para un cliente cuyo pedido ${status.toUpperCase()} #${order.payment_reference_code || order.id.slice(0, 8)} está en camino. Domicilio: ${order.shipping_address}.`
    if (status === 'empaquetado') prompt = `Avisa al cliente que su pedido #${order.payment_reference_code || order.id.slice(0, 8)} está empaquetado y listo.`
    
    try {
      const aiRes = await aiService.chat(prompt)
      const msg = aiRes?.text || `Tu pedido está ${status}. Sigue aquí: https://atines.pe/track/${order.id}`
      await whatsappWebManager.sendMessage(order.user_id, order.customer_phone, msg)
    } catch (e) { logger.error('Status change WA error:', e as any) }
  }

  private async notifyFulfillmentHito(order: any, hito: string) {
    const labels: Record<string, string> = {
      warehouse_received: 'recibido en almacén origen',
      origin_customs: 'en aduanas de salida',
      international_transit: 'en vuelo internacional',
      destination_customs: 'en aduanas Perú',
      local_delivery: 'listo para reparto local'
    }
    const label = labels[hito]
    if (!label) return
    
    try {
      const aiRes = await aiService.chat(`Mensaje emocionante: pedido internacional #${order.payment_reference_code || order.id.slice(0, 8)} actualizado a "${label}".`)
      if (aiRes?.text) {
        await whatsappWebManager.sendMessage(order.user_id, order.customer_phone, `${aiRes.text}\n\n📍 Rastrear: https://atines.pe/track/${order.id}`)
      }
    } catch (e) { logger.error('Fulfillment hito WA error:', e as any) }
  }

  private async restoreStock(productsJson: any) {
    try {
      const products = typeof productsJson === 'string' ? JSON.parse(productsJson) : productsJson
      for (const item of products) {
        if (item.id && item.quantity) {
          await db.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.id])
        }
      }
    } catch (e) { logger.error('Restore stock error:', e as any) }
  }

  private maskEmail = (email: string) => {
    if (!email) return ''
    const [local, domain] = email.split('@')
    if (!local || !domain) return email
    return `${local[0]}***${local[local.length - 1]}@${domain}`
  }

  private maskPhone = (phone: string) => {
    if (!phone) return ''
    return '***' + phone.slice(-4)
  }
}

export const orderService = new OrderService()
