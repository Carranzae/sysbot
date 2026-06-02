import { Request, Response } from 'express'
import { orderService } from './service'
import { db } from '../../../database/db'

export class OrderController {
  /**
   * GET /orders/public
   */
  async getPublicOrder(req: Request, res: Response) {
    try {
      const code = String(req.query.code || '').trim().toUpperCase()
      const email = String(req.query.email || '').trim().toLowerCase()

      if (!code) return res.status(400).json({ error: 'code es requerido' })

      const order = await orderService.getOrderByPublicCode(code, email)
      if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })

      res.json({ success: true, order })
    } catch (error: any) {
      res.status(error.message.includes('incorrecto') ? 403 : 500).json({ error: error.message })
    }
  }

  /**
   * POST /orders
   */
  async createOrder(req: Request, res: Response) {
    try {
      const order = await orderService.createOrder(req.body, req.body.provider_email)
      
      // Emitir evento socket si existe
      const io = (req as any).io
      if (io) {
        io.to(`user_${order.user_id}`).emit('new_order', {
          orderId: order.id,
          customerName: order.customer_name,
          total: order.total,
          timestamp: order.created_at,
        })
      }

      res.json({ success: true, order })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * PATCH /orders/:id (Protegido)
   */
  async updateOrder(req: Request, res: Response) {
    try {
      const { id } = req.params
      const isAdmin = (req as any).user?.role === 'admin_general'
      const userId = (req as any).user?.id

      const order = await orderService.updateOrder(id, req.body, userId, isAdmin)
      res.json({ success: true, order })
    } catch (error: any) {
      res.status(error.message.includes('No autorizado') ? 403 : 500).json({ error: error.message })
    }
  }

  /**
   * GET /orders (Paginado)
   */
  async listOrders(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const isAdmin = user?.role === 'admin_general'
      const { userId, status, asCustomer, page, limit, search, shippingType } = req.query

      const result = await orderService.listOrders({
        userId: isAdmin ? ((userId as string) || user.id) : user.id,
        isAdmin,
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        asCustomer: asCustomer === 'true',
        shippingType: shippingType as string
      })

      res.json({ success: true, ...result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * DELETE /orders/:id
   */
  async deleteOrder(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      
      const { rows } = await db.query('SELECT user_id FROM orders WHERE id = $1', [id])
      if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
      
      if (user.role !== 'admin_general' && rows[0].user_id !== user.id) {
        return res.status(403).json({ error: 'No autorizado' })
      }

      await db.query('DELETE FROM orders WHERE id = $1', [id])
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const orderController = new OrderController()
