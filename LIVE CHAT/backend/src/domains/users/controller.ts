import { Request, Response } from 'express'
import { userService } from './service'

export class UserController {
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const isAdmin = user?.role === 'admin_general'
      
      if (!isAdmin) return res.status(403).json({ error: 'No autorizado' })

      const { role, page, limit, search } = req.query
      const result = await userService.listUsers({
        role: role as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        search: search as string
      })
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      const isAdmin = user.role === 'admin_general'
      
      if (id !== user.id && !isAdmin) return res.status(403).json({ error: 'No autorizado' })

      const updated = await userService.updateUser(id, req.body, isAdmin)
      res.json({ user: updated })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async getBranding(req: Request, res: Response) {
    try {
      const branding = await userService.getPublicBranding(req.params.id)
      if (!branding) return res.status(404).json({ error: 'No encontrado' })
      res.json({ success: true, branding })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getPaymentContacts(req: Request, res: Response) {
    try {
      const ids = String(req.query.ids || '').split(',').filter(Boolean)
      const contacts = await userService.getPublicPaymentContacts(ids)
      res.json({ contacts })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async testAlarm(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const { iftttService } = await import('../../../services/ifttt.service')
      
      await iftttService.triggerAlarm(user.id, {
        customerName: 'Prueba de Alarma',
        total: 999
      }, '🚨 ¡Alarma Industrial de Prueba!')
      
      res.json({ success: true, message: 'Alarma de prueba disparada' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async updateIftttConfig(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      const isAdmin = user.role === 'admin_general'

      if (id !== user.id && !isAdmin) return res.status(403).json({ error: 'No autorizado' })

      const config = await userService.updateIftttConfig(id, req.body)
      res.json({ success: true, config })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async deleteIftttConfig(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      const isAdmin = user.role === 'admin_general'

      if (id !== user.id && !isAdmin) return res.status(403).json({ error: 'No autorizado' })

      const config = await userService.deleteIftttConfig(id)
      res.json({ success: true, config })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  // Set or update the settings PIN for the authenticated user
  async setSettingsPin(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const { pin } = req.body
      if (!/^[0-9]{4,6}$/.test(String(pin))) {
        return res.status(400).json({ error: 'El PIN debe ser numérico de 4 a 6 dígitos' })
      }
      const config = await userService.setSettingsPin(user.id, String(pin))
      res.json({ success: true, config })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }


  async optimize(req: Request, res: Response) {
    try {
      await userService.optimizeDB()
      res.json({ success: true, message: 'DB Optimizada' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const userController = new UserController()

