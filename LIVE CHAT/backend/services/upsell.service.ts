import { db } from '../database/db'
import { logger } from '../api/utils/logger'

export class UpsellService {
  /**
   * Obtiene sugerencias inteligentes basadas en el carrito actual y las categorías.
   */
  async getSmartSuggestions(userId: string, cartItems: any[]) {
    try {
      if (!cartItems || cartItems.length === 0) return []

      const cartIds = cartItems.map(item => String(item.id))
      const cartNames = cartItems.map(item => String(item.name || '').toLowerCase())

      // 1. Determinar intenciones de categorías complementarias basadas en palabras clave
      const complementaryKeywords: string[] = []
      let isFootwear = false
      let isApparel = false

      for (const name of cartNames) {
        if (name.includes('zapatilla') || name.includes('zapato') || name.includes('calzado') || name.includes('bota') || name.includes('sneaker') || name.includes('tenis')) {
          isFootwear = true
        }
        if (name.includes('polo') || name.includes('camisa') || name.includes('camiseta') || name.includes('top') || name.includes('casaca') || name.includes('hoodie')) {
          isApparel = true
        }
      }

      if (isFootwear) {
        complementaryKeywords.push('media', 'calcetín', 'limpiador', 'crema', 'plantilla', 'pasador', 'accesorio')
      }
      if (isApparel) {
        complementaryKeywords.push('correa', 'cinturón', 'billetera', 'gorra', 'short', 'accesorio')
      }

      // Encontrar el precio máximo de los items del carrito para proponer un "impulse buy" (menor precio)
      const maxCartPrice = Math.max(...cartItems.map(item => parseFloat(item.price) || 0))

      let suggestions: any[] = []

      // 2. Intentar buscar complementos específicos con palabras clave (Impulse Buy)
      if (complementaryKeywords.length > 0) {
        const keywordConditions = complementaryKeywords.map((_, i) => `name ILIKE $${i + 4}`).join(' OR ')
        const { rows } = await db.query(
          `SELECT id, name, price, description 
           FROM products
           WHERE user_id = $1 
             AND stock > 0 
             AND id::text != ALL($2::text[])
             AND price <= $3
             AND (${keywordConditions})
           ORDER BY price ASC
           LIMIT 2`,
          [userId, cartIds, maxCartPrice, ...complementaryKeywords.map(k => `%${k}%`)]
        )
        suggestions = rows
      }

      // 3. Fallback: Si no hay complementos específicos, traer productos de menor precio (impulse buy) que no estén en el carrito
      if (suggestions.length < 2) {
        const remainingLimit = 2 - suggestions.length
        const excludeIds = [...cartIds, ...suggestions.map(s => String(s.id))]
        const { rows: fallbackRows } = await db.query(
          `SELECT id, name, price, description 
           FROM products
           WHERE user_id = $1 
             AND stock > 0 
             AND id::text != ALL($2::text[])
             AND price <= $3
           ORDER BY price ASC
           LIMIT $4`,
          [userId, excludeIds, maxCartPrice > 0 ? maxCartPrice : 999999, remainingLimit]
        )
        suggestions = [...suggestions, ...fallbackRows]
      }

      // 4. Último recurso: Si todo falla o la tienda tiene pocos productos, traer cualquier producto en stock
      if (suggestions.length === 0) {
        const { rows: absoluteFallback } = await db.query(
          `SELECT id, name, price, description 
           FROM products
           WHERE user_id = $1 
             AND stock > 0 
             AND id::text != ALL($2::text[])
           ORDER BY created_at DESC
           LIMIT 2`,
          [userId, cartIds]
        )
        suggestions = absoluteFallback
      }

      return suggestions
    } catch (error: any) {
      logger.error('Error en UpsellService:', { error: error.message })
      return []
    }
  }

  /**
   * Genera un "gancho" persuasivo para la IA basado en las sugerencias inteligentes.
   */
  async getUpsellHook(userId: string, cartItems: any[]) {
    const suggestions = await this.getSmartSuggestions(userId, cartItems)
    if (suggestions.length === 0) return ''

    let hook = `\n💡 MOTOR DE UPSELLING INTELIGENTE (Atti Cross-Sell):\n`
    suggestions.forEach((s: any) => {
      hook += `• Sugiere el producto complementario "${s.name}" por solo S/ ${s.price}.\n`
    })
    hook += `Regla de Oro: Haz la sugerencia de forma extremadamente natural, empática y entusiasta. Explica por qué combina perfectamente con lo que ya está comprando y ofrécele un incentivo sutil (como "añadirlo sin costo de envío adicional" o un "pequeño descuento exclusivo por llevar ambos hoy").`
    
    return hook
  }
}

export const upsellService = new UpsellService()
