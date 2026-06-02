import { Request, Response } from 'express'
import { productService } from './service'
import { marketIntelligenceService } from '../../../services/marketIntelligence.service'

export class ProductController {
  async getPublic(req: Request, res: Response) {
    try {
      const { categoryId, userId, page, limit, search, type } = req.query
      const result = await productService.listProducts({
        categoryId: categoryId as string,
        userId: userId as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        search: search as string,
        catalogType: type as string,
        isPublic: true,
        isAdmin: false
      })
      res.json({ success: true, ...result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const isAdmin = user.role === 'admin_general'
      const { userId, categoryId, page, limit, search, type } = req.query

      const result = await productService.listProducts({
        userId: isAdmin ? ((userId as string) || user.id) : user.id,
        isAdmin,
        categoryId: categoryId as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        search: search as string,
        catalogType: type as string,
        isPublic: false
      })
      res.json({ success: true, ...result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const product = await productService.createProduct(req.body, user.id)
      res.status(201).json({ success: true, product })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      const isAdmin = user.role === 'admin_general'
      const product = await productService.updateProduct(id, req.body, user.id, isAdmin)
      res.json({ success: true, product })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      const isAdmin = user.role === 'admin_general'
      await productService.deleteProduct(id, user.id, isAdmin)
      res.json({ success: true })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async getMarketInsights(req: Request, res: Response) {
    try {
      const { id } = req.params
      const insights = await marketIntelligenceService.analyzeProductPricing(id)
      res.json({ success: true, insights })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getTrends(req: Request, res: Response) {
    try {
      const trends = await marketIntelligenceService.getMarketTrends()
      res.json({ success: true, trends })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getInventoryHealth(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const health = await marketIntelligenceService.getInventoryHealth(user.id)
      res.json({ success: true, health })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
  // --- RUTAS DEL RADAR SENTINEL ---
  async registerCompetitorStore(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const { storeUrl, storeName } = req.body
      const result = await marketIntelligenceService.registerCompetitorStore(user.id, storeUrl, storeName)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getCompetitorStores(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const stores = await marketIntelligenceService.getMonitoredStores(user.id)
      res.json({ success: true, stores })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async updateCompetitorStore(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const { id } = req.params
      const result = await marketIntelligenceService.updateCompetitorStore(user.id, id, req.body)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async deleteCompetitorStore(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const { id } = req.params
      const result = await marketIntelligenceService.deleteCompetitorStore(user.id, id)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async scanCompetitorStore(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await marketIntelligenceService.runStoreWideSentinel(id)
      
      if (result && result.success === false) {
        return res.status(400).json(result)
      }
      
      res.json({ success: true, scanData: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

export const productController = new ProductController()
