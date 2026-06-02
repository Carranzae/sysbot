import { whatsappWebManager } from './whatsappWeb.service'
import { whatsappService } from './whatsapp.service'
import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { io } from '../api/server'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * ENRUTADOR HÍBRIDO DE WHATSAPP (Patrón Adapter)
 * Decide automáticamente por qué canal enviar el mensaje dependiendo de
 * la configuración del proveedor (Meta API Oficial vs WhatsApp Web).
 */
export class WhatsAppRouter {
  
  /**
   * Determina la estrategia de envío para un proveedor específico
   */
  private async determineStrategy(userId: string): Promise<'meta_api' | 'whatsapp_web'> {
    try {
      // 1. PRIORIDAD MÁXIMA: WhatsApp Web del Proveedor (Celular personal)
      const session = await whatsappWebManager.getSession(userId).catch(() => null)
      if (session && session.status === 'connected') {
        return 'whatsapp_web'
      }

      return 'meta_api'
    } catch (e) {
      return 'meta_api'
    }
  }

  /**
   * Resuelve el número de teléfono del destinatario, soportando la resolución nativa de LIDs
   */
  private async resolveRecipientPhone(userId: string, to: string): Promise<string> {
    let cleanPhone = to.split('@')[0].replace(/\D/g, '')
    if (cleanPhone.length > 13) {
      // 1. Intentar por caché/base de datos (Heurística rápida)
      const suffix9 = cleanPhone.slice(-9)
      if (suffix9.length === 9) {
        const { rows } = await db.query(
          `SELECT DISTINCT customer_phone FROM whatsapp_messages
           WHERE user_id = $1 AND RIGHT(customer_phone, 9) = $2 AND LENGTH(customer_phone) <= 13
           LIMIT 1`,
          [userId, suffix9]
        )
        if (rows.length > 0) {
          logger.info(`[ROUTER-LID-DB] Resuelto LID ${cleanPhone} → ${rows[0].customer_phone} via base de datos`)
          return rows[0].customer_phone
        }
      }

      // 2. Intentar por resolución nativa del cliente WhatsApp Web activo
      try {
        const session = whatsappWebManager.getSessionSync(userId)
        if (session && session.status === 'connected' && session.client?.pupPage) {
          const rawNum = await session.client.pupPage.evaluate(async (lidJid) => {
            try {
              const wid = window.require('WAWebWidFactory').createWid(lidJid);
              const alt = window.require('WAWebApiContact').getAlternateUserWid(wid);
              return alt ? alt.user : null;
            } catch (err) {
              return null;
            }
          }, `${cleanPhone}@lid`)
          if (rawNum) {
            const realNum = rawNum.replace(/\D/g, '')
            if (realNum && realNum.length <= 13) {
              logger.info(`[ROUTER-LID-NATIVE] Resuelto LID ${cleanPhone} → ${realNum} via API nativa`)
              return realNum
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[ROUTER-LID-NATIVE] Error resolviendo LID alternativo: ${err.message || err}`)
      }
    }
    return cleanPhone
  }

  /**
   * Envía un mensaje de texto plano
   */
  async sendMessage(userId: string, to: string, message: string): Promise<boolean> {
    const strategy = await this.determineStrategy(userId)
    let success = false
    let source = ''

    if (strategy === 'meta_api') {
      const config = await whatsappService.getResolvedConfig(userId)
      if (!config) return false
      
      success = await whatsappService.sendMessage(config, { to, message }, userId)
      source = config.source || 'admin_api'
      
      if (success) {
        const resolvedPhone = await this.resolveRecipientPhone(userId, to)

        // Emitir al panel de chat en vivo con la etiqueta de origen (Solo para Meta Cloud API)
        io.to(`user_${userId}`).emit('whatsapp_message', {
          userId,
          customerPhone: resolvedPhone,
          body: message,
          timestamp: Date.now(),
          type: 'outgoing',
          source
        })

        // PERSISTENCIA INDUSTRIAL: Guardar mensaje saliente (Solo para Meta Cloud API)
        await db.query(`
          INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, sent_at)
          VALUES ($1, $2, $3, 'outgoing', $4, 'sent', NOW())
        `, [userId, resolvedPhone, message, source])
      }
    } else {
      // Para WhatsApp Web, dejamos que el evento nativo 'message_create' de Puppeteer maneje de forma única
      // y centralizada la persistencia y la emisión en tiempo real, garantizando 0 duplicidades.
      success = await whatsappWebManager.sendMessage(userId, to, message)
    }
    
    return success
  }

  /**
   * Envía un mensaje con imagen/video/documento
   */
  async sendMedia(userId: string, to: string, urlOrBase64: string, caption?: string): Promise<boolean> {
    const strategy = await this.determineStrategy(userId)
    let success = false
    let source = ''
    let mediaUrl = urlOrBase64
    let mediaType: 'image' | 'document' | 'audio' | 'video' = 'image'

    // ── PROCESAMIENTO DE BASE64 A ARCHIVO LOCAL ──
    if (urlOrBase64.startsWith('data:')) {
      try {
        const matches = urlOrBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const mimeType = matches[1]
          const base64Data = matches[2]
          const extension = mimeType.split('/')[1] || 'bin'
          const fileName = `media_${uuidv4()}.${extension}`
          const localPath = path.join(process.cwd(), 'uploads', 'chat', fileName)
          
          if (!fs.existsSync(path.dirname(localPath))) fs.mkdirSync(path.dirname(localPath), { recursive: true })
          fs.writeFileSync(localPath, Buffer.from(base64Data, 'base64'))
          
          // Construir URL pública para Meta API
          const BACKEND_URL = process.env.BACKEND_URL || `http://${process.env.IP_SERVER || process.env.HOST || 'localhost'}:4000`
          mediaUrl = `${BACKEND_URL}/uploads/chat/${fileName}`
          
          // Detectar tipo
          if (mimeType.includes('pdf') || mimeType.includes('document')) mediaType = 'document'
          else if (mimeType.includes('audio')) mediaType = 'audio'
          else if (mimeType.includes('video')) mediaType = 'video'
        }
      } catch (e) {
        logger.error('[Router] Error procesando Base64:', e as any)
      }
    } else {
        // Detectar por extensión si es URL
        if (urlOrBase64.toLowerCase().endsWith('.pdf')) mediaType = 'document'

        const isLocalPath = !urlOrBase64.startsWith('http') && !urlOrBase64.startsWith('data:')
        if (isLocalPath && strategy === 'meta_api') {
          const BACKEND_URL = process.env.BACKEND_URL || `http://${process.env.IP_SERVER || process.env.HOST || 'localhost'}:4000`
          const uploadsIndex = urlOrBase64.toLowerCase().indexOf('uploads')
          if (uploadsIndex !== -1) {
            const relativePath = urlOrBase64.substring(uploadsIndex).replace(/\\/g, '/')
            mediaUrl = `${BACKEND_URL}/${relativePath}`
          } else {
            const fileName = path.basename(urlOrBase64)
            mediaUrl = `${BACKEND_URL}/uploads/receipts/${fileName}`
          }
          logger.info(`[Router] Convertido path local ${urlOrBase64} a URL pública: ${mediaUrl}`)
        }
    }

    if (strategy === 'meta_api') {
      const config = await whatsappService.getResolvedConfig(userId)
      if (!config) return false
      source = config.source || 'admin_api'

      if (mediaType === 'document') {
        success = await whatsappService.sendDocument(config, to, mediaUrl, 'documento.pdf', caption || '', userId)
      } else {
        // Por ahora enviamos todo lo demás como imagen (o expandible a video/audio)
        success = await whatsappService.sendImage(config, to, mediaUrl, caption || '', userId)
      }
      
      if (success) {
        const resolvedPhone = await this.resolveRecipientPhone(userId, to)

        // Emitir al panel (Solo para Meta Cloud API)
        io.to(`user_${userId}`).emit('whatsapp_message', {
          userId,
          customerPhone: resolvedPhone,
          body: caption || `[Archivo ${mediaType}]`,
          timestamp: Date.now(),
          type: 'outgoing',
          source,
          mediaUrl,
          mediaType
        })

        // PERSISTENCIA (Solo para Meta Cloud API)
        await db.query(`
          INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, sent_at, media_url, media_type)
          VALUES ($1, $2, $3, 'outgoing', $4, 'sent', NOW(), $5, $6)
        `, [userId, resolvedPhone, caption || `[Archivo ${mediaType}]`, source, mediaUrl, mediaType])
      }
    } else {
      // Para WhatsApp Web, delegamos de forma única a 'message_create' de Puppeteer
      success = await whatsappWebManager.sendMedia(userId, to, mediaUrl, caption)
    }

    return success
  }

  /**
   * Notificación de confirmación de pedido
   */
  async sendOrderConfirmation(
    userId: string,
    customerPhone: string,
    orderDetails: { orderId: string, total: number, paymentMethod: string, referenceCode?: string }
  ): Promise<boolean> {
    const strategy = await this.determineStrategy(userId)
    
    if (strategy === 'meta_api') {
      const config = await whatsappService.getResolvedConfig(userId)
      if (!config) return false
      return await whatsappService.sendOrderConfirmation(config, customerPhone, orderDetails)
    } else {
      const msg = `✅ *¡Pedido Confirmado!*\n\nGracias por tu compra. Tu pedido #${orderDetails.orderId} ha sido recibido.\n\n💰 Total: S/. ${orderDetails.total.toFixed(2)}\n💳 Método de pago: ${orderDetails.paymentMethod.toUpperCase()}\n${orderDetails.referenceCode ? `🔢 Código de referencia: *${orderDetails.referenceCode}*` : ''}\n\nTu pedido está siendo procesado.`
      return await whatsappWebManager.sendMessage(userId, customerPhone, msg)
    }
  }

  /**
   * Notificación de confirmación de pago
   */
  async sendPaymentConfirmation(userId: string, customerPhone: string, orderId: string): Promise<boolean> {
    const strategy = await this.determineStrategy(userId)
    
    if (strategy === 'meta_api') {
      const config = await whatsappService.getResolvedConfig(userId)
      if (!config) return false
      return await whatsappService.sendPaymentConfirmation(config, customerPhone, orderId)
    } else {
      const msg = `✅ *Pago Confirmado*\n\nTu pago para el pedido #${orderId} ha sido confirmado exitosamente.\n\nEl pedido está siendo preparado. Te notificaremos cuando esté listo para envío.`
      return await whatsappWebManager.sendMessage(userId, customerPhone, msg)
    }
  }

  /**
   * Envía un documento (PDF, etc)
   */
  async sendDocument(userId: string, to: string, link: string, filename: string, caption?: string): Promise<boolean> {
    const strategy = await this.determineStrategy(userId)
    
    if (strategy === 'meta_api') {
      const config = await whatsappService.getResolvedConfig(userId)
      if (!config) return false
      return await whatsappService.sendDocument(config, to, link, filename, caption, userId)
    } else {
      try {
        await whatsappWebManager.sendMedia(userId, to, link, caption)
        return true
      } catch (e) {
        return false
      }
    }
  }
}

export const whatsappRouter = new WhatsAppRouter()
