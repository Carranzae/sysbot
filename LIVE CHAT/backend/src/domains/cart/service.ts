import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'

export class CartService {
  async getCart(sessionId?: string, userId?: string) {
    const where = userId ? 'c.user_id = $1' : 'c.session_id = $1'
    const id = userId || sessionId
    
    if (!id) throw new Error('Identificador de carrito requerido')

    const { rows } = await db.query(`
      SELECT c.*, p.name, p.price, p.images, p.stock, p.category_id
      FROM carts c
      JOIN products p ON c.product_id = p.id
      WHERE ${where}
      ORDER BY c.created_at DESC
    `, [id])
    
    return rows
  }

  async addItem(productId: string, quantity: number, sessionId?: string, userId?: string) {
    const where = userId ? 'user_id = $1' : 'session_id = $1'
    const id = userId || sessionId
    if (!id) throw new Error('Identificador de carrito requerido')

    // 1. Check product
    const { rows: pCheck } = await db.query('SELECT id, name, stock FROM products WHERE id = $1', [productId])
    if (!pCheck.length) throw new Error('Producto no encontrado')
    
    // 1.1 Auditoría: Validar Stock
    if (pCheck[0].stock !== null && quantity > pCheck[0].stock) {
      throw new Error(`Stock insuficiente para ${pCheck[0].name}. Máximo disponible: ${pCheck[0].stock}`)
    }

    // 2. Upsert logic
    const { rows: existing } = await db.query(`SELECT id FROM carts WHERE ${where} AND product_id = $2`, [id, productId])
    
    if (existing.length) {
      const { rows } = await db.query(`
        UPDATE carts SET quantity = quantity + $1, updated_at = NOW() 
        WHERE ${where} AND product_id = $2 RETURNING *`, 
        [quantity, id, productId]
      )
      return rows[0]
    } else {
      const field = userId ? 'user_id' : 'session_id'
      const { rows } = await db.query(`
        INSERT INTO carts (${field}, product_id, quantity) 
        VALUES ($1, $2, $3) RETURNING *`, 
        [id, productId, quantity]
      )
      return rows[0]
    }
  }

  async updateItem(productId: string, quantity: number, sessionId?: string, userId?: string) {
    const where = userId ? 'user_id = $1' : 'session_id = $1'
    const id = userId || sessionId
    if (!id) throw new Error('Identificador de carrito requerido')

    const { rows } = await db.query(`
      UPDATE carts SET quantity = $1, updated_at = NOW() 
      WHERE ${where} AND product_id = $2 RETURNING *`, 
      [quantity, id, productId]
    )
    if (!rows.length) throw new Error('Item no encontrado en el carrito')
    return rows[0]
  }

  async removeItem(productId: string, sessionId?: string, userId?: string) {
    const where = userId ? 'user_id = $1' : 'session_id = $1'
    const id = userId || sessionId
    if (!id) throw new Error('Identificador de carrito requerido')

    const { rows } = await db.query(`DELETE FROM carts WHERE ${where} AND product_id = $2 RETURNING *`, [id, productId])
    if (!rows.length) throw new Error('Item no encontrado en el carrito')
    return rows[0]
  }

  async clearCart(sessionId?: string, userId?: string) {
    const where = userId ? 'user_id = $1' : 'session_id = $1'
    const id = userId || sessionId
    if (!id) throw new Error('Identificador de carrito requerido')

    const { rowCount } = await db.query(`DELETE FROM carts WHERE ${where}`, [id])
    return rowCount
  }

  async migrateCart(sessionId: string, userId: string) {
    // 🛡️ Migración Atómica Industrial
    const query = `
      INSERT INTO carts (user_id, product_id, quantity)
      SELECT $2, product_id, quantity FROM carts WHERE session_id = $1
      ON CONFLICT (user_id, product_id) 
      DO UPDATE SET quantity = carts.quantity + EXCLUDED.quantity, updated_at = NOW()
    `
    const { rowCount } = await db.query(query, [sessionId, userId])
    
    // Limpiar el carrito de sesión tras migrar
    await db.query('DELETE FROM carts WHERE session_id = $1', [sessionId])
    
    if (rowCount && rowCount > 0) logger.info(`🚚 [Carrito] ${rowCount} items migrados de sesión a usuario ${userId}`)
    return rowCount || 0
  }
}

export const cartService = new CartService()
