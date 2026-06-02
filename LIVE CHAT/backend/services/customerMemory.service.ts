import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { aiService } from './ai.service'

// ══════════════════════════════════════════════════════════════════
// SERVICIO DE MEMORIA SELECTIVA — ADN COMERCIAL DEL CLIENTE v2
// Arquitectura de 5 Capas de Filtrado:
//   Capa 1: Pre-filtro sin costo (regex de trivialidades)
//   Capa 2: Gate de señales comerciales
//   Capa 3: IA extrae hechos con instrucciones estrictas
//   Capa 4: Gate de confianza (≥ 0.75) + límite por categoría
//   Capa 5: Deduplicación fuzzy antes de persistir
// ══════════════════════════════════════════════════════════════════

export interface CustomerFact {
  category: 'preference' | 'logistics' | 'payment' | 'profile' | 'feedback'
  fact: string
  confidence: number
}

// ── Capa 1: Patrones de mensajes triviales que NUNCA merecen API call ──
const TRIVIAL_PATTERNS = [
  /^(hola|hi|hey|buenas|buenos|bueno|buen|ok|okay|okey|sí|si|no|vale|claro|gracias|thanks|perfecto|listo|entendido|dale|ajá|aja|mmm|hmm|oki|jaja|jeje)[\s!.?]*$/i,
  /^[👍👌😊❤️🙏😂😅✅🔥💯]{1,3}$/,
]

// ── Capa 2: El mensaje debe tener al menos una señal comercial ─────
const COMMERCIAL_SIGNAL = /talla|color|modelo|marca|precio|pagar|yape|plin|transfer|direcci[oó]n|distrito|enviar|env[ií]o|entrega|necesito|quiero|busco|comprar|pedido|cu[aá]nto|celular|tel[eé]fono|correo|nombre|soy|vivo|prefer|talla|zapatill|polera|camis|jean|pantal|zapato|bolso|billetera|reloj|celular|tablet|laptop/i

// ── Límites por categoría: máx hechos guardados por tipo ───────────
const CATEGORY_LIMITS: Record<string, number> = {
  preference: 4, // preferencias de producto (marca, talla, color)
  logistics:  3, // dirección, distrito, courier preferido
  payment:    2, // Yape, Plin, tarjeta, etc.
  profile:    3, // nombre, teléfono, correo
  feedback:   2, // opiniones relevantes
}

class CustomerMemoryService {
  constructor() {
    db.query(`
      CREATE TABLE IF NOT EXISTS customer_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_phone TEXT NOT NULL,
        key_facts JSONB DEFAULT '[]',
        summary TEXT,
        last_updated TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, customer_phone)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_memory_lookup ON customer_memory(user_id, customer_phone);
    `).then(() => {
      logger.info('🧠 [MEMORY] Sistema de memoria ADN v2 inicializado.')
    }).catch((e: any) => {
      logger.warn('[MEMORY] Tabla customer_memory ya existe o error menor:', e.message)
    })
  }

  async getMemory(userId: string, customerPhone: string) {
    const { rows } = await db.query(
      'SELECT key_facts, summary FROM customer_memory WHERE user_id = $1 AND customer_phone = $2',
      [userId, customerPhone]
    )
    return rows[0] || { key_facts: [], summary: '' }
  }

  // ── Capa 1+2: Pre-filtro de costo cero (sin API) ──────────────────
  private isTrivial(msg: string): boolean {
    const clean = msg.trim()
    if (clean.length < 8) return true
    if (TRIVIAL_PATTERNS.some(p => p.test(clean))) return true
    if (!COMMERCIAL_SIGNAL.test(clean)) return true // Sin señal comercial = ruido
    return false
  }

