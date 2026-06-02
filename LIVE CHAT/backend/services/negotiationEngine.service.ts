/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE NEGOCIACIÓN Y CIERRE DINÁMICO v2
 * ═══════════════════════════════════════════════════════════
 * Detecta señales de abandono o duda por precio y activa
 * estrategias de cierre graduadas en 3 etapas.
 * Protege el margen del proveedor utilizando min_price y discount_max_pct.
 * Nivel: 🔱 DIOS (Elite Sales Specialist)
 */

import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { conversationStateService } from './conversationState.service'
import { whatsappRouter } from './whatsappRouter.service'

export type CloseSignal =
  | 'PRICE_OBJECTION'       // "Está caro", "Lo pienso", "Quizás"
  | 'COMPETITOR_MENTION'    // "En OLX vi más barato", "MercadoLibre tiene"
  | 'CART_STALLED'          // Tiene cosas en el carrito pero no avanza
  | 'HESITATION'            // Múltiples preguntas sin acción
  | 'CLEAR_TO_BUY'          // Señal positiva, listo para comprar
  | 'COUNTER_OFFER'         // Cliente propone un monto: "te doy 800"
  | 'OWN_WEB_OFFER'         // "Vi en tu web que estaba más barato"
  | 'FIRST_BUY'             // Primera compra del cliente
  | 'RECURRENT_BUY'         // Cliente frecuente/VIP
  | 'VOLUME_OBJECTION'      // "Llevo dos si me bajas"
  | 'NONE'

export interface CloseStrategy {
  signal: CloseSignal
  tactic: string
  suggestedPrice?: number
  condition?: string
  hook: string
}

const OBJECTION_KEYWORDS: Record<CloseSignal, string[]> = {
  PRICE_OBJECTION: ['caro', 'muy caro', 'no tengo tanto', 'no llego', 'cuánto menos', 'deja en', 'rebaja', 'descuento', 'mucho', 'pasado', 'rebajame', 'dscto', 'descuentito', 'menos precio', 'bájame', 'bajame', 'carisimo', 'carísimo'],
  COMPETITOR_MENTION: ['olx', 'mercadolibre', 'falabella', 'ripley', 'saga', 'shopee', 'amazon', 'en otro lado', 'vi más barato', 'la competencia', 'otra tienda', 'aliexpress'],
  HESITATION: ['lo veo', 'lo pienso', 'quizás', 'tal vez', 'después', 'ahorita no', 'no sé', 'me da duda', 'no estoy seguro', 'voy a ver', 'lo consulto', 'luego te aviso'],
  CART_STALLED: [],
  CLEAR_TO_BUY: ['listo', 'dale', 'lo quiero', 'cómpramelo', 'separame', 'quiero pagar', 'cómo pago', 'pásame el link', 'pasame el link', 'compro', 'llevo', 'comprar'],
  COUNTER_OFFER: [], // Detectado dinámicamente por números/ofertas
  OWN_WEB_OFFER: ['vi en tu pagina', 'vi en tu página', 'en tu web dice', 'en tu tienda dice', 'vi en la web', 'tu web de atines', 'atinestore'],
  VOLUME_OBJECTION: ['llevo dos', 'si te compro dos', 'si llevo 2', 'por mayor', 'compro varios', 'llevo tres', 'llevo 3'],
  FIRST_BUY: ['mi primera compra', 'primera vez', 'nunca he comprado', 'es mi primera', 'soy nuevo'],
  RECURRENT_BUY: ['siempre compro', 'ya compré antes', 'soy cliente', 'cliente frecuente', 'frecuente', 'mi segunda compra'],
  NONE: []
}

