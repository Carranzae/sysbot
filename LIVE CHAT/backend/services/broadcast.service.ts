import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { aiService } from './ai.service'

export interface BroadcastResult {
  sent: number
  failed: number
  targetCount: number
  preview: string
}

export class BroadcastService {
  /**
   * Interpreta el comando del admin con IA y arma el plan de envío.
   */
  async parseAdminCommand(command: string, userId: string): Promise<{
    segment: string
    baseMessage: string
    targetQuery: string
    queryParams: any[]
  } | null> {
    try {
      const prompt = `El dueño de una tienda te dio este comando de marketing:
      "${command}"
      
      Analiza el comando y extrae:
      1. segment: A qué tipo de clientes va dirigido (ej: "compradores de zapatillas", "todos los clientes", "clientes del último mes")
      2. baseMessage: El mensaje base persuasivo y personalizado que se enviará (usa {{name}} para el nombre del cliente)
      
      Responde SOLO en JSON:
      {
        "segment": "string",
        "baseMessage": "string"
      }`

      const result = await aiService.chat(prompt)
      const text = result.text
      const parsed = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim())

      // Determinar la query SQL según el segmento detectado
      let targetQuery = `SELECT DISTINCT o.customer_phone, o.customer_name FROM orders o WHERE o.user_id = $1 AND o.customer_phone IS NOT NULL`
      let queryParams: any[] = [userId]

      const segmentLower = parsed.segment.toLowerCase()

      if (segmentLower.includes('último mes') || segmentLower.includes('reciente')) {
        targetQuery += ` AND o.created_at >= NOW() - INTERVAL '30 days'`
      } else if (segmentLower.includes('pending') || segmentLower.includes('pendiente')) {
        targetQuery += ` AND o.status = 'pending'`
      } else if (segmentLower.includes('completado') || segmentLower.includes('entregado')) {
        targetQuery += ` AND o.status = 'completed'`
      }

      // Si menciona un producto específico, filtramos por ese producto
      const productMatch = command.match(/(compraron|compró|compraron?)\s+([a-záéíóúüñ\s]+)/i)
      if (productMatch) {
        const productKeyword = productMatch[2].trim()
        targetQuery = `
          SELECT DISTINCT o.customer_phone, o.customer_name 
          FROM orders o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.products) = 'array' THEN o.products ELSE '[]'::jsonb END) as p
          WHERE o.user_id = $1 
            AND o.customer_phone IS NOT NULL
            AND (p->>'name' ILIKE $2)`
        queryParams = [userId, `%${productKeyword}%`]
      }

      return {
        segment: parsed.segment,
        baseMessage: parsed.baseMessage,
        targetQuery,
        queryParams,
      }
    } catch (err: any) {
      logger.error('[BROADCAST] Error analizando comando:', { error: err.message })
      return null
    }
  }

  /**
   * Obtiene una vista previa de cuántos clientes serán alcanzados.
   */
  async getTargetPreview(plan: ReturnType<typeof this.parseAdminCommand> extends Promise<infer T> ? T : never): Promise<{ count: number; sampleNames: string[] }> {
    if (!plan) return { count: 0, sampleNames: [] }
    const { rows } = await db.query(plan.targetQuery + ' LIMIT 5', plan.queryParams)
    const countResult = await db.query(`SELECT COUNT(*) FROM (${plan.targetQuery}) sub`, plan.queryParams)
    return {
      count: parseInt(countResult.rows[0].count),
      sampleNames: rows.map((r: any) => r.customer_name?.split(' ')[0] || 'Cliente'),
    }
  }

  /**
   * Ejecuta el broadcast enviando mensajes personalizados a cada cliente.
   */
  async execute(
    userId: string,
    plan: { targetQuery: string; queryParams: any[]; baseMessage: string },
    sendFn: (phone: string, message: string) => Promise<void>
  ): Promise<BroadcastResult> {
    const { rows: targets } = await db.query(plan.targetQuery, plan.queryParams)

    let sent = 0
    let failed = 0

    for (const target of targets) {
      try {
        // Personalizar el mensaje con el nombre del cliente
        const firstName = target.customer_name?.split(' ')[0] || 'amigo/a'
        const personalizedMsg = plan.baseMessage.replace(/{{name}}/g, firstName)

        await sendFn(target.customer_phone, personalizedMsg)
        sent++

        // Delay para evitar spam y bloqueos de WhatsApp
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (err: any) {
        logger.error(`[BROADCAST] Error enviando a ${target.customer_phone}:`, { error: err.message })
        failed++
      }
    }

    return {
      sent,
      failed,
      targetCount: targets.length,
      preview: plan.baseMessage,
    }
  }
}

export const broadcastService = new BroadcastService()
