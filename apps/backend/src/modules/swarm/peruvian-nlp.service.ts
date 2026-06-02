import { Injectable, Logger } from '@nestjs/common';

export interface NormalizedInput {
  originalText: string;
  normalizedText: string;
  detectedIntents: string[];
  inferredBudgetPEN?: number;
}

@Injectable()
export class PeruvianNlpService {
  private readonly logger = new Logger(PeruvianNlpService.name);

  // Diccionario básico de modismos y jergas peruanas para normalización semántica
  private readonly slangDictionary: Array<{ pattern: RegExp; replacement: string; intent?: string }> = [
    { pattern: /\b(yapeame|yapear|yape)\b/gi, replacement: 'pagar con Yape', intent: 'PAYMENT_METHOD_YAPE' },
    { pattern: /\b(plineame|plinear|plin)\b/gi, replacement: 'pagar con Plin', intent: 'PAYMENT_METHOD_PLIN' },
    { pattern: /\b(lucas|luca|mangos|mango|soles|sol)\b/gi, replacement: 'Soles (moneda nacional PEN)', intent: 'CURRENCY_PEN' },
    { pattern: /\b(al toque|fast|volando|ya mismo)\b/gi, replacement: 'de manera urgente e inmediata', intent: 'URGENT_REQUEST' },
    { pattern: /\b(estoy aguja|no tengo plata|misio|tela)\b/gi, replacement: 'tengo presupuesto limitado o busco descuento', intent: 'NEGOTIATION_BUDGET_LOW' },
    { pattern: /\b(palta|tengo palta|seguro)\b/gi, replacement: 'desconfianza o temor en seguridad de pago', intent: 'SECURITY_TRUST_ISSUE' },
    { pattern: /\b(pata|bro|causa|chochera|batería)\b/gi, replacement: 'amigo / cliente cordial', intent: 'FRIENDLY_TONE' },
    { pattern: /\b(jato|mi jato)\b/gi, replacement: 'mi casa / domicilio de entrega', intent: 'SHIPPING_DOMICILE' },
    { pattern: /\b(contraentrega|pagar en casa|pago al recibir)\b/gi, replacement: 'pago en efectivo al recibir el producto', intent: 'PAYMENT_METHOD_CASH_ON_DELIVERY' },
    { pattern: /\b(habla con humano|pásame con alguien|asesor real)\b/gi, replacement: 'solicitar derivación a un operador humano', intent: 'HUMAN_HANDOFF' },
  ];

  /**
   * Procesa, limpia y normaliza cualquier input con jerga peruana en milisegundos.
   */
  normalizePeruvianSlang(text: string): NormalizedInput {
    let normalized = text;
    const detectedIntents: string[] = [];
    let inferredBudgetPEN: number | undefined;

    // 1. Detección de patrones monetarios específicos (Ej: "50 lucas", "100 mangos")
    const moneyMatch = text.match(/(\d+)\s*(lucas|luca|mangos|mango)/i);
    if (moneyMatch) {
      inferredBudgetPEN = parseInt(moneyMatch[1], 10);
      detectedIntents.push('SPECIFIC_PEN_AMOUNT');
    }

    // 2. Mapeo y reemplazo de patrones semánticos
    for (const item of this.slangDictionary) {
      if (item.pattern.test(normalized)) {
        normalized = normalized.replace(item.pattern, item.replacement);
        if (item.intent && !detectedIntents.includes(item.intent)) {
          detectedIntents.push(item.intent);
        }
      }
    }

    this.logger.log(`[Peruvian NLP] Jerga procesada. Intenciones: [${detectedIntents.join(', ')}]`);

    return {
      originalText: text,
      normalizedText: normalized,
      detectedIntents,
      inferredBudgetPEN,
    };
  }
}