class NegotiationEngine {
  /**
   * Detecta el tipo de objeción o señal en el mensaje del cliente
   */
  detectSignal(messageBody: string, hasCartItems: boolean, messageCount: number): CloseSignal {
    const lower = messageBody.toLowerCase().trim()

    // 1. Detección de volumen
    for (const kw of OBJECTION_KEYWORDS.VOLUME_OBJECTION) {
      if (lower.includes(kw)) return 'VOLUME_OBJECTION'
    }

    // 2. Detección de oferta propia en web
    for (const kw of OBJECTION_KEYWORDS.OWN_WEB_OFFER) {
      if (lower.includes(kw)) return 'OWN_WEB_OFFER'
    }

    // 3. Detección de primer comprador
    for (const kw of OBJECTION_KEYWORDS.FIRST_BUY) {
      if (lower.includes(kw)) return 'FIRST_BUY'
    }

    // 4. Detección de comprador recurrente
    for (const kw of OBJECTION_KEYWORDS.RECURRENT_BUY) {
      if (lower.includes(kw)) return 'RECURRENT_BUY'
    }

    // 5. Detección de contraofertas (ej: "te doy 800", "pago 500", "a 300 soles")
    const counterOfferMatch = lower.match(/(?:doy|ofrezco|tengo|deja|deje|pago|en|a)\s*s\/?\.?\s*(\d+)/i) || lower.match(/(\d+)\s*(?:soles|so|s)\b/i)
    if (counterOfferMatch) {
      const offeredAmount = parseInt(counterOfferMatch[1], 10)
      if (offeredAmount > 0 && offeredAmount < 20000) {
        return 'COUNTER_OFFER'
      }
    }

    // 6. Keywords estándar
    for (const [signal, keywords] of Object.entries(OBJECTION_KEYWORDS)) {
      if (keywords.length === 0) continue
      for (const kw of keywords) {
        if (lower.includes(kw)) return signal as CloseSignal
      }
    }

    // Carrito detenido
    if (hasCartItems && messageCount > 5) {
      return 'CART_STALLED'
    }

    return 'NONE'
  }

  /**
   * Procesa la negociación dinámicamente y computa la estrategia de cierre graduada
   */
  async processNegotiation(
    userId: string,
    customerPhone: string,
    messageBody: string,
    cartItems: any[]
  ): Promise<CloseStrategy> {
    const messageCount = await this.getMessageCount(userId, customerPhone)
    const hasCartItems = cartItems.length > 0
    const signal = this.detectSignal(messageBody, hasCartItems, messageCount)

    if (!hasCartItems) {
      return this.getCloseTactic(signal, 'NONE', 0, 0, 0)
    }

    // Obtener primer producto del carrito para evaluar límites
    const primaryItem = cartItems[0]
    try {
      const { rows } = await db.query(
        'SELECT price, min_price, discount_max_pct FROM products WHERE id = $1',
        [primaryItem.id]
      )

      if (rows.length === 0) {
        return this.getCloseTactic(signal, 'NONE', 0, 0, 0)
      }

      const dbProduct = rows[0]
      const realPrice = parseFloat(dbProduct.price)
      let minPrice = dbProduct.min_price ? parseFloat(dbProduct.min_price) : realPrice
      const maxDiscountPct = parseFloat(dbProduct.discount_max_pct || 0)

      // Candado de seguridad: minPrice no puede ser menor que el descuento porcentual máximo permitido
      if (maxDiscountPct > 0) {
        const absoluteFloor = realPrice * (1 - (maxDiscountPct / 100))
        if (minPrice < absoluteFloor) {
          minPrice = absoluteFloor
        }
      }

      // Si no hay margen real para negociar
      if (minPrice >= realPrice) {
        return this.getCloseTactic(signal, 'NO_MARGIN', realPrice, realPrice, 0)
      }

      // Obtener y actualizar ronda de negociación
      const convState = await conversationStateService.get(userId, customerPhone)
      let round = (convState as any)?.negotiationRound || 0

      if (signal === 'PRICE_OBJECTION' || signal === 'COUNTER_OFFER') {
        round += 1
        await conversationStateService.set(userId, customerPhone, {
          ...convState,
          negotiationRound: round
        } as any)
      }

      // Analizar monto ofrecido por el cliente si es COUNTER_OFFER
      let offeredAmount = 0
      if (signal === 'COUNTER_OFFER') {
        const match = messageBody.toLowerCase().match(/(?:doy|ofrezco|tengo|deja|deje|pago|en|a)\s*s\/?\.?\s*(\d+)/i) || messageBody.toLowerCase().match(/(\d+)\s*(?:soles|so|s)\b/i)
        if (match) offeredAmount = parseInt(match[1], 10)
      }

      return this.getCloseTactic(signal, 'HAS_MARGIN', realPrice, minPrice, round, offeredAmount, primaryItem.name, userId, customerPhone)

    } catch (err: any) {
      logger.error('[NEGOTIATION] Error procesando límites:', err.message)
      return this.getCloseTactic(signal, 'NONE', 0, 0, 0)
    }
  }

