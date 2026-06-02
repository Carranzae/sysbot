import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'

export class InventoryService {
  async decrementStock(productId: string, quantity: number) {
    const { rows } = await db.query(
      `UPDATE products 
       SET stock = stock - $2, updated_at = NOW()
       WHERE id = $1 AND stock IS NOT NULL AND stock >= $2
       RETURNING id, name, stock`,
      [productId, quantity]
    )

    if (rows.length === 0) {
      const { rows: check } = await db.query('SELECT stock FROM products WHERE id = $1', [productId])
      if (!check.length) throw new Error('Producto no encontrado')
      if (check[0].stock === null) throw new Error('Producto sin control de stock')
      throw new Error(`Stock insuficiente. Disponible: ${check[0].stock}`)
    }
    return rows[0]
  }

  async incrementStock(productId: string, quantity: number) {
    const { rows } = await db.query(
      `UPDATE products 
       SET stock = COALESCE(stock, 0) + $2, updated_at = NOW()
       WHERE id = $1 RETURNING id, name, stock`,
      [productId, quantity]
    )
    if (rows.length === 0) throw new Error('Producto no encontrado')
    return rows[0]
  }

  async reserveStock(items: { productId: string; quantity: number }[]) {
    const client = await db.getClient()
    try {
      await client.query('BEGIN')
      const updated = []
      for (const item of items) {
        const { rows } = await client.query(
          `UPDATE products SET stock = stock - $2, updated_at = NOW()
           WHERE id = $1 AND stock >= $2 RETURNING id, name, stock`,
          [item.productId, item.quantity]
        )
        if (rows.length === 0) {
          const { rows: check } = await client.query('SELECT name, stock FROM products WHERE id = $1', [item.productId])
          throw new Error(`Stock insuficiente para ${check[0]?.name || item.productId}. Disponible: ${check[0]?.stock || 0}`)
        }
        updated.push(rows[0])
      }
      await client.query('COMMIT')
      return updated
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const inventoryService = new InventoryService()
