import { whatsappWebManager } from '../../../services/whatsappWeb.service'
import { whatsappService as waBusinessService } from '../../../services/whatsapp.service'

export class WhatsAppDomainService {
  async testBusinessConnection(config: { apiUrl: string; phoneNumberId: string; accessToken: string }) {
    return await waBusinessService.testConnection(config)
  }

  async getWebStatus(userId: string) {
    try {
      // Si ya hay sesión activa, leerla sin reinicializar
      const existing = (whatsappWebManager as any).sessions?.get(userId)
      if (existing) {
        return { status: existing.status, qr: existing.qr, code: existing.code }
      }
      return { status: 'disconnected', qr: undefined, code: undefined }
    } catch (e) {
      return { status: 'disconnected', qr: undefined, code: undefined }
    }
  }

  async startSession(userId: string, usePairingCode?: boolean, phone?: string) {
    // Fuerza la creación de una nueva sesión (o reanuda la existente)
    const session = await whatsappWebManager.getSession(userId, usePairingCode, phone)
    return { status: session.status, qr: session.qr, code: session.code }
  }

  async disconnectWeb(userId: string) {
    await whatsappWebManager.disconnect(userId)
    return true
  }

  async getBotEnabled(userId: string) {
    return whatsappWebManager.getBotEnabled(userId)
  }

  async setBotEnabled(userId: string, enabled: boolean) {
    whatsappWebManager.setBotEnabled(userId, enabled)
    return enabled
  }

  async getChatList(userId: string) {
    const { db } = await import('../../../database/db.js')
    const { rows } = await db.query(`
      SELECT DISTINCT ON (customer_phone) 
        customer_phone, 
        message_body as last_message, 
        created_at as last_message_at,
        direction as last_direction,
        customer_pushname,
        media_type as last_media_type,
        (SELECT customer_name FROM orders WHERE customer_phone = m.customer_phone ORDER BY created_at DESC LIMIT 1) as customer_name
      FROM whatsapp_messages m
      WHERE user_id = $1 
      ORDER BY customer_phone, created_at DESC
    `, [userId])
    
    // Ordenar por fecha del último mensaje descendente
    return rows.sort((a, b) => b.last_message_at.getTime() - a.last_message_at.getTime())
  }

  async getChatMessages(userId: string, customerPhone: string) {
    const { db } = await import('../../../database/db.js')
    
    let phoneA = customerPhone
    let phoneB = customerPhone.replace(/\D/g, '')
    let phoneC = customerPhone

    const suffix9 = phoneB.slice(-9)
    if (suffix9.length === 9) {
      if (phoneB.length > 13) {
        // Querying with LID: search for a real number ending in this suffix
        const { rows: matchRows } = await db.query(
          `SELECT DISTINCT customer_phone FROM whatsapp_messages 
           WHERE user_id = $1 AND customer_phone LIKE $2 AND LENGTH(customer_phone) <= 13 LIMIT 1`,
          [userId, `%${suffix9}`]
        )
        if (matchRows.length > 0) {
          phoneC = matchRows[0].customer_phone
        }
      } else {
        // Querying with real phone: search for a Meta LID ending in this suffix
        const { rows: matchRows } = await db.query(
          `SELECT DISTINCT customer_phone FROM whatsapp_messages 
           WHERE user_id = $1 AND customer_phone LIKE $2 AND LENGTH(customer_phone) > 13 LIMIT 1`,
          [userId, `%${suffix9}`]
        )
        if (matchRows.length > 0) {
          phoneC = matchRows[0].customer_phone
        }
      }
    }

    const { rows } = await db.query(`
      SELECT 
        id, 
        message_body as body, 
        direction, 
        source, 
        status, 
        created_at,
        media_url,
        media_type
      FROM whatsapp_messages 
      WHERE user_id = $1 AND (customer_phone = $2 OR customer_phone = $3 OR customer_phone = $4)
      ORDER BY created_at ASC
    `, [userId, phoneA, phoneB, phoneC])
    return rows
  }

  async deleteMessage(userId: string, messageId: string) {
    const { db } = await import('../../../database/db.js')
    await db.query('DELETE FROM whatsapp_messages WHERE user_id = $1 AND id = $2', [userId, messageId])
    return true
  }

  async clearChat(userId: string, customerPhone: string) {
    const { db } = await import('../../../database/db.js')
    await db.query('DELETE FROM whatsapp_messages WHERE user_id = $1 AND customer_phone = $2', [userId, customerPhone])
    return true
  }

  async getCustomerProfile(userId: string, customerPhone: string) {
    const { db } = await import('../../../database/db.js')
    const { rows: stats } = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_spent,
        COALESCE(SUM(pending_amount), 0) as total_pending
      FROM orders
      WHERE user_id = $1 AND customer_phone = $2
    `, [userId, customerPhone])

    const { rows: lastOrders } = await db.query(`
      SELECT id, status, total, pending_amount, created_at, shipping_type
      FROM orders
      WHERE user_id = $1 AND customer_phone = $2
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId, customerPhone])

    return {
      stats: stats[0],
      lastOrders
    }
  }

  async getCustomerAvatar(userId: string, customerPhone: string) {
    const url = await whatsappWebManager.getProfilePicUrl(userId, customerPhone)
    return { avatarUrl: url }
  }
  async registerIntent(customerPhone: string, userId: string) {
    const { whatsappService } = await import('../../../services/whatsapp.service.js')
    return await whatsappService.registerIntent(customerPhone, userId)
  }

  /**
   * Activa o desactiva la pausa manual de la IA para un cliente específico.
   * pause=true  → IA silenciada solo para ese cliente
   * pause=false → IA reactivada solo para ese cliente
   */
  async toggleBotPause(userId: string, customerPhone: string, pause: boolean): Promise<boolean> {
    const { conversationStateService } = await import('../../../services/conversationState.service.js')
    await conversationStateService.setManualPause(userId, customerPhone, pause)
    return pause
  }

  /**
   * Devuelve el estado de pausa manual para un conjunto de teléfonos
   */
  async getChatPauseStatuses(userId: string, phones: string[]): Promise<Record<string, boolean>> {
    const { conversationStateService } = await import('../../../services/conversationState.service.js')
    const results: Record<string, boolean> = {}
    await Promise.all(phones.map(async (phone) => {
      results[phone] = await conversationStateService.isManuallyPaused(userId, phone)
    }))
    return results
  }
}

export const whatsappDomainService = new WhatsAppDomainService()
