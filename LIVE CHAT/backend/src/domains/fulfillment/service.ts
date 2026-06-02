import { db } from '../../../database/db'
import bcrypt from 'bcryptjs'
import { whatsappWebManager } from '../../../services/whatsappWeb.service'
import { logger } from '../../../api/utils/logger'
import { notificationService } from '../../../services/notification.service'
import { trackingService } from '../../../services/tracking.service'

export const FULFILLMENT_STEPS_NATIONAL = {
  pending:        { label: 'Pendiente',          emoji: '⏳', order: 0 },
  collected:      { label: 'Recolectado',        emoji: '📦', order: 1 },
  verified:       { label: 'Verificado (QC)',    emoji: '✅', order: 2 },
  packed:         { label: 'Empaquetado',        emoji: '🎁', order: 3 },
  guide_uploaded: { label: 'Guía Registrada',   emoji: '🏷️', order: 4 },
  dispatched:     { label: 'Despachado',         emoji: '🚀', order: 5 },
}

export const FULFILLMENT_STEPS_INTERNATIONAL = {
  pending:               { label: 'Pendiente',                emoji: '⏳', order: 0 },
  warehouse_received:    { label: 'En Almacén Origen',        emoji: '🏢', order: 1 },
  origin_customs:        { label: 'En Aduanas Origen',        emoji: '🛂', order: 2 },
  international_transit: { label: 'Tránsito Internacional',   emoji: '✈️', order: 3 },
  destination_customs:   { label: 'En Aduanas Destino',       emoji: '🛃', order: 4 },
  local_delivery:        { label: 'Recibido en Almacén Perú', emoji: '🇵🇪', order: 5 },
  dispatched:            { label: 'Entregado Final',          emoji: '🏁', order: 6 }
}

export class FulfillmentService {
  getSteps(type: string) {
    const isInternational = type === 'international' || type === 'global'
    return isInternational ? FULFILLMENT_STEPS_INTERNATIONAL : FULFILLMENT_STEPS_NATIONAL
  }

