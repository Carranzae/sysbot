import { Request, Response } from 'express'
import { catalogService } from './service'

export class CatalogController {
  async list(req: Request, res: Response) {
    try {
      const categories = await catalogService.listCategories()
      
      if (req.path.includes('public')) {
        res.setHeader('Cache-Control', 'public, max-age=300')
      }
      res.json({ success: true, categories })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, icon, slug, contact_phone } = req.body
      const category = await catalogService.createCategory({
        name, icon, slug, contact_phone, userId: (req as any).user.id
      })
      res.status(201).json({ success: true, category })
    } catch (error: any) {
      res.status(error.code === '23505' ? 409 : 400).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const category = await catalogService.updateCategory(req.params.id, req.body)
      res.json({ success: true, category })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await catalogService.deleteCategory(req.params.id)
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const catalogController = new CatalogController()
