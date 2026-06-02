import { db } from '../database/db'
import { logger } from '../api/utils/logger'

/**
 * MOTOR 4 — Conversation State (Flujo de Compra Asistida)
 * Mantiene el estado del funnel de compra por cliente.
 * Permite guiar al cliente paso a paso hasta el pago.
 */

interface ConversationState {
  stage: 'BROWSING' | 'PRODUCT_SELECTED' | 'AWAITING_PAYMENT' | 'COMPLETED'
  selectedProductId?: string
  selectedProductName?: string
  selectedProductPrice?: number
  lastActivity: number
  cartItems: Array<{ id: string; name: string; price: number; qty: number; catalog_type?: string; variant_details?: string }>
  draftProduct?: any
  pausedUntil?: number
  negotiatedAdvance?: number  // Adelanto acordado con el cliente (monto fijo, no porcentaje)
  npsPending?: boolean
  npsOrderId?: string
  npsScore?: number
}

const TTL_MS = 30 * 60 * 1000 // 30 minutos

class ConversationStateService {
  async get(userId: string, customerPhone: string): Promise<ConversationState | null> {
    const { rows } = await db.query(
      "SELECT state FROM conversation_states WHERE user_id = $1 AND customer_phone = $2",
      [userId, customerPhone]
    )
    return rows[0]?.state || null
  }

  async set(userId: string, customerPhone: string, state: Partial<ConversationState>): Promise<ConversationState> {
    const existing = await this.get(userId, customerPhone) || {
      stage: 'BROWSING' as const,
      lastActivity: Date.now(),
      cartItems: [],
    }

    const updated: ConversationState = {
      ...existing,
      ...state,
      lastActivity: Date.now(),
    }

    await db.query(
      `INSERT INTO conversation_states (user_id, customer_phone, state, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, customer_phone) DO UPDATE SET state = $3, updated_at = NOW()`,
      [userId, customerPhone, JSON.stringify(updated)]
    )
    return updated
  }

  async reset(userId: string, customerPhone: string): Promise<void> {
    await db.query("DELETE FROM conversation_states WHERE user_id = $1 AND customer_phone = $2", [userId, customerPhone])
  }

  async addToCart(
    userId: string, 
    customerPhone: string, 
    product: { id: string; name: string; price: number; catalog_type?: string; variant_details?: string }, 
    qty: number = 1
  ): Promise<void> {
    const state = await this.get(userId, customerPhone) || {
      stage: 'BROWSING' as const,
      lastActivity: Date.now(),
      cartItems: [],
    }

    const existing = state.cartItems.find(i => i.id === product.id && i.variant_details === product.variant_details)
    if (existing) {
      existing.qty += qty
    } else {
      state.cartItems.push({ ...product, qty })
    }

    await this.set(userId, customerPhone, { ...state, stage: 'PRODUCT_SELECTED' })
  }

  async updateCartQty(
    userId: string, 
    customerPhone: string, 
    productId: string, 
    qty: number,
    variantDetails: string = ''
  ): Promise<void> {
    const state = await this.get(userId, customerPhone) || {
      stage: 'BROWSING' as const,
      lastActivity: Date.now(),
      cartItems: [],
    }

    const existingIndex = state.cartItems.findIndex(i => String(i.id) === String(productId) && (i.variant_details || '') === variantDetails)
    if (existingIndex !== -1) {
      if (qty <= 0) {
        state.cartItems.splice(existingIndex, 1)
      } else {
        state.cartItems[existingIndex].qty = qty
      }
    } else if (qty > 0) {
      const { rows } = await db.query('SELECT name, price, catalog_type FROM products WHERE id = $1', [productId])
      if (rows.length > 0) {
        state.cartItems.push({
          id: productId,
          name: rows[0].name,
          price: Number(rows[0].price),
          catalog_type: rows[0].catalog_type,
          variant_details: variantDetails,
          qty
        })
      }
    }

    const newStage = state.cartItems.length > 0 ? 'PRODUCT_SELECTED' as const : 'BROWSING' as const
    await this.set(userId, customerPhone, { ...state, stage: newStage })
  }