  /**
   * Genera la táctica de cierre apropiada según la señal detectada y el margen disponible
   */
  private getCloseTactic(
    signal: CloseSignal,
    marginState: 'NONE' | 'NO_MARGIN' | 'HAS_MARGIN',
    price: number,
    minPrice: number,
    round: number,
    offeredAmount: number = 0,
    productName: string = '',
    userId: string = '',
    customerPhone: string = ''
  ): CloseStrategy {
    const margin = price - minPrice

    // Si el cliente pide volumen, saltamos directo al minPrice
    if (signal === 'VOLUME_OBJECTION' && marginState === 'HAS_MARGIN') {
      return {
        signal,
        tactic: 'VOLUME DISCOUNT',
        suggestedPrice: minPrice,
        condition: 'Llevar 2 o más unidades',
        hook: `⚡ OBJECIÓN DE VOLUMEN detectada. ESTRATEGIA:
- Ofrece exactamente el precio piso: S/ ${minPrice.toFixed(2)} cada uno.
- Condición clara: "Como llevas varias unidades, el sistema me permite dejarte cada una a precio de fábrica de S/ ${minPrice.toFixed(2)}".
- NUNCA menciones descuentos en porcentaje. Ofrece el precio final directo.`
      }
    }

    // Si es primer comprador y hay margen
    if (signal === 'FIRST_BUY' && marginState === 'HAS_MARGIN') {
      const suggested = price - (margin * 0.35)
      return {
        signal,
        tactic: 'WELCOME COUPON',
        suggestedPrice: suggested,
        condition: 'Completar tu primer pedido hoy mismo',
        hook: `🎉 SEÑAL DE CLIENTE NUEVO. ESTRATEGIA:
- Dale la bienvenida calurosa a la tienda.
- Ofrece un precio especial de bienvenida de S/ ${suggested.toFixed(2)} (Etapa 1).
- Condición: "Por ser tu primera compra con nosotros, te lo dejo en S/ ${suggested.toFixed(2)} si realizas el pago hoy".`
      }
    }

    // Si es comprador recurrente/VIP y hay margen
    if (signal === 'RECURRENT_BUY' && marginState === 'HAS_MARGIN') {
      const suggested = price - (margin * 0.35)
      return {
        signal,
        tactic: 'VIP LOYALTY',
        suggestedPrice: suggested,
        condition: 'Pago hoy',
        hook: `🌟 SEÑAL DE CLIENTE VIP/RECURRENTE. ESTRATEGIA:
- Agradécele con entusiasmo su fidelidad.
- Aplica el precio especial VIP de S/ ${suggested.toFixed(2)}.
- Condición: "Como agradecimiento por tu lealtad, te aplico el precio VIP de S/ ${suggested.toFixed(2)}".`
      }
    }

    // Caso A: No hay precio mínimo configurado o no hay margen
    if (marginState === 'NO_MARGIN' || marginState === 'NONE') {
      const baseTactics: Record<CloseSignal, CloseStrategy> = {
        PRICE_OBJECTION: {
          signal,
          tactic: 'ANCHORING + VALUE STACK',
          hook: `⚡ OBJECIÓN DE PRECIO (SIN MARGEN). ESTRATEGIA:
- NO des ningún descuento de precio. Di que el precio actual es el mínimo absoluto.
- Ancla el valor: "Este producto normalmente sale a un precio superior, pero lo tenemos en oferta especial limitada".
- Añade valor gratis: Resalta el "Envío Gratis 🚚" y la garantía oficial.
- Sé firme pero extremadamente amable.`
        },
        COMPETITOR_MENTION: {
          signal,
          tactic: 'DIFFERENTIATION',
          hook: `🥊 COMPETENCIA MENCIONADA. ESTRATEGIA:
- Destaca que no es solo el producto, sino la tranquilidad y seguridad de comprar con nosotros.
- Resalta: Envío en 24h a domicilio, stock físico garantizado en Lima, soporte post-venta personalizado y 100% de confiabilidad.
- NUNCA hables mal del competidor, solo haz brillar nuestra reputación y servicio.`
        },
        OWN_WEB_OFFER: {
          signal,
          tactic: 'CATALOG CLARIFICATION',
          hook: `🌐 CONFUSIÓN PRECIO WEB. ESTRATEGIA:
- Dile cordialmente al cliente que vas a verificar el precio de la web.
- Pídele amablemente una captura o que te indique qué producto vio para corregir cualquier discrepancia.
- Mantén el precio de catálogo de forma firme y atenta.`
        },
        HESITATION: {
          signal,
          tactic: 'URGENCY + SCARCITY',
          hook: `⏳ DUDA DETECTADA. ESTRATEGIA:
- Crea escasez real: "Tengo solo 2 unidades en stock físico de este modelo en Lima".
- Suaviza la venta: "Es una excelente decisión, se agotan sumamente rápido. ¿Te gustaría reservarlo antes de que se agoten?"`
        },
        CART_STALLED: {
          signal,
          tactic: 'CART NUDGE',
          hook: `🛒 CARRITO DETENIDO. ESTRATEGIA:
- Recuérdale de forma sutil lo que eligió y pregúntale si tiene alguna duda con el envío o el pago para ayudarle.`
        },
        CLEAR_TO_BUY: {
          signal,
          tactic: 'FAST CLOSE',
          hook: `✅ CLIENTE LISTO. ESTRATEGIA:
- Ve directo al checkout: Usa el comando [CHECKOUT] de inmediato para mandarle el QR y la boleta PDF.`
        },
        COUNTER_OFFER: {
          signal,
          tactic: 'FIRM REFUSAL',
          hook: `💰 CONTRAOFERTA (SIN MARGEN). ESTRATEGIA:
- Rechaza de forma sumamente educada la oferta de S/ ${offeredAmount}.
- "Lamentablemente nuestro margen es súper ajustado porque importamos directo de fábrica. El precio de S/ ${price} es el mínimo posible, pero te incluyo envío gratis y garantía total 🤝".`
        },
        FIRST_BUY: { signal, tactic: 'STANDARD', hook: '' },
        RECURRENT_BUY: { signal, tactic: 'STANDARD', hook: '' },
        VOLUME_OBJECTION: { signal, tactic: 'STANDARD', hook: '' },
        NONE: { signal, tactic: 'STANDARD', hook: '' }
      }

      return baseTactics[signal] || baseTactics.NONE
    }

    // Caso B: Tenemos margen y estamos regateando
    if (signal === 'COUNTER_OFFER') {
      // El cliente dio un número (offeredAmount)
      if (offeredAmount >= minPrice) {
        // La oferta del cliente está dentro de los límites! Aceptamos de inmediato para cerrar la venta
        return {
          signal,
          tactic: 'COUNTER_ACCEPT',
          suggestedPrice: offeredAmount,
          condition: 'Pagar hoy mismo para validar la oferta',
          hook: `🤝 CONTRAOFERTA ACEPTADA. ESTRATEGIA:
- ¡Felicidades! La oferta del cliente (S/ ${offeredAmount}) es justa y está por encima de nuestro precio piso.
- Acepta con entusiasmo: "¡Me parece un trato genial! Hacemos el pedido a S/ ${offeredAmount} si realizas el pago hoy mismo."
- Pasa de inmediato al cierre.`
        }
      } else {
        // La oferta es demasiado baja. Ofrecemos el escalón actual
        const currentOffer = this.calculateStepPrice(price, minPrice, round)
        return {
          signal,
          tactic: 'COUNTER_COUNTER',
          suggestedPrice: currentOffer,
          condition: 'Pago hoy',
          hook: `📉 CONTRAOFERTA MUY BAJA (Pidió S/ ${offeredAmount}). ESTRATEGIA:
- Dile de forma muy atenta que S/ ${offeredAmount} está por debajo del costo de fábrica.
- Haz una contra-propuesta con el precio sugerido de S/ ${currentOffer.toFixed(2)}.
- Condición: "Lo mínimo absoluto que te puedo ofrecer es S/ ${currentOffer.toFixed(2)}, pero cerramos la boleta y el envío gratis hoy mismo. ¿Te va bien?"`
        }
      }
    }

    if (signal === 'PRICE_OBJECTION') {
      const suggested = this.calculateStepPrice(price, minPrice, round)

      if (round === 1) {
        return {
          signal,
          tactic: 'ETAPA 1 — DESCUENTO SUAVE',
          suggestedPrice: suggested,
          condition: 'Realizar el pago hoy',
          hook: `🛡️ ETAPA 1 DE NEGOCIACIÓN. ESTRATEGIA:
- Cede de forma leve: ofrece dejarlo en S/ ${suggested.toFixed(2)} (descuento suave).
- Condiciona el descuento: "Te puedo dar un precio especial de S/ ${suggested.toFixed(2)} si concretas tu pedido hoy mismo 🚚".
- Agrega valor: Recuerda que incluye Envío Gratis a su domicilio.`
        }
      } else if (round === 2) {
        return {
          signal,
          tactic: 'ETAPA 2 — DESCUENTO MEDIO',
          suggestedPrice: suggested,
          condition: 'Concretar el pedido en las próximas 2 horas',
          hook: `⏳ ETAPA 2 DE NEGOCIACIÓN. ESTRATEGIA:
- El cliente sigue dudando. Ofrece dejarlo en S/ ${suggested.toFixed(2)}.
- Crea urgencia real: "Mira, te hago un esfuerzo adicional: S/ ${suggested.toFixed(2)}. Esta oferta es válida solo por hoy debido al límite de stock diario en almacén. ¿Te lo separo?"`
        }
      } else if (round === 3) {
        return {
          signal,
          tactic: 'ETAPA 3 — PRECIO PISO MÍNIMO',
          suggestedPrice: minPrice,
          condition: 'Aceptar el precio final e inamovible en este instante',
          hook: `⚠️ ETAPA 3 DE NEGOCIACIÓN (ÚLTIMO PRECIO). ESTRATEGIA:
- Ofrece exactamente el precio mínimo inamovible de S/ ${minPrice.toFixed(2)}.
- Sé claro de que es el último escalón: "S/ ${minPrice.toFixed(2)} es el precio piso absoluto que me permite el sistema para este producto. Es precio de costo de fábrica. ¿Te lo reservo?"`
        }
      } else {
        // Ronda 4+: Notificar al proveedor e imponer precio final
        this.notifyProviderNegotiation(userId, customerPhone, price, minPrice, round, productName).catch(() => {})
        return {
          signal,
          tactic: 'ETAPA 4+ — CIERRE DE HIERRO',
          suggestedPrice: minPrice,
          condition: 'Precio final inamovible',
          hook: `🛑 CIERRE DE HIERRO (RONDA ${round}). ESTRATEGIA:
- Mantente 100% firme en S/ ${minPrice.toFixed(2)}. No bajes ni un sol más.
- Aplica escasez absoluta: "Lamentablemente es imposible bajar más. Ya no quedan más promociones activas en sistema. Te puedo separar la última unidad a S/ ${minPrice.toFixed(2)} antes de que vuelva a su precio normal."`
        }
      }
    }

    // Otras señales por defecto
    const defaultTactics: Record<CloseSignal, CloseStrategy> = {
      COMPETITOR_MENTION: {
        signal,
        tactic: 'DIFFERENTIATION + RISK REVERSAL',
        hook: `🥊 COMPETENCIA MENCIONADA. ESTRATEGIA:
- Destaca que nuestro producto cuenta con garantía directa local en Lima, envío gratis veloz en 24h, y stock 100% real física.
- Si ellos ofrecen el mismo producto con menor precio, resalta la tranquilidad del soporte post-venta real.`
      },
      OWN_WEB_OFFER: {
        signal,
        tactic: 'CATALOG WEB MATCH',
        hook: `🌐 SEÑAL DE CATÁLOGO WEB PROPIO. ESTRATEGIA:
- Verifica el precio amablemente: "Déjame revisar eso en nuestro catálogo de inmediato...".
- Si hay discrepancia real, puedes ofrecerle igualar el precio web de inmediato usando el comando [CHECKOUT] con el precio correcto.`
      },
      HESITATION: {
        signal,
        tactic: 'SOFT NUDGE',
        hook: `⏳ DUDA DETECTADA. ESTRATEGIA:
- Resuelve sus preguntas con empatía. "Entiendo perfectamente, es una gran compra. ¿Hay algo específico sobre el tamaño, colores o garantía que te haga dudar para aclarártelo con gusto? 😊"`
      },
      CART_STALLED: {
        signal,
        tactic: 'CART NUDGE',
        hook: `🛒 CARRITO DETENIDO. ESTRATEGIA:
- Recuérdale amablemente su carrito y ofrécele ayuda directa para procesar su boleta.`
      },
      CLEAR_TO_BUY: {
        signal,
        tactic: 'FAST CLOSE',
        hook: `✅ CIERRE VELOZ. ESTRATEGIA:
- Ve directo al grano. Genera el checkout oficial enviando [CHECKOUT] inmediatamente.`
      },
      PRICE_OBJECTION: { signal, tactic: 'STANDARD', hook: '' },
      COUNTER_OFFER: { signal, tactic: 'STANDARD', hook: '' },
      FIRST_BUY: { signal, tactic: 'STANDARD', hook: '' },
      RECURRENT_BUY: { signal, tactic: 'STANDARD', hook: '' },
      VOLUME_OBJECTION: { signal, tactic: 'STANDARD', hook: '' },
      NONE: { signal, tactic: 'STANDARD', hook: '' }
    }

    return defaultTactics[signal] || defaultTactics.NONE
  }

