// Servicio de WhatsApp Business API
// Este servicio maneja el envío de mensajes a través de WhatsApp Business API
import { db } from '../database/db'
import { encryption } from '../api/utils/encryption'
import { whatsappRouter } from './whatsappRouter.service'
import { logger } from '../api/utils/logger'
import { io } from '../api/server'
import { aiOrchestrator } from './aiOrchestrator.service'
import { whatsappWebManager } from './whatsappWeb.service'
import { conversationStateService } from './conversationState.service'

interface WhatsAppConfig {
  apiUrl: string // URL de la API de WhatsApp Business (ej: https://graph.facebook.com/v18.0)
  phoneNumberId: string // ID del número de teléfono de WhatsApp Business
  accessToken: string // Token de acceso de WhatsApp Business API
  businessAccountId?: string // ID de la cuenta de negocio (opcional)
  source?: 'provider_api' | 'admin_api'
}

interface WhatsAppMessage {
  to: string // Número de teléfono del destinatario (formato: 51987654321)
  message: string // Mensaje a enviar
  template?: string // Nombre de la plantilla (si se usa)
  parameters?: string[] // Parámetros para la plantilla
  document?: {
    link: string // URL pública del PDF
    filename?: string // Nombre del archivo (ej: boleta.pdf)
  }
  image?: {
    link: string // URL pública de la imagen
  }
}

class WhatsAppService {
  constructor() {
    this.initDB()
  }

