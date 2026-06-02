import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'
import { fastCache } from '../../../api/utils/cache'

export class CatalogService {
  async listCategories() {
    const cacheKey = 'catalog_categories_all'
    const cached = await fastCache.get(cacheKey)
    if (cached) return cached

    const query = 'SELECT id, name, icon, slug, contact_phone, is_active, user_id, created_at, updated_at FROM categories ORDER BY name ASC'

    const { rows } = await db.query(query)
    const result = rows.map(this.sanitizeCategory)
    await fastCache.set(cacheKey, result, 3600)
    return result
  }

  async createCategory(data: { name: string; icon: string; slug: string; contact_phone?: string; userId: string }) {
    const cleanSlug = data.slug.trim().toLowerCase().replace(/\s+/g, '-')
    const { rows } = await db.query(
      `INSERT INTO categories (name, icon, slug, contact_phone, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name.trim(), data.icon.trim(), cleanSlug, data.contact_phone || null, data.userId]
    )
    await this.invalidateCache()
    return this.sanitizeCategory(rows[0])
  }

  async updateCategory(id: string, updates: any) {
    const allowedFields = ['name', 'icon', 'slug', 'contact_phone', 'is_active']
    const entries = Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    if (!entries.length) throw new Error('No hay campos válidos para actualizar')

    const setClauses = entries.map(([key], idx) => `${key} = $${idx + 2}`)
    const values = entries.map(([_, val]) => val)

    const { rows } = await db.query(
      `UPDATE categories SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    )
    if (!rows.length) throw new Error('Categoría no encontrada')
    await this.invalidateCache()
    return this.sanitizeCategory(rows[0])
  }

  async deleteCategory(id: string) {
    const { rows } = await db.query('SELECT user_id FROM categories WHERE id = $1', [id])
    if (rows.length > 0) {
      await db.query('DELETE FROM categories WHERE id = $1', [id])
      await this.invalidateCache()
    }
    return true
  }

  private async invalidateCache() {
    await fastCache.delete('catalog_categories_all')
    logger.info(`🧹 [Cache] Categorías globales invalidadas`)
  }

  private sanitizeCategory(cat: any) {
    return {
      ...cat,
      contact_phone: cat.contact_phone || null
    }
  }
}

export const catalogService = new CatalogService()
