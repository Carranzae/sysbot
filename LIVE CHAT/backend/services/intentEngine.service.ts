/**
 * MOTOR 2 — Intent Engine
 * Clasifica el mensaje del cliente en <10ms sin consumo de API.
 * Solo los mensajes COMPLEJOS pasan a la IA completa.
 */

export type IntentType =
  | 'GREETING'
  | 'CATALOG'
  | 'BUY'
  | 'TRACK'
  | 'PRICE'
  | 'IMAGE'
  | 'HOURS'
  | 'LOCATION'
  | 'VOICE'
  | 'PDF'
  | 'UPSELL_PROBE'
  | 'PAYMENT'
  | 'COMPLAINT'
  | 'INFO'
  | 'POLICY_QUERY'
  | 'RECEIPT_REQUEST'
  | 'COMPLEX'

interface IntentRule {
  intent: IntentType
  keywords: string[]
  priority: number
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'RECEIPT_REQUEST',
    priority: 1,
    keywords: ['mi boleta', 'dame mi boleta', 'mi factura', 'mi recibo', 'quiero mi boleta', 'quiero mi factura', 'quiero mi recibo', 'pásame mi boleta', 'pásame la boleta', 'pásame el recibo', 'dame la boleta', 'dame el recibo', 'dame el comprobante', 'generar boleta', 'genera boleta', 'genera mi boleta', 'dónde está mi boleta', 'dónde está mi factura', 'mi comprobante'],
  },
  {
    intent: 'GREETING',
    priority: 2,
    keywords: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'buenas', 'hey', 'hi', 'saludos', 'buen día', 'k tal', 'q tal', 'oe', 'habla', 'ola', 'holis', 'holi', 'alo', 'holas', 'q tranza', 'causa', 'mano', 'bro', 'brother', 'amigo', 'señor', 'joven', 'señorita'],
  },
  {
    intent: 'COMPLAINT',
    priority: 3,
    keywords: ['molesto', 'molesta', 'enojado', 'pésimo', 'terrible', 'fraude', 'engaño', 'estafa', 'reclamo', 'queja', 'problema', 'mal servicio', 'no llegó', 'nunca llegó', 'devolver', 'devolución', 'roto', 'mal estado', 'incompleto', 'falta', 'basura', 'ladrones', 'rateros', 'denuncia', 'indecopi', 'asqueroso', 'decepcion', 'decepción', 'horrible', 'malisimo'],
  },
  {
    intent: 'TRACK',
    priority: 3,
    keywords: ['mi pedido', 'mi compra', 'estado del pedido', 'dónde está', 'cuando llega', 'cuándo llega', 'seguimiento', 'tracking', 'número de guía', 'guía', 'courier', 'llegó', 'no llegó', 'agencia', 'recojo', 'rastrear', 'rastreo', 'donde esta mi paquete', 'paquete', 'encomienda', 'estado de envio', 'demora', 'tarda', 'falta mucho'],
  },
  {
    intent: 'VOICE',
    priority: 4,
    keywords: ['audio', 'manda un audio', 'dime', 'habla', 'escucho', 'por voz', 'nota de voz', 'grábame', 'no puedo leer', 'estoy manejando', 'mandame audio', 'pasame un audio', 'hablame'],
  },
  {
    intent: 'PDF',
    priority: 5,
    keywords: ['catálogo', 'catalogo', 'catalago', 'catálogo completo', 'pdf', 'todo el catálogo', 'lista completa', 'todos los productos', 'pasame el pdf', 'catalogo pdf', 'archivo', 'documento', 'brochure', 'portafolio', 'lista de precios'],
  },
  {
    intent: 'IMAGE',
    priority: 6,
    keywords: ['foto', 'imagen', 'muéstrame', 'cómo es', 'cómo luce', 'se ve', 'una foto', 'fotos', 'imagenes', 'fotito', 'pasame foto', 'enseñame', 'tienes fotos', 'video', 'vidio', 'grabacion'],
  },
  {
    intent: 'PRICE',
    priority: 7,
    keywords: ['cuánto cuesta', 'cuanto cuesta', 'precio de', 'precio del', 'vale', 'cuesta', 'a cuánto', 'a cuanto', 'cuánto sale', 'cuanto sale', 'precio', 'precios', 'costo', 'valor', 'cuanto esta', 'a como', 'q precio', 'k precio', 'cuanto vale', 'cotizar', 'cotizacion'],
  },
  {
    intent: 'BUY',
    priority: 8,
    keywords: ['quiero comprar', 'quiero pedir', 'quiero llevar', 'me llevo', 'pedido', 'hacer un pedido', 'comprar', 'adquirir', 'pagar', 'checkout', 'quiero uno', 'quiero una', 'lo quiero', 'la quiero', 'dame uno', 'dame una', 'separa', 'separame', 'quiero eso', 'me interesa', 'como compro', 'donde pago', 'para comprar', 'quiero adquirir'],
  },
  {
    intent: 'CATALOG',
    priority: 9,
    keywords: ['productos', 'qué tienen', 'que tienen', 'qué venden', 'que venden', 'ver productos', 'mostrar productos', 'qué hay', 'que hay', 'opciones', 'disponible', 'stock', 'novedades', 'ofertas', 'promociones', 'cosas', 'articulos', 'mercaderia', 'tienen', 'venden', 'busco', 'estoy buscando'],
  },
  {
    intent: 'HOURS',
    priority: 10,
    keywords: ['horario', 'horarios', 'a qué hora', 'atienden', 'abren', 'cierran', 'cuando atienden', 'están abiertos', 'hora de atencion', 'dias atienden', 'hasta que hora', 'feriados', 'domingos', 'abierto'],
  },
  {
    intent: 'LOCATION',
    priority: 11,
    keywords: ['dirección', 'donde están', 'dónde están', 'ubicación', 'maps', 'cómo llegar', 'mapa', 'local', 'tienda física', 'fisica', 'tienen local', 'donde queda', 'en que parte', 'referencia', 'direccion', 'lugar', 'boutique', 'showroom'],
  },
  {
    intent: 'UPSELL_PROBE',
    priority: 12,
    keywords: ['algo más', 'qué más tienen', 'hay algo parecido', 'algo similar', 'otra opción', 'también tienen', 'combo', 'pack', 'kit', 'juego', 'conjunto', 'hace juego', 'para combinar', 'accesorios', 'extras', 'complemento'],
  },
  {
    intent: 'INFO',
    priority: 13,
    keywords: ['delivery', 'envío', 'envio', 'costo de envío', 'cuánto tardan', 'quienes son', 'donde estan', 'dónde están', 'confianza', 'seguro', 'estafa', 'referencias', 'garantía', 'cambio', 'opiniones', 'comentarios', 'mejor que', 'comparado con', 'por qué comprarle a ustedes', 'contraentrega', 'pago contra entrega', 'tallas', 'colores', 'material', 'tela', 'original', 'replica', 'garantia', 'agencia', 'agencias', 'qué agencia', 'que agencia', 'qué agencias', 'que agencias', 'shalom', 'olva', 'por shalom', 'por olva', 'por qué agencia', 'que empresa de envío', 'empresa de envios', 'cómo envían', 'como envian'],
  },
  {
    intent: 'PAYMENT',
    priority: 14,
    keywords: ['yape', 'plin', 'qr', 'pagar', 'pago', 'cuenta', 'banco', 'transferencia', 'interbank', 'bcp', 'bbva', 'scotiabank', 'número de cuenta', 'nro de cuenta', 'como pago', 'donde pago', 'link de pago', 'comprobante', 'voucher', 'captura'],
  },
  {
    intent: 'POLICY_QUERY',
    priority: 15,
    keywords: ['como importar', 'cómo importar', 'bajo pedido', 'adelanto', 'cuanto adelanto', 'cuánto adelanto', 'tiempo de entrega', 'garantia', 'cambios', 'devoluciones', 'politicas', 'reglas', 'seguridad', 'pasos para comprar', 'como es el proceso', 'importar de usa', 'importar de china', 'metodo de pago'],
  },
]

