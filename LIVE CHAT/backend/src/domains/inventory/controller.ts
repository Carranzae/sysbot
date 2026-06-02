import { Request, Response } from 'express'
import { inventoryService } from './service'

export class InventoryController {
  async decrement(req: Request, res: Response) {
    try {
      const { productId, quantity } = req.body
      const product = await inventoryService.decrementStock(productId, quantity)
      res.json({ success: true, product })
    } catch (error: any) {
      res.status(error.message.includes('Stock insuficiente') ? 409 : 400).json({ error: error.message })
    }
  }

  async increment(req: Request, res: Response) {
    try {
      const { productId, quantity } = req.body
      const product = await inventoryService.incrementStock(productId, quantity)
      res.json({ success: true, product })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async reserve(req: Request, res: Response) {
    try {
      const { items } = req.body
      const products = await inventoryService.reserveStock(items)
      res.json({ success: true, products })
    } catch (error: any) {
      res.status(409).json({ error: error.message })
    }
  }
}

export const inventoryController = new InventoryController()
