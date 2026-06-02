import { Request, Response } from 'express'
import { cartService } from './service'
import { db } from '../../../database/db'

export class CartController {
  // --- ANONYMOUS ---
  async getAnonymous(req: Request, res: Response) {
    try {
      const cart = await cartService.getCart(req.params.sessionId)
      res.json({ cart })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async addAnonymous(req: Request, res: Response) {
    try {
      const { product_id, quantity } = req.body
      const item = await cartService.addItem(product_id, quantity || 1, req.params.sessionId)
      res.json({ success: true, item })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async updateAnonymous(req: Request, res: Response) {
    try {
      const { quantity } = req.body
      const item = await cartService.updateItem(req.params.productId, quantity, req.params.sessionId)
      res.json({ success: true, item })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async removeAnonymous(req: Request, res: Response) {
    try {
      const deleted = await cartService.removeItem(req.params.productId, req.params.sessionId)
      res.json({ success: true, deleted })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  async clearAnonymous(req: Request, res: Response) {
    try {
      const count = await cartService.clearCart(req.params.sessionId)
      res.json({ success: true, deletedCount: count })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  // --- AUTHENTICATED ---
  async getUserCart(req: Request, res: Response) {
    try {
      const cart = await cartService.getCart(undefined, req.user?.id)
      res.json({ cart })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async addUserCart(req: Request, res: Response) {
    try {
      const { product_id, quantity } = req.body
      const item = await cartService.addItem(product_id, quantity || 1, undefined, req.user?.id)
      res.json({ success: true, item })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async clearUserCart(req: Request, res: Response) {
    try {
      const count = await cartService.clearCart(undefined, req.user?.id)
      res.json({ success: true, deletedCount: count })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async migrate(req: Request, res: Response) {
    try {
      const count = await cartService.migrateCart(req.body.sessionId, req.user!.id)
      res.json({ success: true, migratedCount: count, message: `${count} items migrados` })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async getWhatsAppCart(req: Request, res: Response) {
    try {
      const { phone, userId } = req.query
      if (!phone || !userId) {
        return res.status(400).json({ error: 'phone y userId son requeridos' })
      }

      // Query table conversation_states
      const { rows } = await db.query(
        "SELECT state FROM conversation_states WHERE user_id = $1 AND customer_phone = $2",
        [userId, phone]
      )

      let cartItems: any[] = []
      if (rows.length > 0) {
        const state = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state
        cartItems = state?.cartItems || []
      }

      // Para cada item, cargamos la imagen y otros detalles actualizados en la DB
      const enrichedCartItems = []
      for (const item of cartItems) {
        const { rows: prodRows } = await db.query(
          "SELECT id, name, price, images, stock, catalog_type FROM products WHERE id = $1",
          [item.id]
        )
        if (prodRows.length > 0) {
          const p = prodRows[0]
          enrichedCartItems.push({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price) || 0,
            quantity: item.qty || 1,
            images: p.images || [],
            catalog_type: p.catalog_type || 'national',
            stock: p.stock
          })
        } else {
          // Fallback al item conversacional
          enrichedCartItems.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.qty || 1,
            images: [],
            catalog_type: item.catalog_type || 'national',
            stock: undefined
          })
        }
      }

      // Buscar el último pedido de este cliente para precargar su nombre, email, dirección, etc.
      let customerName = ''
      let customerEmail = ''
      let customerIdNumber = ''
      let customerAddress = ''
      let customerDepartment = ''
      let customerCity = ''
      let customerDistrict = ''
      let customerReference = ''

      const { rows: lastOrderRows } = await db.query(
        `SELECT customer_name, customer_email, customer_phone, shipping_address, id_number
         FROM orders
         WHERE user_id = $1 AND customer_phone = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, phone]
      )

      if (lastOrderRows.length > 0) {
        const lo = lastOrderRows[0]
        customerName = lo.customer_name || ''
        customerEmail = lo.customer_email || ''
        customerIdNumber = lo.id_number || ''
        if (lo.shipping_address) {
          try {
            const addr = typeof lo.shipping_address === 'string' ? JSON.parse(lo.shipping_address) : lo.shipping_address
            customerAddress = addr.address || ''
            customerDepartment = addr.department || ''
            customerCity = addr.city || ''
            customerDistrict = addr.district || ''
            customerReference = addr.reference || ''
          } catch {
            customerAddress = typeof lo.shipping_address === 'string' ? lo.shipping_address : ''
          }
        }
      }

      res.json({
        success: true,
        cartItems: enrichedCartItems,
        customerData: {
          name: customerName,
          email: customerEmail,
          phone: phone,
          idNumber: customerIdNumber,
          address: customerAddress,
          department: customerDepartment,
          city: customerCity,
          district: customerDistrict,
          reference: customerReference
        }
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const cartController = new CartController()