  // ── Capa 5: Deduplicación fuzzy por palabras clave ─────────────────
  private isDuplicate(newFact: string, existing: CustomerFact[]): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-záéíóúñ\s]/g, '').trim()
    const newWords = new Set(normalize(newFact).split(/\s+/).filter(w => w.length > 3))
    if (newWords.size === 0) return false

    return existing.some(ef => {
      const exWords = new Set(normalize(ef.fact).split(/\s+/).filter(w => w.length > 3))
      const shared = [...newWords].filter(w => exWords.has(w)).length
      return (shared / newWords.size) >= 0.65 // 65% de palabras coinciden = duplicado
    })
  }

  // ── Capa 4b: Aplicar límites por categoría (queda lo más reciente) ─
  private applyLimits(facts: CustomerFact[]): CustomerFact[] {
    const byCategory: Record<string, CustomerFact[]> = {}
    for (const f of facts) {
      if (!byCategory[f.category]) byCategory[f.category] = []
      byCategory[f.category].push(f)
    }
    const result: CustomerFact[] = []
    for (const [cat, catFacts] of Object.entries(byCategory)) {
      const limit = CATEGORY_LIMITS[cat] ?? 3
      result.push(...catFacts.slice(-limit)) // Mantener los más recientes
    }
    return result
  }

  async extractAndSave(userId: string, customerPhone: string, messageBody: string) {
    try {
      // ── Capa 1+2: Pre-filtro sin costo de API ─────────────────────
      if (this.isTrivial(messageBody)) {
        return // silencioso: no gastar API en mensajes triviales
      }

      const currentMemory = await this.getMemory(userId, customerPhone)
      const currentFacts: CustomerFact[] = currentMemory.key_facts || []

      // ── Capa 3: IA extrae hechos con prompt quirúrgico ─────────────
      const extractionPrompt = `Eres un extractor de datos comerciales para una tienda online en Perú. Analiza el siguiente mensaje de un cliente y extrae SOLO datos que ayuden a vender mejor.

MENSAJE: "${messageBody}"

DATOS YA GUARDADOS (NO repetir):
${currentFacts.length > 0 ? currentFacts.map(f => `- [${f.category}] ${f.fact}`).join('\n') : 'Ninguno.'}

REGLAS ESTRICTAS:
1. SOLO extraer: tallas, colores, marcas favoritas, presupuesto, dirección/distrito, método de pago preferido, nombre del cliente.
2. Si el mensaje es saludo, queja vaga o charla sin datos útiles → newFacts vacío.
3. Máximo 2 hechos por análisis. Cada hecho en 10 palabras o menos.
4. confidence: 1.0=certero, 0.8=probable, 0.75=posible, <0.75=ignorar.

RESPONDE SOLO CON JSON:
{"newFacts":[{"category":"preference|logistics|payment|profile|feedback","fact":"...","confidence":0.9}],"updatedSummary":"resumen del cliente en 12 palabras máx"}`

      const aiResponse = await aiService.chat(extractionPrompt)

      let data: { newFacts: CustomerFact[]; updatedSummary: string } | null = null
      try {
        const match = aiResponse.text.match(/\{[\s\S]*\}/)
        data = match ? JSON.parse(match[0]) : null
      } catch {
        logger.warn('[MEMORY] IA devolvió JSON inválido — omitiendo sin guardar.')
        return
      }

      if (!data || !Array.isArray(data.newFacts)) return

      // ── Capa 4a: Gate de confianza ≥ 0.75 ─────────────────────────
      const trustedFacts = data.newFacts.filter(f => (f.confidence ?? 0) >= 0.75)

      // ── Capa 5: Deduplicación fuzzy ────────────────────────────────
      const uniqueFacts = trustedFacts.filter(f => !this.isDuplicate(f.fact, currentFacts))

      const noChange = uniqueFacts.length === 0 &&
        (!data.updatedSummary || data.updatedSummary === currentMemory.summary)

      if (noChange) {
        logger.info(`[MEMORY] Sin hechos nuevos válidos para ${customerPhone} — BD intacta.`)
        return
      }

      // ── Capa 4b: Combinar y aplicar límites por categoría ──────────
      const merged = this.applyLimits([...currentFacts, ...uniqueFacts])

      await db.query(
        `INSERT INTO customer_memory (user_id, customer_phone, key_facts, summary, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, customer_phone)
         DO UPDATE SET key_facts = $3, summary = $4, last_updated = NOW()`,
        [userId, customerPhone, JSON.stringify(merged), data.updatedSummary || currentMemory.summary]
      )

      logger.info(`🧠 [MEMORY] ${customerPhone}: +${uniqueFacts.length} guardados | ${data.newFacts.length - uniqueFacts.length} filtrados | Total: ${merged.length}`)

    } catch (error: any) {
      logger.error('[MEMORY] Error en extractAndSave:', error?.message || error)
    }
  }

  // Contexto organizado por relevancia comercial para inyectar al prompt
  async getMemoryContext(userId: string, customerPhone: string): Promise<string> {
    const memory = await this.getMemory(userId, customerPhone)
    const facts: CustomerFact[] = memory.key_facts || []
    
    // Buscar facturación
    const billingFacts = facts.filter(f => f.category === 'profile' && f.fact.includes('DNI:'))
    let billingString = billingFacts.length > 0 ? `\n🏷️ Facturación Registrada: ${billingFacts.map(f => f.fact).join(', ')}` : ''

    if (!memory.summary && facts.length === 0) return ''

    const catLabels: Record<string, string> = {
      profile:    '👤 Perfil',
      preference: '❤️ Preferencias',
      logistics:  '📦 Entrega',
      payment:    '💳 Pago preferido',
      feedback:   '💬 Opiniones',
    }

    const grouped: Record<string, string[]> = {}
    for (const f of facts) {
      if (f.fact.includes('DNI:')) continue; // Skip billing facts from main list
      const label = catLabels[f.category] || f.category
      if (!grouped[label]) grouped[label] = []
      grouped[label].push(f.fact)
    }

    let context = `\n🧠 [ADN DEL CLIENTE - Usa esto para personalizar tu respuesta]\n`
    if (memory.summary) context += `Resumen: ${memory.summary}\n`
    for (const [label, items] of Object.entries(grouped)) {
      context += `${label}: ${items.join(' | ')}\n`
    }
    context += billingString
    return context
  }

  // ── Guardar datos de facturación con validación ────────────────────────
  private validateBillingInfo(name: string, dni: string): boolean {
    const nameParts = name.trim().split(/\s+/).filter(Boolean);
    const validName = nameParts.length >= 3; // al menos 3 palabras (Nombres y Apellidos completos)
    const digits = dni.replace(/\D/g, '');
    const validDni = digits.length === 8 || digits.length === 11;
    if (!validName) logger.warn(`[MEMORY] Nombre incompleto (mínimo 3 palabras): "${name}"`);
    if (!validDni) logger.warn(`[MEMORY] DNI/RUC inválido (debe ser 8 o 11 dígitos): "${dni}"`);
    return validName && validDni;
  }

  async saveBillingInfo(userId: string, customerPhone: string, name: string, dni: string) {
    try {
      if (!this.validateBillingInfo(name, dni)) {
        logger.warn('[MEMORY] Intento guardar datos de facturación no válidos. Abortando.');
        return;
      }
      const memory = await this.getMemory(userId, customerPhone);
      let facts: CustomerFact[] = memory.key_facts || [];
      // eliminar datos previos de facturación
      facts = facts.filter(f => !(f.category === 'profile' && f.fact.includes('DNI:')));
      facts.push({ category: 'profile', fact: `${name} (DNI: ${dni})`, confidence: 1.0 });
      await db.query(
        `INSERT INTO customer_memory (user_id, customer_phone, key_facts, summary, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, customer_phone)
         DO UPDATE SET key_facts = $3, last_updated = NOW()`,
        [userId, customerPhone, JSON.stringify(facts), memory.summary]
      );
      logger.info(`[MEMORY] Datos de facturación guardados para ${customerPhone}`);
    } catch (error: any) {
      logger.error('[MEMORY] Error guardando billing info:', error?.message || error);
    }
  }

  async saveShippingInfo(userId: string, customerPhone: string, province: string, district: string, deliveryMethod: string, details?: string) {
    try {
      const memory = await this.getMemory(userId, customerPhone);
      let facts: CustomerFact[] = memory.key_facts || [];
      // eliminar datos previos de logística
      facts = facts.filter(f => !(f.category === 'logistics' && (
        f.fact.startsWith('Provincia:') || 
        f.fact.startsWith('Distrito:') || 
        f.fact.startsWith('Método de entrega:') ||
        f.fact.startsWith('Detalles de entrega:')
      )));
      
      facts.push({ category: 'logistics', fact: `Provincia: ${province.trim()}`, confidence: 1.0 });
      facts.push({ category: 'logistics', fact: `Distrito: ${district.trim()}`, confidence: 1.0 });
      facts.push({ category: 'logistics', fact: `Método de entrega: ${deliveryMethod.trim()}`, confidence: 1.0 });
      if (details) {
        facts.push({ category: 'logistics', fact: `Detalles de entrega: ${details.trim()}`, confidence: 1.0 });
      }
      
      await db.query(
        `INSERT INTO customer_memory (user_id, customer_phone, key_facts, summary, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, customer_phone)
         DO UPDATE SET key_facts = $3, last_updated = NOW()`,
        [userId, customerPhone, JSON.stringify(facts), memory.summary]
      );
      logger.info(`[MEMORY] Datos de envío guardados para ${customerPhone}`);
    } catch (error: any) {
      logger.error('[MEMORY] Error guardando shipping info:', error?.message || error);
    }
  }

  async getShippingInfo(userId: string, customerPhone: string): Promise<{province: string, district: string, deliveryMethod: string, details: string} | null> {
    try {
      const memory = await this.getMemory(userId, customerPhone);
      const facts: CustomerFact[] = memory.key_facts || [];
      
      const provFact = facts.find(f => f.category === 'logistics' && f.fact.startsWith('Provincia:'));
      const distFact = facts.find(f => f.category === 'logistics' && f.fact.startsWith('Distrito:'));
      const methodFact = facts.find(f => f.category === 'logistics' && f.fact.startsWith('Método de entrega:'));
      const detailsFact = facts.find(f => f.category === 'logistics' && f.fact.startsWith('Detalles de entrega:'));
      
      if (provFact && distFact && methodFact) {
        return {
          province: provFact.fact.replace('Provincia:', '').trim(),
          district: distFact.fact.replace('Distrito:', '').trim(),
          deliveryMethod: methodFact.fact.replace('Método de entrega:', '').trim(),
          details: detailsFact ? detailsFact.fact.replace('Detalles de entrega:', '').trim() : ''
        };
      }
      return null;
    } catch (error: any) {
      logger.error('[MEMORY] Error obteniendo shipping info:', error?.message || error);
      return null;
    }
  }

  async getBillingInfo(userId: string, customerPhone: string): Promise<{name: string, dni: string} | null> {
    const memory = await this.getMemory(userId, customerPhone)
    const facts: CustomerFact[] = memory.key_facts || []
    
    // 1. Buscar formato combinado estándar: "Nombre (DNI: XXX)"
    const billingFact = facts.find(f => f.category === 'profile' && f.fact.includes('DNI:'))
    if (billingFact) {
      const match = billingFact.fact.match(/^(.*?)\s*\(DNI:\s*(.*?)\)$/)
      if (match) {
        return { name: match[1].trim(), dni: match[2].trim() }
      }
    }

    // 2. Recuperación Inteligente: Buscar hechos sueltos de DNI y Nombre
    let detectedDni = ''
    let detectedName = ''

    // A. Buscar secuencia de 8 u 11 dígitos (DNI o RUC peruano)
    for (const f of facts) {
      const dniMatch = f.fact.match(/\b(\d{8}|\d{11})\b/)
      if (dniMatch) {
        detectedDni = dniMatch[1]
        break
      }
    }

    // B. Buscar nombre en perfil que no sea numérico
    for (const f of facts) {
      if (f.category === 'profile') {
        const nameClean = f.fact.replace(/^(nombre|name|soy|me llamo|cliente)[:\s]*/i, '').trim()
        if (!/\b(\d{8}|\d{11})\b/.test(nameClean) && nameClean.length > 2) {
          detectedName = nameClean
          break
        }
      }
    }

    // C. Si tenemos ambos de forma dispersa, sanar la memoria y retornar
    if (detectedDni && detectedName) {
      logger.info(`[MEMORY] Consolidando datos tributarios dispersos para ${customerPhone}: ${detectedName} / ${detectedDni}`)
      // No bloqueante: guardar consolidado
      this.saveBillingInfo(userId, customerPhone, detectedName, detectedDni).catch(() => {})
      return { name: detectedName, dni: detectedDni }
    }

    return null
  }
}

export const customerMemoryService = new CustomerMemoryService()
