import { Request, Response } from 'express'
import { settingsService } from './service'

export class SettingsController {
  async getPublic(req: Request, res: Response) {
    const maintenance = await settingsService.getMaintenanceMode()
    const global = await settingsService.getGlobalSettings()
    res.json({ 
      maintenance,
      storeName: global.storeName,
      socialLinks: global.socialLinks
    })
  }

  async updateMaintenance(req: Request, res: Response) {
    try {
      const { enabled } = req.body
      const result = await settingsService.setMaintenanceMode(enabled)
      res.json({ success: true, enabled: result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getAdVideo(req: Request, res: Response) {
    const config = await settingsService.getAdVideoConfig()
    res.json(config)
  }

  async updateAdVideo(req: Request, res: Response) {
    try {
      const { enabled, video_url } = req.body
      const result = await settingsService.setAdVideoConfig({ enabled, video_url })
      res.json({ success: true, config: result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
  async getGlobal(req: Request, res: Response) {
    const settings = await settingsService.getGlobalSettings()
    res.json(settings)
  }

  async updateGlobal(req: Request, res: Response) {
    try {
      const settings = req.body
      const result = await settingsService.setGlobalSettings(settings)
      res.json({ success: true, settings: result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getCredentials(req: Request, res: Response) {
    try {
      const credentials = await settingsService.getSystemCredentials()
      res.json(credentials)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async updateCredentials(req: Request, res: Response) {
    try {
      const credentials = req.body
      const result = await settingsService.setSystemCredentials(credentials)
      res.json({ success: true, credentials: result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getNpsAnalytics(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id
      const stats = await settingsService.getNpsStats(userId)
      res.json(stats)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getSystemHealth(req: Request, res: Response) {
    try {
      const health = await settingsService.getSystemHealth()
      res.json(health)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const settingsController = new SettingsController()