class IntentEngine {
  /**
   * Clasifica la intención del mensaje en <10ms.
   * Retorna la intención detectada y su confianza.
   */
  classify(message: string): { intent: IntentType; confidence: number } {
    const lowerMsg = message.toLowerCase().trim()

    // Si el mensaje es muy corto, puede ser un saludo o número de selección
    if (lowerMsg.length <= 2 && /^\d+$/.test(lowerMsg)) {
      return { intent: 'BUY', confidence: 0.7 }
    }

    // Buscar la primera regla que coincida (ordenadas por prioridad)
    for (const rule of INTENT_RULES.sort((a, b) => a.priority - b.priority)) {
      for (const keyword of rule.keywords) {
        // Usar límites de palabra (\b) para evitar falsos positivos (ej. "alo" en "catalogo")
        // Escapar caracteres especiales en la palabra clave por seguridad
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i')
        
        if (regex.test(lowerMsg)) {
          return { intent: rule.intent, confidence: 0.95 }
        }
      }
    }

    return { intent: 'COMPLEX', confidence: 1.0 }
  }

  /**
   * Para intenciones simples, genera respuesta directa sin IA.
   * Retorna null si el intent requiere IA completa.
   */
  getQuickResponse(
    intent: IntentType,
    providerName: string,
    webAppLink: string,
    logisticsConfig: any,
    paymentConfig?: any
  ): string | null {
    const hours   = logisticsConfig?.hours   || 'Lunes a Sábado de 9am a 7pm'
    const address = logisticsConfig?.address || 'Consulta nuestra App para la dirección exacta'

    switch (intent) {
      case 'GREETING':
        return `🌟 ¡Hola! Bienvenido a *${providerName}*. Soy Atti 🤖.\n\n¿Buscas ver el catálogo, rastrear un pedido, o quieres que te ayude a encontrar algo en especial? Dime en qué te ayudo. 👇`

      case 'HOURS':
        return `🕐 *Horario de atención de ${providerName}:*\n\n📅 ${hours}\n\n¿Hay algo en lo que pueda ayudarte ahora mismo? 😊`

      case 'LOCATION':
        return `📍 *Ubicación de ${providerName}:*\n\n🏪 ${address}\n\n¿Te gustaría ver el catálogo o hacer un pedido? 🛍️`

      case 'INFO': {
        const yape = paymentConfig?.yape_phone || paymentConfig?.manual?.yape_phone
        const plin = paymentConfig?.plin_phone  || paymentConfig?.manual?.plin_phone
        const hasMp = !!(paymentConfig?.mercadopago?.access_token || paymentConfig?.access_token)
        let payLine = ''
        if (hasMp)  payLine += '💳 Mercado Pago (Yape, tarjeta, BBVA, etc.) | '
        if (yape)   payLine += `💚 Yape (${yape}) | `
        if (plin)   payLine += `🔵 Plin (${plin}) | `
        payLine = payLine.replace(/ \| $/, '') || 'Consulta con un asesor 🤝'
        return `ℹ️ *Sobre ${providerName}:*

📦 *Envío Nacional (stock local):* Se realiza por agencia (*Shalom* o *Olva Courier*). El flete de la agencia lo paga el cliente directamente al recibir su paquete. Llega en 24h Lima / 24-72h provincias.
✈️ *Importaciones (bajo pedido):* Gestionadas íntegramente por *Atines* (el envío internacional y aduana están incluidos). Requiere 50% de adelanto. Plazo: 10-20 días hábiles. Envío final en Perú: Por agencia (*Shalom* o *Olva Courier*) y el flete de la agencia lo paga el cliente al recibir su paquete.
💳 *Pagos:* ${payLine}
🔒 Somos una tienda 100% verificada por Atines.

¿Quieres ver el catálogo o hacer un pedido? 👇`
      }

      case 'POLICY_QUERY':
        return `📋 *Políticas de compra de ${providerName}:*

📦 *PRODUCTOS NACIONALES (en stock):*
Enviamos de inmediato por agencia (*Shalom* o *Olva Courier*). El flete de la agencia lo paga el cliente directamente al recibir su paquete. Lima: 24h. Provincias: 24-72h.

✈️ *IMPORTACIONES (bajo pedido vía Atines):*
El proceso de importación, transporte internacional y tramitación de aduana es gestionado de forma 100% segura por la empresa *Atines* (el flete internacional hasta Lima está incluido). El cliente abona el *50% de adelanto* para iniciar. Tiempo de espera: *10-20 días hábiles*. Una vez el producto ingresa a Perú, se envía por agencia (*Shalom* o *Olva Courier*) y el flete de la agencia nacional lo paga el cliente directamente al recibir su paquete.

🔄 *Cambios:* Coordinamos cambios en un plazo de 7 días con el producto en perfecto estado.

¿Te ayudo con algún producto en especial? 🛍️`

      case 'PAYMENT':
        return `💳 *Métodos de pago disponibles:*\n\n📲 Puedes pagar con Yape, Plin, transferencia bancaria, o Mercado Pago (tarjeta / QR dinámico).\n\nCuando confirmes tu pedido, te envío automáticamente el código QR y la boleta PDF. 🧾\n\n¿Qué producto te interesa? 😊`

      default:
        return null // Intents complejos → IA completa
    }
  }
}

export const intentEngine = new IntentEngine()