  /**
   * Operadores: CRUD
   */
  async listOperators(providerId: string) {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, created_at, is_active, warehouse_type
       FROM users WHERE provider_id = $1 AND role = 'warehouse'
       ORDER BY created_at DESC`,
      [providerId]
    )
    return rows
  }

  async createOperator(data: any, providerId: string) {
    const hashedPassword = await bcrypt.hash(data.password, 10)
    const type = data.warehouse_type === 'global' ? 'global' : 'national'
    
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role, provider_id, is_active, warehouse_type)
       VALUES ($1, $2, $3, $4, 'warehouse', $5, true, $6)
       RETURNING id, name, email, phone, role, created_at, is_active, warehouse_type`,
      [data.name.trim(), data.email.toLowerCase().trim(), hashedPassword, data.phone || null, providerId, type]
    )
    return rows[0]
  }

  async updateOperator(id: string, updates: any, providerId: string) {
    // Verificar propiedad
    const { rows: current } = await db.query('SELECT provider_id FROM users WHERE id = $1', [id])
    if (!current.length || current[0].provider_id !== providerId) throw new Error('Operador no encontrado o no autorizado')

    const fields = Object.keys(updates).filter(k => ['name', 'phone', 'is_active', 'warehouse_type'].includes(k))
    if (fields.length === 0) return null

    const clauses = fields.map((f, i) => `${f} = $${i + 2}`)
    const values = fields.map(f => updates[f])

    const { rows } = await db.query(
      `UPDATE users SET ${clauses.join(', ')} WHERE id = $1 RETURNING id, name, email, phone, role, is_active, warehouse_type`,
      [id, ...values]
    )
    return rows[0]
  }

  async deleteOperator(id: string, providerId: string) {
    // 1. Obtener datos del operador para asegurar que pertenece al proveedor
    const { rows: opData } = await db.query(
      "SELECT provider_id FROM users WHERE id = $1 AND role = 'warehouse'",
      [id]
    )
    if (!opData.length || opData[0].provider_id !== providerId) {
      throw new Error('Operador no encontrado o no autorizado')
    }

    // 2. Transferir activos y ventas al proveedor principal (Integridad Total Industrial)
    await db.query("UPDATE products SET user_id = $1 WHERE user_id = $2", [providerId, id])
    await db.query("UPDATE categories SET user_id = $1 WHERE user_id = $2", [providerId, id])
    await db.query("UPDATE orders SET user_id = $1 WHERE user_id = $2", [providerId, id])
    
    // 3. Limpiar datos temporales
    await db.query("DELETE FROM carts WHERE user_id = $1", [id])
    await db.query("DELETE FROM conversation_states WHERE user_id = $1", [id])

    // 4. Desvincular de logística (Integridad Referencial)
    await db.query(
      "UPDATE orders SET fulfillment_operator_id = NULL WHERE fulfillment_operator_id = $1",
      [id]
    )

    // 5. Eliminar operador
    const { rowCount } = await db.query(
      "DELETE FROM users WHERE id = $1 AND provider_id = $2",
      [id, providerId]
    )
    
    if (!rowCount) throw new Error('No se pudo eliminar el operador')
  }

  /**
   * Pedidos: Listado
   */
  async getWarehouseOrders(userId: string, role: string, options: { 
    provider_id?: string;
    page?: number;
    limit?: number;
    search?: string;
    shipping_type?: string;
  }) {
    const { page = 1, limit = 50, search, provider_id, shipping_type } = options
    const offset = (page - 1) * limit
    
    let targetProviderId = userId
    let warehouseType = 'national'

    // Si es un operario, buscamos el ID de su proveedor dueño
    if (role === 'warehouse') {
      const { rows } = await db.query('SELECT provider_id, warehouse_type FROM users WHERE id = $1', [userId])
      targetProviderId = rows[0]?.provider_id
      warehouseType = rows[0]?.warehouse_type || 'national'
    } 
    // Si es un administrador general, puede filtrar por cualquier proveedor
    else if (role === 'admin_general') {
      targetProviderId = provider_id || userId
    }
    // Si es un proveedor, targetProviderId ya es userId (su propio ID)
    // No hace falta lógica extra, el valor por defecto es correcto.

    // LOGICA DE AISLAMIENTO INDUSTRIAL (Blindaje de Propiedad)
    // El pedido debe pertenecer al proveedor o contener sus productos
    const params: any[] = [targetProviderId]
    const conditions: string[] = [
      "(o.fulfillment_status IS NULL OR o.fulfillment_status != 'dispatched')"
    ]

    // Solo requerir pago confirmado para pedidos nacionales
    if (shipping_type !== 'international') {
      conditions.push("o.payment_status IN ('paid', 'confirmed')")
    }

    // Filtro de Canal (Nacional vs Internacional)
    if (shipping_type) {
      params.push(shipping_type)
      conditions.push(`o.shipping_type = $${params.length}`)
    } else if (role === 'warehouse') {
      if (warehouseType === 'global') {
        conditions.push("(o.shipping_type = 'international' OR o.shipping_type = 'global')")
      } else {
        conditions.push("(o.shipping_type IS NULL OR o.shipping_type = 'national')")
      }
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      conditions.push(`(LOWER(o.customer_name) LIKE $${params.length} OR LOWER(o.payment_reference_code) LIKE $${params.length})`)
    }

    // QUERY FINAL BLINDADA Y SIMPLIFICADA
    // Un pedido es visible si el proveedor es el dueño directo (user_id)
    const whereStr = `
      WHERE (${conditions.join(' AND ')})
      AND o.user_id = $1
    `

    // 1. Conteo total
    const countResult = await db.query(`SELECT COUNT(*) FROM orders o ${whereStr}`, params)
    const total = parseInt(countResult.rows[0].count)

    // 2. Query paginada
    const { rows } = await db.query(
      `SELECT o.*, o.products AS items
       FROM orders o
       ${whereStr}
       ORDER BY o.created_at DESC 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    return {
      orders: rows.map(o => ({ ...o, steps: this.getSteps(o.shipping_type) })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    }
  }

  /**
   * Actualizar Estado y Notificar
   */
  async updateFulfillmentStatus(orderId: string, updates: any, userId: string, role: string) {
    // 1. Validar permiso y obtener proveedor (Lógica Industrial Robusta)
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId])
    if (orderRows.length === 0) throw new Error('Pedido no encontrado')
    const order = orderRows[0]

    let targetProviderId = userId
    if (role === 'warehouse') {
       const { rows } = await db.query('SELECT provider_id FROM users WHERE id = $1', [userId])
       targetProviderId = rows[0]?.provider_id
    }

    // Validar Permisos (Industrial Flexible)
    if (role !== 'admin_general' && order.user_id !== targetProviderId) {
       throw new Error(`No tienes permisos para este pedido. Dueño: ${order.user_id}, Tu Jerarquía: ${targetProviderId}`)
    }

    // 2. Validar avance de pasos (Lógica Industrial Flexible)
    const activeSteps = this.getSteps(order.shipping_type)
    const currentStep = activeSteps[order.fulfillment_status as keyof typeof activeSteps]?.order ?? 0
    const newStep = activeSteps[updates.fulfillment_status as keyof typeof activeSteps]?.order ?? 0
    
    if (newStep < currentStep) {
      throw new Error(`No se puede retroceder: de ${order.fulfillment_status} a ${updates.fulfillment_status}`)
    }

    // Validación de Pago (Solo restrictiva para Nacional)
    const isGlobal = order.shipping_type === 'international' || order.shipping_type === 'global'
    if (!isGlobal && order.payment_status !== 'paid' && order.payment_status !== 'confirmed') {
       throw new Error('No se puede avanzar la logística de un pedido nacional sin pago confirmado')
    }

    // 3. Actualizar
    const { rows: updatedRows } = await db.query(
      `UPDATE orders SET
        fulfillment_status = $1::text, fulfillment_updated_at = NOW(), fulfillment_operator_id = $2::uuid,
        fulfillment_notes = COALESCE($3::text, fulfillment_notes), courier_agency = COALESCE($4::text, courier_agency),
        guide_number = COALESCE($5::text, guide_number), guide_photo_url = COALESCE($6::text, guide_photo_url),
        status = CASE WHEN $1::text = 'dispatched' THEN 'enviado' ELSE status END
       WHERE id = $7::uuid RETURNING *`,
      [updates.fulfillment_status, userId, updates.fulfillment_notes || null, updates.courier_agency || null, updates.guide_number || null, updates.guide_photo_url || null, orderId]
    )
    const updatedOrder = updatedRows[0]

    // 4. Notificar vía WhatsApp
    this.notifyCustomer(updatedOrder, activeSteps[updates.fulfillment_status as keyof typeof activeSteps])

    return updatedOrder
  }

  async scanLabel(imageData: string) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

      const prompt = `Analiza esta guía de envío. Extrae tracking_number y courier_agency. Responde estrictamente solo un objeto JSON válido.`
      const result = await model.generateContent([
        prompt, 
        { inlineData: { data: imageData.split(',')[1] || imageData, mimeType: 'image/png' } }
      ])
      
      const text = result.response.text()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { tracking_number: null, courier_agency: null }
    } catch (error: any) {
      logger.error('Error en scanLabel IA:', error as any)
      return { tracking_number: null, courier_agency: null, error: 'No se pudo leer la guía' }
    }
  }
 
  private async notifyCustomer(order: any, stepInfo: any) {
    if (!stepInfo) return
    const name   = order.customer_name?.split(' ')[0] || 'Cliente'
    const ref    = order.payment_reference_code || order.id.slice(0, 8).toUpperCase()
    const isIntl = order.shipping_type === 'international' || order.shipping_type === 'global'
    const pending = parseFloat(order.pending_amount) || 0
    const guide  = order.guide_number ? `\n🏷️ *Guía ${(order.courier_agency || 'Courier').toUpperCase()}:* ${order.guide_number}` : ''

    // Mensajes personalizados por hito
    const hitoMessages: Record<string, string> = {
      // ── NACIONALES ──────────────────────────────────────────────
      collected:       `📦 *¡Tu pedido está en movimiento!*\n\nHola *${name}*, tu pedido *#${ref}* ya fue recolectado por nuestro equipo y está siendo preparado. 🎉`,
      verified:        `✅ *Control de Calidad Aprobado*\n\nHola *${name}*, tu pedido *#${ref}* pasó el control de calidad. Todo está perfecto, pronto lo empaquetamos.`,
      packed:          `🎁 *¡Tu pedido está empaquetado!*\n\nHola *${name}*, tu pedido *#${ref}* ya está listo y sellado. En breve registramos la guía de envío.`,
      guide_uploaded:  order.guide_number
        ? trackingService.buildGuideNotification(order)
        : `🏷️ *¡Guía de Envío Registrada!*\n\nHola *${name}*, tu pedido *#${ref}* ya tiene guía asignada. Pronto te enviamos el enlace de rastreo.`,
      dispatched: order.guide_number
        ? trackingService.buildGuideNotification(order)
        : `🚀 *¡Tu pedido está en camino!* 📦\n\nHola *${name}*, tu pedido *#${ref}* fue entregado al courier. ¡Prepárate para recibirlo!`,
      // ── INTERNACIONALES ─────────────────────────────────────────
      warehouse_received:    `🏢 *Pedido en Almacén Origen* ✈️\n\nHola *${name}*, tu importación *#${ref}* llegó a nuestro almacén en origen y está siendo preparada para el envío internacional. 🌍`,
      origin_customs:        `🛂 *En Aduanas de Origen*\n\nHola *${name}*, tu pedido *#${ref}* está pasando los controles de aduana en el país de origen. Este proceso toma 1-3 días. ⏳`,
      international_transit: `✈️ *¡En Vuelo hacia Perú!* 🇵🇪\n\nHola *${name}*, excelentes noticias. Tu importación *#${ref}* está en tránsito aéreo internacional. ¡Viene en camino!`,
      destination_customs:   `🛃 *En Aduanas Perú*\n\nHola *${name}*, tu pedido *#${ref}* aterrizó en Perú y está en proceso de despacho aduanero.${pending > 0 ? `\n\n💳 *Recuerda:* Tienes un saldo pendiente de *S/ ${pending.toFixed(2)}* para completar tu pago antes de la entrega.` : ''}`,
      local_delivery:        `🇵🇪 *¡Tu pedido llegó a Lima!*\n\nHola *${name}*, tu importación *#${ref}* ya está en nuestro almacén en Lima y siendo coordinada para el reparto final.${pending > 0 ? `\n\n⚠️ Saldo pendiente: *S/ ${pending.toFixed(2)}*` : ''}`,
    }

    let msg = hitoMessages[order.fulfillment_status]

    // Si no hay mensaje específico, usar el genérico
    if (!msg) {
      msg = isIntl
        ? `🌍 *Actualización de tu Importación* ✈️\n\nHola *${name}*, tu pedido *#${ref}* avanzó a: *${stepInfo.label}* ${stepInfo.emoji}`
        : `📦 *Actualización de tu Pedido*\n\nHola *${name}*, tu pedido *#${ref}* avanzó a: *${stepInfo.label}* ${stepInfo.emoji}`
    }

    // Siempre agregar cierre cálido
    msg += `\n\n_Si tienes alguna pregunta, escríbenos directamente por este chat. **Atti** te atenderá de inmediato._ 🤖✨`

    if (msg) {
      notificationService.enqueue(order.user_id, order.customer_phone, msg, order.guide_photo_url)
    }
  }
}

export const fulfillmentService = new FulfillmentService()