  async initDB() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID,
            user_id UUID,
            customer_phone TEXT NOT NULL,
            message_body TEXT NOT NULL,
            direction VARCHAR(20) DEFAULT 'outgoing',
            source VARCHAR(50) DEFAULT 'admin_api',
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            sent_at TIMESTAMP WITH TIME ZONE
        )
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_routing_intents (
            customer_phone TEXT PRIMARY KEY,
            user_id UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
      logger.info('🛰️ WhatsApp Bunker: Sistema de persistencia y enrutamiento listo.')
      
      // Iniciar trabajador de recuperación cada 15 minutos
      setInterval(() => this.processPendingQueue(), 15 * 60 * 1000)

      // Limpiar intenciones de enrutamiento cada 30 minutos (borrar > 24h)
      setInterval(async () => {
        try {
          await db.query("DELETE FROM whatsapp_routing_intents WHERE created_at < NOW() - INTERVAL '24 hours'")
        } catch (e) {}
      }, 30 * 60 * 1000)
    } catch (e: any) {
      logger.error('[WhatsApp] Error init DB:', { error: e.message })
    }
  }

  /**
   * Trabajador de Recuperación: Reintenta enviar mensajes fallidos
   */
  async processPendingQueue() {
    try {
      logger.info('🔄 [WhatsApp] Ejecutando trabajador de recuperación de mensajes...')
      
      // Buscar mensajes fallidos con menos de 3 reintentos en las últimas 24h
      const { rows } = await db.query(
        `SELECT * FROM whatsapp_messages 
         WHERE status = 'failed' 
         AND retry_count < 3 
         AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 10`
      )

      for (const msg of rows) {
        logger.info(`[WhatsApp] Reintentando mensaje ${msg.id} (Intento ${msg.retry_count + 1})`)
        
        // Resolver configuración actual (por si el proveedor cambió sus claves)
        const config = await this.getResolvedConfig(msg.user_id)
        if (!config) continue

        const success = await this.sendMessage(
          config, 
          { to: msg.customer_phone, message: msg.message_body },
          msg.user_id,
          msg.order_id,
          true // skipPersistence: true para evitar duplicados en reintentos
        )

        if (success) {
          // Marcar como recuperado
          await db.query('DELETE FROM whatsapp_messages WHERE id = $1', [msg.id])
        } else {
          // Incrementar contador de reintentos
          await db.query('UPDATE whatsapp_messages SET retry_count = retry_count + 1 WHERE id = $1', [msg.id])
        }
      }
    } catch (e) {
      logger.error('[WhatsApp] Error en RetryWorker:', e as any)
    }
  }
  /**
   * Resuelve la configuración a usar para un usuario específico.
   * Prioridad: Configuración de Usuario (DB) > Configuración Global (.env)
   */
  async getResolvedConfig(userId: string): Promise<WhatsAppConfig | null> {
    try {
      const { rows } = await db.query('SELECT whatsapp_config FROM users WHERE id = $1', [userId])
      const userConfig = rows[0]?.whatsapp_config

      // 1. Si el usuario tiene configuración propia de WhatsApp (Multi-tenant SaaS)
      if (userConfig && userConfig.access_token && userConfig.phone_number_id) {
        let token = userConfig.access_token
        
        // Desencriptación industrial (Seguridad Atines)
        if (token.includes(':')) {
          token = encryption.decrypt(token)
        }

        const apiVersion = userConfig.api_version || 'v19.0'
        
        return {
          apiUrl: `https://graph.facebook.com/${apiVersion}`,
          phoneNumberId: userConfig.phone_number_id,
          accessToken: token,
          businessAccountId: userConfig.business_account_id,
          source: 'provider_api'
        }
      }

      // 2. Fallback a configuración global del sistema (.env)
      if (process.env.META_SYSTEM_ACCESS_TOKEN) {
        return {
          apiUrl: 'https://graph.facebook.com/v19.0',
          phoneNumberId: process.env.META_SYSTEM_PHONE_NUMBER_ID || '',
          accessToken: process.env.META_SYSTEM_ACCESS_TOKEN,
          source: 'admin_api'
        }
      }

      return null
    } catch (error) {
      logger.error('[WhatsApp] Error resolviendo configuración:', error as any)
      return null
    }
  }

  /**
   * Envía un mensaje de texto a través de WhatsApp Business API (Persistente)
   */
  async sendMessage(config: WhatsAppConfig, message: WhatsAppMessage, userId?: string, orderId?: string, skipPersistence: boolean = false): Promise<boolean> {
    let messageId = null
    
    if (!skipPersistence) {
      try {
        const { rows } = await db.query(
          `INSERT INTO whatsapp_messages (user_id, order_id, customer_phone, message_body, status)
           VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
          [userId || null, orderId || null, message.to, message.message]
        )
        messageId = rows[0].id
      } catch (e) {
        logger.error('[WhatsApp] Error persistiendo mensaje:', e as any)
      }
    }

    const success = await this.performTransport(config, message)

    if (messageId) {
      if (success) {
        await db.query(
          `UPDATE whatsapp_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [messageId]
        )
        
        // Sincronización en Tiempo Real con el Panel (Industrial)
        if (userId) {
          io.to(`user_${userId}`).emit('whatsapp_message', {
            userId,
            customerPhone: message.to.replace(/\D/g, ''),
            body: message.message,
            timestamp: Date.now(),
            type: 'outgoing',
            source: 'bot',
            status: 'sent'
          })
        }
      } else {
        await db.query(
          `UPDATE whatsapp_messages SET status = 'failed', error_message = 'Error en transporte API Meta' WHERE id = $1`,
          [messageId]
        )
      }
    }

    return success
  }

  /**
   * Envía un documento (PDF, Imagen, etc) a través de WhatsApp (Persistente)
   */
  async sendDocument(config: WhatsAppConfig, to: string, link: string, filename: string, caption?: string, userId?: string): Promise<boolean> {
    return this.sendMessage(config, {
      to,
      message: caption || '',
      document: { link, filename }
    }, userId)
  }

  /**
   * Ejecuta el envío real a la API de Meta (Capa de Transporte)
   */
  private async performTransport(config: WhatsAppConfig, message: WhatsAppMessage): Promise<boolean> {
    try {
      const url = `${config.apiUrl}/${config.phoneNumberId}/messages`
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(message.to),
      }

      if (message.template) {
        payload.type = 'template'
        payload.template = { name: message.template, language: { code: 'es' } }
        if (message.parameters && message.parameters.length > 0) {
          payload.template.components = [
            {
              type: 'body',
              parameters: message.parameters.map((param) => ({ type: 'text', text: param })),
            },
          ]
        }
      } else if (message.document) {
        payload.type = 'document'
        payload.document = {
          link: message.document.link,
          filename: message.document.filename || 'archivo.pdf',
          caption: message.message
        }
      } else if (message.image) {
        payload.type = 'image'
        payload.image = {
          link: message.image.link,
          caption: message.message
        }
      } else {
        payload.type = 'text'
        payload.text = { preview_url: false, body: message.message }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      return response.ok
    } catch (error) {
      logger.error('[WhatsApp] Error en transporte Meta API:', error as any)
      return false
    }
  }

  /**
   * Envía una imagen nativa a través de WhatsApp (Persistente)
   */
  async sendImage(config: WhatsAppConfig, to: string, link: string, caption?: string, userId?: string): Promise<boolean> {
    return this.sendMessage(config, {
      to,
      message: caption || '',
      image: { link }
    }, userId)
  }

  /**
   * Envía una notificación de nuevo pedido al proveedor
   */
  async sendOrderNotification(
    config: WhatsAppConfig,
    providerPhone: string,
    orderDetails: {
      orderId: string
      customerName: string
      total: number
      products: Array<{ name: string; quantity: number }>
    }
  ): Promise<boolean> {
    const productsList = orderDetails.products
      .map((p) => `• ${p.name} (x${p.quantity})`)
      .join('\n')

    const message = `🛒 *Nuevo Pedido Recibido*

📦 *Pedido #${orderDetails.orderId}*

👤 Cliente: ${orderDetails.customerName}
💰 Total: S/. ${orderDetails.total.toFixed(2)}

📋 *Productos:*
${productsList}

Revisa el panel de administración para gestionar este pedido.`

    return this.sendMessage(config, {
      to: providerPhone,
      message,
    })
  }

  /**
   * Envía una notificación de confirmación de pedido al cliente
   */
  async sendOrderConfirmation(
    config: WhatsAppConfig,
    customerPhone: string,
    orderDetails: {
      orderId: string
      total: number
      paymentMethod: string
      referenceCode?: string
    }
  ): Promise<boolean> {
    const message = `✅ *¡Pedido Confirmado!*

Gracias por tu compra. Tu pedido #${orderDetails.orderId} ha sido recibido.

💰 Total: S/. ${orderDetails.total.toFixed(2)}
💳 Método de pago: ${orderDetails.paymentMethod.toUpperCase()}
${orderDetails.referenceCode ? `🔢 Código de referencia: *${orderDetails.referenceCode}*` : ''}

Tu pedido está siendo procesado. Te notificaremos cuando esté listo para envío.`

    return this.sendMessage(config, {
      to: customerPhone,
      message,
    })
  }

  /**
   * Envía una notificación de confirmación de pago
   */
  async sendPaymentConfirmation(
    config: WhatsAppConfig,
    customerPhone: string,
    orderId: string
  ): Promise<boolean> {
    const message = `✅ *Pago Confirmado*

Tu pago para el pedido #${orderId} ha sido confirmado exitosamente.

El pedido está siendo preparado. Te notificaremos cuando esté listo para envío.`

    return this.sendMessage(config, {
      to: customerPhone,
      message,
    })
  }

  /**
   * Envía una notificación de cambio de estado logístico (Rastreo)
   */
  async sendTrackingUpdate(
    config: WhatsAppConfig,
    customerPhone: string,
    trackingDetails: {
      orderId: string
      status: string
      agency: string
      guideNumber: string
    }
  ): Promise<boolean> {
    const message = `🚚 *Actualización de tu Pedido*
    
Tu pedido #${trackingDetails.orderId.slice(0, 8)} tiene un nuevo estado en *${trackingDetails.agency.toUpperCase()}*:

📍 Estado: *${trackingDetails.status.toUpperCase()}*
🔢 Guía: ${trackingDetails.guideNumber}

Puedes realizar el seguimiento detallado desde nuestro portal o en la web de la agencia.`

    return this.sendMessage(config, {
      to: customerPhone,
      message,
    }, undefined, trackingDetails.orderId)
  }

  /**
   * Formatea el número de teléfono al formato requerido por WhatsApp (sin +, sin espacios)
   */
  private formatPhoneNumber(phone: string): string {
    // Remover espacios, guiones, paréntesis y el signo +
    return phone.replace(/[\s\-\(\)\+]/g, '')
  }

  /**
   * Valida la configuración de WhatsApp
   */
  validateConfig(config: WhatsAppConfig): { valid: boolean; error?: string } {
    if (!config.apiUrl) {
      return { valid: false, error: 'API URL de WhatsApp no configurada' }
    }
    if (!config.phoneNumberId) {
      return { valid: false, error: 'Phone Number ID no configurado' }
    }
    if (!config.accessToken) {
      return { valid: false, error: 'Access Token no configurado' }
    }

    // Validar formato de API URL
    if (!config.apiUrl.startsWith('https://')) {
      return { valid: false, error: 'API URL debe comenzar con https://' }
    }

    return { valid: true }
  }

  /**
   * Prueba la conexión con WhatsApp Business API
   */
  async testConnection(config: WhatsAppConfig): Promise<{ success: boolean; message: string }> {
    const validation = this.validateConfig(config)
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Configuración inválida' }
    }

    try {
      // Intentar obtener información del número de teléfono
      const url = `${config.apiUrl}/${config.phoneNumberId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      })

      if (!response.ok) {
        const error: any = await response.json().catch(() => ({ error: 'Error desconocido' }))
        return {
          success: false,
          message: error.error?.message || 'Error al conectar con WhatsApp Business API',
        }
      }

      const data: any = await response.json()
      return {
        success: true,
        message: `✅ Conexión exitosa. Número: ${data.display_phone_number || 'N/A'}`,
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error de conexión: ${error.message}`,
      }
    }
  }

  /**
   * Envía un documento PDF (Boleta/Factura) al cliente
   */

  /**
   * Procesa el Webhook de Meta para mensajes entrantes
   */
  async handleIncomingWebhook(body: any) {
    try {
      const entry = body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages
      const metadata = value?.metadata

      if (!messages || !messages[0] || !metadata) return

      const msg = messages[0]
      const phone_number_id = metadata.phone_number_id
      const customerPhone = msg.from
      const customerName = value.contacts?.[0]?.profile?.name || 'Cliente Meta'
      
      let messageBody = msg.text?.body || ''
      let mediaUrl: string | null = null
      let mediaType: string | null = null
      let userId: string | null = null

      // 🖼️ MANEJO DE MULTIMEDIA (Imágenes, PDFs, etc.)
      const msgType = msg.type
      if (msgType !== 'text') {
        const mediaObj = msg[msgType]
        if (mediaObj && mediaObj.id) {
          mediaType = msgType
          if (mediaObj.caption) messageBody = mediaObj.caption
          
          // Obtener configuración para descargar el medio
          // Primero intentamos por phone_number_id, si no, usamos el Admin para la descarga
          const { rows: configRows } = await db.query(
            "SELECT id, whatsapp_config FROM users WHERE whatsapp_config->>'phone_number_id' = $1",
            [phone_number_id]
          )
          
          const tempUserId = configRows[0]?.id || 'admin'
          const config = await this.getResolvedConfig(tempUserId)
          
          if (config) {
            logger.info(`[Media] Descargando ${msgType} (ID: ${mediaObj.id})...`)
            mediaUrl = await this.downloadMedia(mediaObj.id, config)
          }
        }
      }

      if (!messageBody && !mediaUrl) {
          messageBody = `[Archivo ${msgType} recibido]`
      }

      const refMatch = messageBody.match(/REF:([a-fA-F0-9-]{36})/)
      if (refMatch) {
        userId = refMatch[1]
      }

      if (!userId) {
        const { rows } = await db.query(
          "SELECT id FROM users WHERE whatsapp_config->>'phone_number_id' = $1",
          [phone_number_id]
        )
        userId = rows[0]?.id
      }
      
      // 🚀 MEJORA INDUSTRIAL: Enrutamiento Inteligente por Contexto e Intención
      if (!userId && phone_number_id === process.env.META_SYSTEM_PHONE_NUMBER_ID) {
        const { rows: intentRows } = await db.query(`
          SELECT user_id FROM whatsapp_routing_intents 
          WHERE customer_phone = $1 AND created_at > NOW() - INTERVAL '1 hour'
          LIMIT 1
        `, [customerPhone.replace(/\D/g, '')])

        if (intentRows[0]?.user_id) {
          userId = intentRows[0].user_id
        } else {
          const { rows: contextRows } = await db.query(`
            SELECT user_id FROM whatsapp_messages 
            WHERE customer_phone = $1 AND user_id IS NOT NULL AND user_id::text != 'admin'
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC LIMIT 1
          `, [customerPhone])

          if (contextRows[0]?.user_id) {
            userId = contextRows[0].user_id
          } else {
            const { rows: orderRows } = await db.query(`
              SELECT user_id FROM orders 
              WHERE (customer_phone = $1 OR customer_phone LIKE $2)
              ORDER BY created_at DESC LIMIT 1
            `, [customerPhone, `%${customerPhone.replace(/\D/g, '').slice(-9)}`])
            userId = orderRows[0]?.user_id || 'admin'
          }
        }
      }

      if (!userId) return

      // 2. Persistencia y Socket
      const isFromAdminChannel = phone_number_id === process.env.META_SYSTEM_PHONE_NUMBER_ID
      const source = isFromAdminChannel ? 'admin_api' : 'provider_api'

      await db.query(
        `INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_url, media_type)
         VALUES ($1, $2, $3, 'incoming', $4, 'received', $5, $6, $7)`,
        [userId, customerPhone, messageBody, source, customerName, mediaUrl, mediaType]
      )

      io.to(`user_${userId}`).emit('whatsapp_message', {
        userId,
        customerPhone: customerPhone.replace(/\D/g, ''),
        body: messageBody,
        timestamp: Date.now(),
        type: 'incoming',
        source,
        pushname: customerName,
        mediaUrl,
        mediaType
      })

      // 3. Respuesta Automática (Bot de IA)
      // ⚠️ ESCUDO ANTI-DUPLICADOS ESTRUCTURAL:
      // Si el proveedor tiene WhatsApp Web conectado, el evento 'message' de wwebjs
      // se encargará de responder. Si el webhook también responde, habrá respuestas dobles.
      const isWebConnected = whatsappWebManager.getSessionSync(userId)?.status === 'connected'
      
      if (!isWebConnected) {
        const isPaused = await conversationStateService.isPaused(userId, customerPhone)
        const botEnabled = whatsappWebManager.getBotEnabled(userId)
        
        if (botEnabled && !isPaused) {
          const aiResponse = await aiOrchestrator.handleIncomingMessage(userId, customerPhone, messageBody)
          if (aiResponse) {
            const { whatsappRouter } = await import('./whatsappRouter.service.js')
            
            // 1. Enviar el texto si existe
            if (aiResponse.text) {
              await whatsappRouter.sendMessage(userId, customerPhone, aiResponse.text)
            }

            // 2. Lógica de MEDIA (Imágenes/Videos/Documentos/QR/Boletas)
            if (aiResponse.media && !aiResponse.actions?.includes('SEND_PDF')) {
              const mediaList = Array.isArray(aiResponse.media) ? aiResponse.media : [aiResponse.media]
              for (const mediaItem of mediaList) {
                try {
                  await whatsappRouter.sendMedia(userId, customerPhone, mediaItem)
                } catch (mediaErr: any) {
                  logger.error('[Webhook-Bot] Error enviando media:', mediaErr.message)
                }
              }
            }

            // 3. Lógica de PDF (Doble Catálogo Industrial)
            if (aiResponse.actions?.includes('SEND_PDF')) {
              try {
                const { cataloguePDFService } = await import('./cataloguePDF.service')
                
                // Verificar existencia de ambos tipos de productos
                const { rows: types } = await db.query(
                  "SELECT DISTINCT catalog_type FROM products WHERE user_id = $1 AND stock > 0",
                  [userId]
                )
                const hasNational = types.some(t => t.catalog_type === 'national')
                const hasGlobal = types.some(t => t.catalog_type === 'global')

                // Generar y enviar Nacional si existe
                if (hasNational) {
                  const pdfPath = await cataloguePDFService.generatePDF(userId, 'national')
                  const captionText = '🛍️ *CATÁLOGO NACIONAL* (Entrega Inmediata)'
                  await whatsappRouter.sendMedia(userId, customerPhone, pdfPath, captionText)
                }

                // Generar y enviar Global si existe
                if (hasGlobal) {
                  const pdfPath = await cataloguePDFService.generatePDF(userId, 'global')
                  const captionText = '✈️ *CATÁLOGO GLOBAL* (Importaciones)'
                  await whatsappRouter.sendMedia(userId, customerPhone, pdfPath, captionText)
                }
              } catch (pdfError: any) {
                logger.error('[Webhook-Bot] Error enviando Catálogos Duales:', { error: pdfError?.message })
              }
            }
          }
        }
      }
    } catch (e: any) {
      logger.error('[Webhook] Error crítico:', e.message)
    }
  }

  /**
   * Obtiene el URL de descarga de un archivo multimedia desde Meta
   */
  async downloadMedia(mediaId: string, config: any): Promise<string | null> {
    try {
      const res = await fetch(`${config.apiUrl}/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${config.accessToken}` }
      })
      const data: any = await res.json()
      return data.url || null
    } catch (e) {
      logger.error('[Media] Error obteniendo URL:', e as any)
      return null
    }
  }

  async registerIntent(customerPhone: string, userId: string) {
    try {
      const cleanPhone = customerPhone.replace(/\D/g, '')
      await db.query(`
        INSERT INTO whatsapp_routing_intents (customer_phone, user_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (customer_phone) DO UPDATE SET user_id = $2, created_at = NOW()
      `, [cleanPhone, userId])
      return true
    } catch (e) {
      return false
    }
  }
}

export const whatsappService = new WhatsAppService()