  /**
   * Calcula el precio correspondiente a la etapa actual de regateo
   */
  private calculateStepPrice(price: number, minPrice: number, round: number): number {
    const margin = price - minPrice
    if (round <= 1) {
      return price - (margin * 0.35) // Etapa 1: cede el 35% del margen
    } else if (round === 2) {
      return price - (margin * 0.70) // Etapa 2: cede el 70% del margen
    } else {
      return minPrice // Etapa 3: cede el 100% (precio piso)
    }
  }

  /**
   * Envía una notificación por WhatsApp al proveedor en Ronda 3/4+
   */
  private async notifyProviderNegotiation(
    userId: string,
    customerPhone: string,
    price: number,
    minPrice: number,
    round: number,
    productName: string
  ) {
    try {
      const { rows: providerRows } = await db.query('SELECT phone FROM users WHERE id = $1', [userId])
      const providerPhone = providerRows[0]?.phone
      if (!providerPhone) return

      const alertMsg = `⚠️ *ALERTA DE NEGOCIACIÓN CALIENTE*\n\n👤 *Cliente:* +${customerPhone.replace(/\D/g, '')}\n🛒 *Producto:* ${productName || 'Producto'}\n🔄 *Rondas de regateo:* ${round}\n💰 *Precio Catálogo:* S/ ${price.toFixed(2)}\n📉 *Precio Mínimo Permitido:* S/ ${minPrice.toFixed(2)}\n\nEl bot Atti ha alcanzado el límite de descuento y se mantiene firme. Considera intervenir en el Chat en Vivo para cerrar la venta manualmente si es necesario. 🚀`
      await whatsappRouter.sendMessage(userId, providerPhone, alertMsg)
      logger.info(`[NEGOTIATION-ALERT] Alerta enviada al proveedor ${userId} para cliente ${customerPhone}`)
    } catch (e: any) {
      logger.error('[NEGOTIATION-ALERT] Error enviando alerta:', e.message)
    }
  }

  /**
   * Obtiene el número de mensajes del cliente
   */
  async getMessageCount(userId: string, customerPhone: string): Promise<number> {
    try {
      const { rows } = await db.query(
        `SELECT COUNT(*) as count FROM conversation_history 
         WHERE user_id = $1 AND customer_phone = $2 AND role = 'user'`,
        [userId, customerPhone]
      )
      return parseInt(rows[0]?.count || '0', 10)
    } catch (e) {
      return 0
    }
  }
}

export const negotiationEngine = new NegotiationEngine()
