import { Request, Response } from 'express'
import { whatsappDomainService } from './service'

export class WhatsAppController {
  async testBusiness(req: Request, res: Response) {
    try {
      const result = await whatsappDomainService.testBusinessConnection(req.body)
      if (result.success) res.json(result)
      else res.status(400).json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async getStatus(req: Request, res: Response) {
    try {
      const status = await whatsappDomainService.getWebStatus(req.user!.id)
      res.json({ success: true, ...status })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async startSession(req: Request, res: Response) {
    try {
      const { usePairingCode, phone } = req.body
      const result = await whatsappDomainService.startSession(req.user!.id, usePairingCode, phone)
      res.json({ success: true, ...result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async disconnect(req: Request, res: Response) {
    try {
      await whatsappDomainService.disconnectWeb(req.user!.id)
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getBotEnabled(req: Request, res: Response) {
    try {
      const enabled = await whatsappDomainService.getBotEnabled(req.user!.id)
      res.json({ success: true, enabled })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async patchBotEnabled(req: Request, res: Response) {
    try {
      const { enabled } = req.body
      if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' })
      const result = await whatsappDomainService.setBotEnabled(req.user!.id, enabled)
      res.json({ success: true, enabled: result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getChats(req: Request, res: Response) {
    try {
      const chats = await whatsappDomainService.getChatList(req.user!.id)
      res.json({ success: true, chats })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const { phone } = req.params
      if (!phone) return res.status(400).json({ error: 'phone is required' })
      const profile = await whatsappDomainService.getCustomerProfile(req.user!.id, phone)
      res.json({ success: true, profile })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getAvatar(req: Request, res: Response) {
    try {
      const { phone } = req.params
      if (!phone) return res.status(400).json({ error: 'phone is required' })
      const avatar = await whatsappDomainService.getCustomerAvatar(req.user!.id, phone)
      res.json({ success: true, avatarUrl: avatar.avatarUrl })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const { phone } = req.params
      if (!phone) return res.status(400).json({ error: 'phone is required' })
      const messages = await whatsappDomainService.getChatMessages(req.user!.id, phone)
      res.json({ success: true, messages })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async deleteMessage(req: Request, res: Response) {
    try {
      const { id } = req.params
      await whatsappDomainService.deleteMessage(req.user!.id, id)
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async clearChat(req: Request, res: Response) {
    try {
      const { phone } = req.params
      await whatsappDomainService.clearChat(req.user!.id, phone)
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const { to, message, mediaUrl } = req.body
      if (!to) return res.status(400).json({ error: 'to is required' })
      
      const { whatsappRouter } = await import('../../../services/whatsappRouter.service.js')
      
      let success = false
      if (mediaUrl) {
         success = await whatsappRouter.sendMedia(req.user!.id, to, mediaUrl, message || '')
      } else {
         if (!message) return res.status(400).json({ error: 'message is required if no media' })
         success = await whatsappRouter.sendMessage(req.user!.id, to, message)
      }
      
      res.json({ success })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * GET /api/whatsapp/webhook
   * Verificación de Webhook de Meta
   */
  async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    const verifyToken = process.env.META_WABA_WEBHOOK_VERIFY_TOKEN || 'atines_global_secret'

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook de Meta Verificado!')
      res.status(200).send(challenge)
    } else {
      res.sendStatus(403)
    }
  }

  /**
   * POST /api/whatsapp/webhook
   * Recepción de mensajes de Meta
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      // Respondemos de inmediato a Meta para evitar timeouts
      res.status(200).send('OK')

      const body = req.body
      if (body.object === 'whatsapp_business_account') {
        const { whatsappService } = await import('../../../services/whatsapp.service.js')
        await whatsappService.handleIncomingWebhook(body)
      }
    } catch (error: any) {
      console.error('[Webhook] Error procesando:', error.message)
    }
  }
  async registerIntent(req: Request, res: Response) {
    try {
      const { customerPhone, providerId } = req.body
      if (!customerPhone || !providerId) return res.status(400).json({ error: 'customerPhone and providerId are required' })
      
      const success = await whatsappDomainService.registerIntent(customerPhone, providerId)
      res.json({ success })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * PATCH /chats/:phone/bot-pause
   * Pausa o reactiva la IA para un cliente específico
   */
  async toggleBotPauseForChat(req: Request, res: Response) {
    try {
      const { phone } = req.params
      const { pause } = req.body
      if (typeof pause !== 'boolean') return res.status(400).json({ error: 'pause must be boolean' })
      const result = await whatsappDomainService.toggleBotPause(req.user!.id, phone, pause)
      res.json({ success: true, paused: result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /chats/pause-statuses
   * Devuelve el estado de pausa para un array de teléfonos
   */
  async getChatPauseStatuses(req: Request, res: Response) {
    try {
      const { phones } = req.body
      if (!Array.isArray(phones)) return res.status(400).json({ error: 'phones must be an array' })
      const statuses = await whatsappDomainService.getChatPauseStatuses(req.user!.id, phones)
      res.json({ success: true, statuses })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const whatsappController = new WhatsAppController()
