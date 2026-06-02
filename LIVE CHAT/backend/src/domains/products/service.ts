import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'
import { fastCache } from '../../../api/utils/cache'
import { whatsappRouter } from '../../../services/whatsappRouter.service'

export class ProductService {
  private buildSelect = 'id, name, description, price, min_price, discount_max_pct, stock, images, videos, category_id, user_id, catalog_type, lead_time_days, attributes, created_at'

  async listProducts(options: {
    userId?: string;
    isAdmin: boolean;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    catalogType?: string;
    isPublic?: boolean;
  }) {
    const { userId, isAdmin, categoryId, search, page = 1, limit = 20, catalogType, isPublic } = options

    // 0. Cache Key Inteligente (Jerarquía: Tipo:Visibilidad:Usuario:Categoria:TipoCatalogo:Pagina)
    const cacheKey = `prod:pub:${userId || 'all'}:${categoryId || 'all'}:${catalogType || 'all'}:${page}:${limit}`
    if (isPublic && !search) {
      const cached = await fastCache.get(cacheKey)
      if (cached) return cached
    }

    const offset = (page - 1) * limit
    const params: any[] = []
    let whereClauses: string[] = []

    // 1. Filtrado por Propiedad / Visibilidad
    if (isPublic) {
      whereClauses.push('u.is_active = true')
      if (userId) {
        params.push(userId)
        whereClauses.push(`p.user_id = $${params.length}`)
      }
    } else if (!isAdmin && userId) {
      params.push(userId)
      whereClauses.push(`p.user_id = $${params.length}`)
    } else if (isAdmin && userId) {
      params.push(userId)
      whereClauses.push(`p.user_id = $${params.length}`)
    }

    if (categoryId) {
      params.push(categoryId)
      whereClauses.push(`p.category_id = $${params.length}`)
    }
    if (catalogType) {
      params.push(catalogType)
      whereClauses.push(`p.catalog_type = $${params.length}`)
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      whereClauses.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`)
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // 2. Ejecución Optimizada (Paralelo: Conteo + Datos)
    const countQuery = `SELECT COUNT(*) FROM products p JOIN users u ON p.user_id = u.id ${whereStr}`
    const dataQuery = `
      SELECT p.id, p.name, p.description, p.price, p.min_price, p.discount_max_pct, p.stock, p.images, p.videos, p.category_id, p.user_id, p.catalog_type, p.lead_time_days, p.attributes, p.created_at FROM products p 
      JOIN users u ON p.user_id = u.id 
      ${whereStr} 
      ORDER BY p.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const [countResult, dataResult] = await Promise.all([
      db.query(countQuery, params),
      db.query(dataQuery, [...params, limit, offset])
    ])

    const total = parseInt(countResult.rows[0].count)
    const products = dataResult.rows

    const result = {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }

    // 3. Guardar en Cache si es público
    if (isPublic && !search) {
      await fastCache.set(cacheKey, result, 60) // 1 minuto de cache
    }

    return result
  }

  private async invalidateCache(userId: string) {
    const pattern = `prod:pub:${userId}:*`
    await fastCache.deleteByPattern(pattern)
    // NUEVO: Invalidar también la caché del catálogo del Orquestador de IA y Categorías en tiempo real
    await fastCache.deleteByPattern(`catalog_${userId}_*`)
    await fastCache.delete(`catalog_categories_${userId}`)
    logger.info(`🎯 [Cache] Catálogo quirúrgico invalidado para usuario: ${userId}`)
  }

  async createProduct(data: any, userId: string) {
    const catalog_type = data.catalog_type || data.catalogType || 'national'
    const lead_time_days = data.lead_time_days || data.leadTimeDays || 0

    const {
      name = '',
      description = '',
      price = 0,
      min_price = null,
      discount_max_pct = 0.00,
      stock = 0,
      images = [],
      videos = [],
      attributes = {},
      category_id
    } = data

    if (!name || !category_id) {
      throw new Error('Nombre y Categoría son campos obligatorios.')
    }

    const { rows } = await db.query(
      `INSERT INTO products (name, description, price, min_price, discount_max_pct, stock, images, videos, attributes, category_id, user_id, catalog_type, lead_time_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        name.trim(),
        description.trim(),
        parseFloat(String(price)),
        min_price !== null && min_price !== undefined && min_price !== '' ? parseFloat(String(min_price)) : null,
        parseFloat(String(discount_max_pct || 0)),
        parseInt(String(stock)),
        images,
        videos,
        attributes,
        category_id,
        userId,
        catalog_type,
        parseInt(String(lead_time_days))
      ]
    )
    await this.invalidateCache(userId)
    return rows[0]
  }

  async updateProduct(id: string, updates: any, userId: string, isAdmin: boolean) {
    const { rows: current } = await db.query('SELECT user_id FROM products WHERE id = $1', [id])
    if (!current.length) throw new Error('Producto no encontrado')
    if (!isAdmin && current[0].user_id !== userId) throw new Error('No autorizado')

    // Normalizar campos CamelCase a snake_case para la DB
    const normalizedUpdates: any = { ...updates }
    if (normalizedUpdates.catalogType) {
      normalizedUpdates.catalog_type = normalizedUpdates.catalogType
      delete normalizedUpdates.catalogType
    }
    if (normalizedUpdates.leadTimeDays) {
      normalizedUpdates.lead_time_days = normalizedUpdates.leadTimeDays
      delete normalizedUpdates.leadTimeDays
    }
    if (normalizedUpdates.minPrice !== undefined) {
      normalizedUpdates.min_price = normalizedUpdates.minPrice !== '' ? normalizedUpdates.minPrice : null
      delete normalizedUpdates.minPrice
    }
    if (normalizedUpdates.discountMaxPct !== undefined) {
      normalizedUpdates.discount_max_pct = normalizedUpdates.discountMaxPct
      delete normalizedUpdates.discountMaxPct
    }

    const fields = Object.keys(normalizedUpdates).filter(k => !['id', 'user_id', 'created_at'].includes(k))
    const clauses = fields.map((f, i) => `${f} = $${i + 2}`)
    const values = fields.map(f => normalizedUpdates[f])
    const { rows } = await db.query(`UPDATE products SET ${clauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values])
    await this.invalidateCache(current[0].user_id)
    return rows[0]
  }

  async deleteProduct(id: string, userId: string, isAdmin: boolean) {
    const { rows: current } = await db.query('SELECT user_id FROM products WHERE id = $1', [id])
    if (!current.length) throw new Error('Producto no encontrado')
    if (!isAdmin && current[0].user_id !== userId) throw new Error('No autorizado')

    await db.query('DELETE FROM products WHERE id = $1', [id])
    await this.invalidateCache(current[0].user_id)
    return true
  }

  /**
   * Sincronización Automática de Stock (Nivel Industrial)
   */
  async decrementStock(productId: string, quantity: number) {
    try {
      const { rows } = await db.query(
        'UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2 RETURNING user_id, name, stock',
        [quantity, productId]
      )

      if (rows[0]) {
        const { user_id, name, stock } = rows[0]
        logger.info(`[STOCK-SYNC] Producto "${name}" actualizado. Nuevo stock: ${stock}`)
        await this.invalidateCache(user_id)

        // Alerta de Stock Crítico (Nivel Pro)
        if (stock > 0 && stock <= 5) {
          try {
            const { rows: userRows } = await db.query('SELECT phone FROM users WHERE id = $1', [user_id])
            const providerPhone = userRows[0]?.phone
            if (providerPhone) {
              const alertMsg = `⚠️ *ALERTA DE STOCK CRÍTICO*\n\nEl producto *${name}* está por agotarse. \n📦 *Quedan solo:* ${stock} unidades.\n\nRepón tu inventario pronto para evitar perder ventas. 🚀`
              await whatsappRouter.sendMessage(user_id, providerPhone, alertMsg)
            }
          } catch (e) {
            logger.warn('[STOCK-ALERT] Error enviando alerta de stock:', e as any)
          }
        }
      }
    } catch (error: any) {
      logger.error(`[STOCK-SYNC] Error decrementando stock para producto ${productId}:`, error.message)
    }
  }
}

export const productService = new ProductService()
