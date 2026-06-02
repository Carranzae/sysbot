import { Request, Response } from 'express'
import { securityService } from './service'
import { logger } from '../../../api/utils/logger'

export class SecurityController {
  async logEvent(req: Request, res: Response) {
    try {
      const { type, details, severity } = req.body
      const eventId = await securityService.logEvent({
        type,
        details,
        severity,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent']
      })
      res.json({ success: true, eventId })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }

  async getEvents(req: Request, res: Response) {
    try {
      const { type, severity, limit, offset } = req.query
      const result = await securityService.getEvents(
        { type, severity },
        Number(limit) || 50,
        Number(offset) || 0
      )
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }

  async getConfig(req: Request, res: Response) {
    try {
      const config = await securityService.getSecurityConfig()
      res.json(config)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }

  async updateConfig(req: Request, res: Response) {
    try {
      const config = await securityService.updateSecurityConfig(req.body)
      res.json({ success: true, config })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }

  async getPublicConfig(req: Request, res: Response) {
    try {
      const config = await securityService.getSecurityConfig()
      // 🛡️ MÍNIMA EXPOSICIÓN: Solo enviar flags de bloqueo UI
      const publicConfig = {
        blockDevTools: config.blockDevTools,
        blockRightClick: config.blockRightClick,
        blockCopy: config.blockCopy,
        blockPrint: config.blockPrint,
        blockScreenshot: config.blockScreenshot
      }
      res.setHeader('Cache-Control', 'public, max-age=600') // 10 min cache
      res.json(publicConfig)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }
}

export const securityController = new SecurityController()