  async getCartTotal(userId: string, customerPhone: string): Promise<number> {
    const state = await this.get(userId, customerPhone)
    if (!state || state.cartItems.length === 0) return 0
    
    let total = 0
    let hasChanges = false
    for (const item of state.cartItems) {
      const { rows } = await db.query('SELECT price FROM products WHERE id = $1', [item.id])
      if (rows.length > 0) {
        const realPrice = parseFloat(rows[0].price)
        if (item.price !== realPrice) {
          item.price = realPrice
          hasChanges = true
        }
      }
      total += item.price * item.qty
    }
    
    if (hasChanges) {
      await this.set(userId, customerPhone, state)
    }
    
    return total
  }

  async getCartSummary(userId: string, customerPhone: string): Promise<string> {
    const state = await this.get(userId, customerPhone)
    if (!state || state.cartItems.length === 0) return 'Carrito vacío'

    const lines: string[] = []
    let total = 0
    let hasChanges = false
    
    for (const item of state.cartItems) {
      const { rows } = await db.query('SELECT price FROM products WHERE id = $1', [item.id])
      if (rows.length > 0) {
        const realPrice = parseFloat(rows[0].price)
        if (item.price !== realPrice) {
          item.price = realPrice
          hasChanges = true
        }
      }
      lines.push(`• *${item.name}* ${item.variant_details ? `(${item.variant_details}) ` : ''}x${item.qty} — S/ ${(item.price * item.qty).toFixed(2)}`)
      total += item.price * item.qty
    }

    if (hasChanges) {
      await this.set(userId, customerPhone, state)
    }

    return lines.join('\n') + `\n━━━━━━━━━━━━━━━\n💰 *Total: S/ ${total.toFixed(2)}*`
  }

  async isPaused(userId: string, customerPhone: string): Promise<boolean> {
    const state = await this.get(userId, customerPhone)
    if (!state || !state.pausedUntil) return false
    return Date.now() < state.pausedUntil
  }

  /**
   * Establece/quita la pausa manual de la IA para un cliente específico.
   * pause=true  → IA silenciada indefinidamente para este cliente (hasta que el proveedor reactive)
   * pause=false → IA reactivada para este cliente
   */
  async setManualPause(userId: string, customerPhone: string, pause: boolean): Promise<void> {
    // Indefinida = un año (número suficientemente grande para "manual")
    const pausedUntil = pause ? Date.now() + 365 * 24 * 60 * 60 * 1000 : 0
    const existing = await this.get(userId, customerPhone) || {
      stage: 'BROWSING' as const,
      lastActivity: Date.now(),
      cartItems: [],
    }
    await this.set(userId, customerPhone, { ...existing, pausedUntil })
  }

  /**
   * Devuelve si este cliente está manualmente pausado (no por auto-escalamiento)
   */
  async isManuallyPaused(userId: string, customerPhone: string): Promise<boolean> {
    const state = await this.get(userId, customerPhone)
    if (!state || !state.pausedUntil) return false
    // Consideramos "manual" si el pausedUntil es mayor a 1 hora desde ahora
    return state.pausedUntil > Date.now() + 60 * 60 * 1000
  }

  /**
   * Registra un adelanto negociado con el cliente (monto fijo acordado).
   * Ej: cliente dice 'te doy S/200 ahora y el resto cuando llegue'
   */
  async setNegotiatedAdvance(userId: string, customerPhone: string, amount: number): Promise<void> {
    const state = await this.get(userId, customerPhone)
    if (!state) return
    await this.set(userId, customerPhone, { ...state, negotiatedAdvance: amount })
    logger.info(`[ADVANCE] Adelanto negociado registrado: S/ ${amount} para ${customerPhone}`)
  }

  async cleanup(): Promise<void> {
    // La limpieza se maneja de forma centralizada por el HistoryMaintenanceService
    // respetando las reglas de retención dinámicas del Administrador General.
  }
}

export const conversationStateService = new ConversationStateService()
