/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR "BUYER PERSONA" — Análisis de Personalidad del Cliente
 * ═══════════════════════════════════════════════════════════
 * Clasifica al cliente según su comportamiento en la conversación.
 * Adapta el tono del bot a su perfil psicológico en <5ms.
 * Nivel: 🔱 DIOS
 */

export type BuyerPersonaType =
  | 'IMPULSE_BUYER'   // Decide rápido, emocional, quiere emoción
  | 'ANALYTICAL'      // Pide datos, compara, quiere certeza
  | 'BARGAIN_HUNTER'  // Siempre pregunta precio, busca descuento
  | 'LOYAL_FAN'       // Ya compró antes, confía, quiere VIP trato
  | 'WINDOW_SHOPPER'  // Solo mira, no compra fácil, necesita empujón
  | 'NEW_BUYER'       // Primera vez, necesita confianza y guía

interface PersonaSignal {
  keywords: string[]
  persona: BuyerPersonaType
  weight: number
}

const PERSONA_SIGNALS: PersonaSignal[] = [
  {
    persona: 'IMPULSE_BUYER',
    weight: 2,
    keywords: ['lo quiero', 'lo llevo', 'dale', 'ahora', 'ya', 'cuanto cuesta eso', 'ese mismo', 'cómpralo', 'perfecto', 'excelente', 'ahorita']
  },
  {
    persona: 'ANALYTICAL',
    weight: 2,
    keywords: ['especificaciones', 'garantia', 'material', 'de qué es', 'cuánto dura', 'comparado', 'diferencia', 'mejor opción', 'características', 'talla exacta', 'peso', 'dimensiones', 'original', 'certificado']
  },
  {
    persona: 'BARGAIN_HUNTER',
    weight: 2,
    keywords: ['descuento', 'oferta', 'rebaja', 'más barato', 'precio justo', 'caro', 'demasiado', 'me sale menos', 'en otro lado', 'me haces precio', 'cuánto me dejas', 'algo más económico', 'por mayor']
  },
  {
    persona: 'LOYAL_FAN',
    weight: 3,
    keywords: ['siempre compro', 'compré antes', 'la vez pasada', 'mi pedido anterior', 'recomendé', 'mis amigos', 'ya soy cliente', 'cliente frecuente', 'tengo cuenta', 'ya pedí']
  },
  {
    persona: 'WINDOW_SHOPPER',
    weight: 1,
    keywords: ['solo mirando', 'viendo', 'qué tienen', 'a ver', 'explorando', 'voy a ver', 'después', 'cuando tenga', 'quizás', 'tal vez', 'lo pensaré']
  }
]

export interface PersonaAnalysis {
  persona: BuyerPersonaType
  confidence: number
  responseStrategy: string
  urgencyLevel: 'HIGH' | 'MEDIUM' | 'LOW'
}

class BuyerPersonaEngine {
  /**
   * Analiza TODA la conversación para detectar el perfil del cliente.
   * @param messages Array de mensajes del cliente (más recientes = más peso)
   */
  analyze(messages: string[]): PersonaAnalysis {
    const combinedText = messages.join(' ').toLowerCase()

    const scores: Record<BuyerPersonaType, number> = {
      IMPULSE_BUYER: 0,
      ANALYTICAL: 0,
      BARGAIN_HUNTER: 0,
      LOYAL_FAN: 0,
      WINDOW_SHOPPER: 0,
      NEW_BUYER: 0,
    }

    for (const signal of PERSONA_SIGNALS) {
      for (const kw of signal.keywords) {
        if (combinedText.includes(kw)) {
          scores[signal.persona] += signal.weight
        }
      }
    }

    // Si no hay señales claras, es un comprador nuevo
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
    if (totalScore === 0) {
      scores.NEW_BUYER = 1
    }

    const topPersona = Object.entries(scores).sort(([, a], [, b]) => b - a)[0]
    const persona = topPersona[0] as BuyerPersonaType
    const confidence = totalScore > 0 ? Math.min(topPersona[1] / totalScore, 1) : 0.5

    const strategies: Record<BuyerPersonaType, { strategy: string; urgency: 'HIGH' | 'MEDIUM' | 'LOW' }> = {
      IMPULSE_BUYER: {
        urgency: 'HIGH',
        strategy: `🔥 PERFIL: Comprador Impulsivo. ESTRATEGIA: Usa lenguaje de URGENCIA ("¡Solo queda 1!", "¡Hoy es el último día!"). Responde rápido. Muéstrale fotos inmediatamente. Evita explicaciones largas.`
      },
      ANALYTICAL: {
        urgency: 'LOW',
        strategy: `🧠 PERFIL: Comprador Analítico. ESTRATEGIA: Sé preciso. Comparte DATOS REALES (material, talla, garantía). Compara ventajas sobre otras opciones. Genera confianza con información técnica.`
      },
      BARGAIN_HUNTER: {
        urgency: 'MEDIUM',
        strategy: `💰 PERFIL: Cazador de Ofertas. ESTRATEGIA: Destaca el VALOR, no el precio. Menciona si incluye envío gratis o algún bono. Si tiene pedidos previos, ofrécele un descuento de cliente frecuente.`
      },
      LOYAL_FAN: {
        urgency: 'MEDIUM',
        strategy: `⭐ PERFIL: Cliente Leal / Fan. ESTRATEGIA: Trátalo como VIP desde el inicio. Dile "recuerdo que te gustó X". Ofrécele acceso anticipado o precio especial. Agradece su lealtad.`
      },
      WINDOW_SHOPPER: {
        urgency: 'LOW',
        strategy: `👀 PERFIL: Visitante / Mirón. ESTRATEGIA: No presiones. Genera curiosidad ("Tenemos algo nuevo que podría gustarte"). Dale valor sin pedir compra. Planta la semilla.`
      },
      NEW_BUYER: {
        urgency: 'MEDIUM',
        strategy: `🌟 PERFIL: Comprador Nuevo. ESTRATEGIA: Genera CONFIANZA primero. Explica el proceso de compra. Muestra testimonios o garantías. Sé muy servicial y paciente.`
      }
    }

    const selected = strategies[persona]
    return {
      persona,
      confidence,
      responseStrategy: selected.strategy,
      urgencyLevel: selected.urgency
    }
  }
}

export const buyerPersonaEngine = new BuyerPersonaEngine()
