import { Request, Response } from 'express'
import { paymentService } from './service'
import { config } from '../../../config/env'
import { logger } from '../../../api/utils/logger'
import { googleAuthService } from '../../../services/googleAuth.service'
import { db } from '../../../database/db'
import { encryption } from '../../../api/utils/encryption'

export class PaymentController {
  /**
   * POST /payments/validate
   */
  async validate(req: Request, res: Response) {
    try {
      const { orderId, securityCode, referenceCode } = req.body
      const user = (req as any).user
      const isAdmin = user?.role === 'admin_general'

      if (!orderId || !securityCode || !referenceCode) {
        return res.status(400).json({ error: 'Datos incompletos' })
      }

      const order = await paymentService.validateManualPayment(
        orderId, referenceCode, securityCode, user.id, isAdmin
      )

      res.json({ success: true, order })
    } catch (error: any) {
      logger.error('Error in PaymentController.validate:', error as any)
      res.status(error.message.includes('No autorizado') ? 403 : 400).json({ error: error.message })
    }
  }

  /**
   * POST /payments/mercadopago/create-preference
   */
  async createMPPreference(req: Request, res: Response) {
    try {
      const { orderId } = req.body
      if (!orderId) return res.status(400).json({ error: 'orderId es requerido' })

      const preference = await paymentService.createMPPreference(orderId)
      res.json({ success: true, ...preference })
    } catch (error: any) {
      logger.error('Error in createMPPreference:', error as any)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /payments/mercadopago/qr
   */
  async createMPQR(req: Request, res: Response) {
    try {
      const { orderId } = req.body
      if (!orderId) return res.status(400).json({ error: 'orderId es requerido' })

      const qrData = await paymentService.generateMPQR(orderId)
      res.json({ success: true, ...qrData })
    } catch (error: any) {
      logger.error('Error in createMPQR:', error as any)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /payments/culqi/order
   */
  async createCulqiOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.body
      const result = await paymentService.createCulqiOrder(orderId)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async processCulqiPayment(req: Request, res: Response) {
    try {
      const { orderId, culqiToken } = req.body
      const result = await paymentService.processCulqiPayment(orderId, culqiToken)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /payments/gmail/scan
   */
  async scanGmail(req: Request, res: Response) {
    try {
      const key = req.header('x-admin-key') || ''
      if (!config.admin.apiKey || key !== config.admin.apiKey) {
        return res.status(401).json({ error: 'No autorizado' })
      }

      const result = await paymentService.scanGmail()
      res.json({ success: true, result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /payments/mercadopago/webhook
   */
  /**
   * POST /payments/mercadopago/webhook
   */
  async mpWebhook(req: Request, res: Response) {
    try {
      const { type, data } = req.body
      if (type === 'payment' && data?.id) {
        logger.info(`[MP-WEBHOOK] Recibido pago ID: ${data.id}`)
        paymentService.processMPWebhook(data.id).catch(err => {
          logger.error(`[MP-WEBHOOK] Error procesando pago ${data.id}:`, err)
        })
      }
      res.sendStatus(200)
    } catch (error) {
      logger.error('MP Webhook error:', error as any)
      res.sendStatus(500)
    }
  }

  /**
   * GET /payments/gmail/auth-url
   */
  async getGmailAuthUrl(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const origin = (req.query.origin as string) || ''
      
      // Construir el redirect URI dinámicamente según la IP, localhost o dominio por el que acceden
      const protocol = req.headers['x-forwarded-proto'] || req.protocol
      let host = req.headers['x-forwarded-host'] || req.get('host')
      
      // Si el frontend está en localhost o loopback, forzamos que la redirección de Google sea a localhost
      // para evitar que el bloqueo de IPs privadas de Google arruine la conexión.
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        host = `localhost:${config.server.port || 4000}`
      }
      
      const dynamicRedirectUri = `${protocol}://${host}/api/payments/gmail/callback`
      
      // Empaquetamos el redirect URI en el state para recuperarlo en el callback
      // Formato: "userId|origin|dynamicRedirectUri"
      const state = `${user.id}|${origin}|${dynamicRedirectUri}`
      const url = googleAuthService.getAuthUrl(state, dynamicRedirectUri)
      
      res.json({ url })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * GET /payments/gmail/callback
   */
  async gmailCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query
      if (!code || !state) return res.status(400).send('Código o usuario faltante')

      let userId = ''
      let frontendUrl = ''
      let oauthRedirectUri = ''

      const stateStr = state as string
      if (stateStr.includes('|')) {
        const parts = stateStr.split('|')
        userId = parts[0]
        frontendUrl = parts[1]
        oauthRedirectUri = parts[2] || ''
      } else {
        userId = stateStr
      }

      // Si no tenemos frontendUrl, obtenemos la primera opción disponible de config.server.frontendUrl
      if (!frontendUrl) {
        const allowedOrigins = (config.server.frontendUrl || '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
        frontendUrl = allowedOrigins[0] || 'http://localhost:3000'
      }

      // Intercambiar código por tokens usando el mismo redirectUri dinámico con el que se inició
      const tokens = await googleAuthService.getTokens(code as string, oauthRedirectUri)
      if (!tokens.refresh_token) {
        return res.status(400).send('No se recibió Refresh Token. Revoca el acceso en tu cuenta de Google e intenta de nuevo.')
      }

      // Guardar en el config del usuario
      const { rows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [userId])
      const currentConfig = rows[0]?.payment_config || {}
      
      const newConfig = {
        ...currentConfig,
        gmail: {
          ...(currentConfig.gmail || {}),
          refreshToken: encryption.encrypt(tokens.refresh_token),
          email: tokens.id_token ? 'Conectado' : 'Conectado' // Podríamos decodificar el ID token para el email real
        }
      }

      await db.query('UPDATE users SET payment_config = $1 WHERE id = $2', [newConfig, userId])

      // Redirigir de vuelta al frontend usando la url de origen exacta y limpia
      res.redirect(`${frontendUrl}/provider/settings?gmail=success`)
    } catch (error: any) {
      logger.error('Gmail Callback Error:', error.message)
      
      // Fallback para redirección de error
      let frontendUrl = ''
      const stateStr = (req.query.state as string) || ''
      if (stateStr.includes('|')) {
        const parts = stateStr.split('|')
        frontendUrl = parts[1]
      }
      if (!frontendUrl) {
        const allowedOrigins = (config.server.frontendUrl || '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
        frontendUrl = allowedOrigins[0] || 'http://localhost:3000'
      }
      res.redirect(`${frontendUrl}/provider/settings?gmail=error`)
    }
  }
}

export const paymentController = new PaymentController()
