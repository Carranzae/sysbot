import fs from 'fs'
import { db } from '../../../database/db'
import { emailService } from '../../../services/email.service'
import { scanGmailPayments } from '../../../services/paymentEmailVerifier.service'
import { logger } from '../../../api/utils/logger'
import { encryption } from '../../../api/utils/encryption'
import { whatsappService } from '../../../services/whatsapp.service'
import { productService } from '../products/service'
import { receiptGeneratorService } from '../../../services/receiptGenerator.service'

export class PaymentService {
  /**
   * Ejecuta el escáner de Gmail manualmente
   */
  async scanGmail() {
    return await scanGmailPayments()
  }

  /**
   * Valida un pago manual (Yape/Plin/Transferencia)
   */
  async validateManualPayment(orderId: string, referenceCode: string, securityCode: string, userId: string, isAdmin: boolean) {
    const ref = String(referenceCode || '').trim().toUpperCase()
    
    // 1. Buscar pedido
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId])
    const order = orderRows[0]

    if (!order) throw new Error('Pedido no encontrado')
    
    // 1.1 Validar que el proveedor esté "Ready" (Seguridad Industrial)
    const isReady = await this.isProviderReady(order.user_id)
    if (!isReady) {
      throw new Error('El comercio aún no ha completado la configuración de sus métodos de pago.')
    }

    // 2. Verificar permisos
    if (!isAdmin && order.user_id !== userId) {
      throw new Error('No autorizado para validar este pago')
    }

    // 3. Validar código de referencia
    if ((order.payment_reference_code || '').toUpperCase() !== ref) {
      throw new Error('Código de referencia inválido')
    }

    // 3.1 Auditoría: Verificar que este código no haya sido usado ya en un pedido PAGADO
    // Esto evita que un cliente intente usar el mismo comprobante para dos pedidos.
    const { rowCount: alreadyUsed } = await db.query(
      'SELECT 1 FROM orders WHERE payment_reference_code = $1 AND payment_status = \'paid\' AND id <> $2',
      [ref, orderId]
    )
    if (alreadyUsed) throw new Error('Este código de referencia ya ha sido utilizado y validado previamente.')

    // 4. Actualizar estado del pedido
    const { rows: updateRows } = await db.query(
      `UPDATE orders 
       SET payment_status = 'paid', 
           payment_security_code = $2, 
           status = 'preparando', 
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [orderId, securityCode]
    )
    const updatedOrder = updateRows[0]

    // 5. Automatizaciones (Email + WhatsApp)
    this.handlePostPaymentAutomation(updatedOrder)

    return updatedOrder
  }

  /**
   * Resuelve la configuración de pago para un usuario
   */
  async getResolvedConfig(userId: string) {
    const { rows } = await db.query('SELECT payment_gateway, payment_config FROM users WHERE id = $1', [userId])
    const user = rows[0]
    if (!user) return null

    const gateway = user.payment_gateway || process.env.DEFAULT_PAYMENT_GATEWAY || 'manual'
    let config = user.payment_config || {}

    // Fallback a global si el proveedor no tiene nada configurado
    if (Object.keys(config).length === 0) {
      config = {
        mercadopago: { access_token: process.env.MERCADOPAGO_ACCESS_TOKEN },
        izipay: { shop_id: process.env.IZIPAY_SHOP_ID, password: process.env.IZIPAY_PASSWORD },
        culqi: { public_key: process.env.CULQI_PUBLIC_KEY, secret_key: process.env.CULQI_SECRET_KEY }
      }
    }

    // Desencriptar campos sensibles si vienen de la DB
    const decryptIfSmall = (val: string) => {
      if (!val) return val
      if (val.includes(':')) return encryption.decrypt(val)
      return val
    }

    const resolved = {
      ...config, // Mantener TODAS las propiedades originales (manual, gmail, shipping, etc)
      gateway,
      mercadopago: {
        access_token: decryptIfSmall(config.mercadopago?.access_token || config.access_token)
      },
      izipay: {
        shop_id: config.izipay?.shop_id,
        password: decryptIfSmall(config.izipay?.password)
      },
      culqi: {
        public_key: config.culqi?.public_key,
        secret_key: decryptIfSmall(config.culqi?.secret_key)
      }
    }

    return resolved
  }

  /**
   * Crea una preferencia de Mercado Pago (Refactorizado)
   */
  async createMPPreference(orderId: string) {
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId])
    const order = orderRows[0]
    if (!order) throw new Error('Pedido no encontrado')

    const config = await this.getResolvedConfig(order.user_id)
    const accessToken = config?.mercadopago?.access_token

    if (!accessToken) throw new Error('Credenciales de Mercado Pago no configuradas')

    const products = Array.isArray(order.products) ? order.products : JSON.parse(order.products || '[]')
    const items = products.map((p: any) => ({ name: p.name, quantity: p.quantity, unit_price: p.price }))
    
    const { mercadoPagoService } = await import('../../../services/mercadoPago.service')
    return await mercadoPagoService.createOrderPreference(
      accessToken,
      { id: order.id, total: Number(order.total), customer_email: order.customer_email, customer_name: order.customer_name },
      items
    )
  }

  /**
   * Genera el QR de pago para Mercado Pago
   */
  async generateMPQR(orderId: string) {
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId])
    const order = orderRows[0]
    if (!order) throw new Error('Pedido no encontrado')

    const config = await this.getResolvedConfig(order.user_id)
    const accessToken = config?.mercadopago?.access_token

    if (!accessToken) throw new Error('Credenciales de Mercado Pago no configuradas para este comercio')

    const products = Array.isArray(order.products) ? order.products : JSON.parse(order.products || '[]')
    const items = products.map((p: any) => ({ name: p.name, quantity: p.quantity, unit_price: p.price }))
    
    const { mercadoPagoService } = await import('../../../services/mercadoPago.service')
    return await mercadoPagoService.generateOrderQR(
      accessToken,
      { id: order.id, total: Number(order.total), customer_email: order.customer_email, customer_name: order.customer_name },
      items
    )
  }

  /**
   * Genera formulario de Izipay
   */
  async createIzipayToken(orderId: string) {
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId])
    const order = orderRows[0]
    if (!order) throw new Error('Pedido no encontrado')

    const config = await this.getResolvedConfig(order.user_id)
    const shopId = config?.izipay?.shop_id
    const password = config?.izipay?.password

    if (!shopId || !password) {
      throw new Error('Izipay no configurado para este proveedor')
    }

    const { izipayService } = await import('../../../services/izipay.service')
    return await izipayService.createPaymentForm(shopId, password, order as any)
  }

  /**
   * Crea una orden en Culqi
   */
  async createCulqiOrder(orderId: string) {
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId])
    const order = orderRows[0]
    if (!order) throw new Error('Pedido no encontrado')

    const config = await this.getResolvedConfig(order.user_id)
    const secretKey = config?.culqi?.secret_key

    if (!secretKey) {
      throw new Error('Culqi no configurado para este proveedor')
    }

    const { culqiService } = await import('../../../services/culqi.service')
    return await culqiService.createOrder(secretKey, order as any)
  }

  /**
   * Procesa un cargo de Culqi
   */
  async processCulqiPayment(orderId: string, culqiToken: string) {
    const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [orderId])
    const order = orderRows[0]
    if (!order) throw new Error('Pedido no encontrado')

    const config = await this.getResolvedConfig(order.user_id)
    const secretKey = config?.culqi?.secret_key

    if (!secretKey) {
      throw new Error('Culqi no configurado para este proveedor')
    }

    const { culqiService } = await import('../../../services/culqi.service')
    const charge = await culqiService.createCharge(secretKey, {
      token: culqiToken,
      amount: Math.round(Number(order.total) * 100),
      email: order.customer_email,
      description: `Pago Pedido #${order.payment_reference_code || order.id.slice(0,8)}`
    })

    if (charge.outcome?.type === 'venta_exitosa' || charge.id?.startsWith('chr_')) {
      const { rows: updateRows } = await db.query(
        `UPDATE orders SET payment_status = 'paid', status = 'preparando', updated_at = NOW() 
         WHERE id = $1 RETURNING *`,
        [orderId]
      )
      
      if (updateRows.length > 0) {
        await this.handlePostPaymentAutomation(updateRows[0])
      }
      
      return { success: true, message: 'Pago procesado con éxito', chargeId: charge.id }
    } else {
      throw new Error(charge.user_message || 'El pago no pudo ser procesado')
    }
  }

  /**
   * Procesa el webhook de Mercado Pago
   */
  async processMPWebhook(paymentId: string) {
    try {
      logger.info(`[MP-WEBHOOK] Procesando pago ID: ${paymentId}`)
      
      // 1. Obtener detalles del pago desde MP para saber a qué pedido pertenece
      // Usamos una cuenta temporal o buscamos el token del proveedor
      // NOTA: Para obtener el token del proveedor antes de saber quién es, 
      // podemos buscar el pago en MP. Pero MP requiere el token del receptor.
      // ESTRATEGIA: En el webhook, MP suele enviar información que nos permite identificar el pago.
      // Si el pago se hizo a un proveedor X, necesitamos su token X.
      
      // Como el webhook no nos dice el userId, primero buscaremos en nuestra BD 
      // si tenemos algún registro pendiente con ese paymentId o external_reference.
      // Pero MP no envía el external_reference en el body raíz del webhook tipo 'payment'.
      
      // Solución Industrial: Mercado Pago envía el ID del pago. Consultamos la API de MP.
      // Para saber qué token usar, podemos intentar con el Token Global de Admin primero 
      // o buscar por el ID de la cuenta de MP si lo guardamos.
      
      // Una mejor forma es que Mercado Pago nos permite pasar un metadata o external_reference.
      // Al recibir el webhook, consultamos el pago. Pero ¿con qué token?
      // Usaremos un "Master Token" o iteraremos (poco eficiente) o guardaremos el mapping.
      
      // Por ahora, asumiremos que tenemos un mapping de Payment ID -> Order ID en una tabla temporal 
      // o que el Admin tiene permisos para consultar todos.
      
      // IMPLEMENTACIÓN REAL: Buscamos el pedido en nuestra DB que coincida con el payment_id 
      // (asumiendo que lo guardamos al crear la preferencia o que MP nos lo da).
      
      // En este flujo, Mercado Pago notificará y nosotros usaremos el config.mercadopago.access_token 
      // del proveedor del pedido.
      
      // Primero: Obtener el pago de MP usando el Token de Admin (si es cuenta master)
      // O buscar el pedido por una referencia que MP sí envía.
      
      const { mercadoPagoService } = await import('../../../services/mercadoPago.service')
      
      // Para este MVP industrial, buscaremos el pedido por external_reference si MP lo envía,
      // pero el webhook 'payment' de MP solo trae el ID.
      // Consultamos el pago usando el token del Admin para identificar al proveedor.
      const adminConfig = await this.getResolvedConfig('admin') // Placeholder o usar .env
      const masterToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
      
      // Obtener info del pago
      const mpPayment = (await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${masterToken}` }
      }).then(r => r.json())) as any

      const orderId = mpPayment.external_reference
      if (!orderId) {
        logger.warn(`[MP-WEBHOOK] Pago ${paymentId} sin external_reference. Ignorando.`)
        return
      }

      // 2. Obtener el pedido y el token del proveedor real
      const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId])
      const order = orderRows[0]
      if (!order) return

      const providerConfig = await this.getResolvedConfig(order.user_id)
      const providerToken = providerConfig?.mercadopago?.access_token

      // 3. Verificar estado final con el token del proveedor
      const finalPayment = (await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      }).then(r => r.json())) as any

      if (finalPayment.status === 'approved') {
        logger.info(`[MP-WEBHOOK] Pago APROBADO para pedido ${orderId}`)
        
        const { rows: updateRows } = await db.query(
          `UPDATE orders SET payment_status = 'paid', status = 'preparando', updated_at = NOW() 
           WHERE id = $1 AND payment_status <> 'paid' RETURNING *`,
          [orderId]
        )
        
        if (updateRows.length > 0) {
          await this.handlePostPaymentAutomation(updateRows[0])
        }
      }
    } catch (error: any) {
      logger.error('[MP-WEBHOOK] Error procesando:', error.message)
    }
  }

  /**
   * Verifica si un proveedor está listo para vender (Seguridad Industrial)
   */
  async isProviderReady(userId: string): Promise<boolean> {
    try {
      const config = await this.getResolvedConfig(userId)
      if (!config) return false

      // Un proveedor está listo si tiene:
      // 1. Una pasarela configurada (MP, Izipay o Culqi)
      // 2. O tiene Gmail conectado para validar Yape/Plin manualmente
      const hasMP = !!config.mercadopago?.access_token
      const hasIzipay = !!config.izipay?.shop_id && !!config.izipay?.password
      const hasCulqi = !!config.culqi?.secret_key
      const hasGmail = !!(config as any).gmail?.refreshToken
      const hasManual = !!config.manual?.yape_qr || !!config.manual?.plin_qr || !!config.manual?.yape_phone || !!config.manual?.plin_phone

      return hasMP || hasIzipay || hasCulqi || hasGmail || hasManual
    } catch (e) {
      return false
    }
  }

  private async handlePostPaymentAutomation(order: any) {
    // 1. Sincronización Automática de Stock (Módulo Industrial)
    const products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products
    if (products && Array.isArray(products)) {
      logger.info(`[STOCK-SYNC] Reduciendo stock para pedido ${order.id}...`)
      for (const item of products) {
        if (item.id) {
          await productService.decrementStock(item.id, item.quantity || 1)
        }
      }
    }

    // 2. Generación de Recibo PDF Profesional
    let receiptPath = ''
    try {
      const { rows: providerRows } = await db.query('SELECT name FROM users WHERE id = $1', [order.user_id])
      const storeName = providerRows[0]?.name || 'Tienda Atines'

      receiptPath = await receiptGeneratorService.generateReceiptPDF({
        orderId: order.id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        items: products.map((p: any) => ({ name: p.name, quantity: p.quantity, price: p.price })),
        total: Number(order.total),
        date: new Date(),
        storeName: storeName,
        paymentMethod: order.payment_method || 'transferencia'
      })
      logger.info(`[RECEIPT] Boleta PDF generada en: ${receiptPath}`)
    } catch (e) {
      logger.error('[RECEIPT] Error generando boleta:', e as any)
    }

    // 3. Notificaciones (Email / WhatsApp)
    // Email de confirmación con PDF adjunto
    if (order.customer_email) {
      const attachments = receiptPath ? [{ filename: `Recibo-${order.id.slice(0,8)}.pdf`, path: receiptPath }] : []
      
      emailService.sendEmail({
        to: order.customer_email,
        subject: `✅ Pago Confirmado - Pedido #${order.payment_reference_code || order.id.slice(0,8)}`,
        html: `<h2>¡Pago Confirmado!</h2><p>Gracias por tu compra. Adjunto encontrarás el recibo de tu pedido #${order.id}.</p>`,
        attachments
      }).catch(e => logger.warn('Error sending payment email:', e))
    }

    // WhatsApp Business (Notificación + Documento PDF)
    if (order.user_id && order.customer_phone) {
      try {
        const config = await whatsappService.getResolvedConfig(order.user_id)
        if (config) {
          // A. Enviar texto de confirmación
          await whatsappService.sendPaymentConfirmation(config, order.customer_phone, order.id)
          
          // B. Enviar PDF de la boleta definitiva como documento
          if (receiptPath && fs.existsSync(receiptPath)) {
             const { whatsappRouter } = await import('../../../services/whatsappRouter.service')
             const caption = `📄 Aquí tienes tu comprobante oficial de pago para el pedido #${order.id.substring(0, 8)}. ¡Gracias por tu compra! 🙌`
             await whatsappRouter.sendMedia(order.user_id, order.customer_phone, receiptPath, caption).catch(err => {
                logger.error('[WhatsApp-PostPayment] Error enviando comprobante PDF:', err.message)
             })
          }
        }
      } catch (e) { 
        logger.warn('[WhatsApp] Error en notificación post-pago:', e as any) 
      }
    }
  }
}

export const paymentService = new PaymentService()
