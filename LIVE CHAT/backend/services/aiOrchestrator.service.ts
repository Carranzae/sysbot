import { db } from '../database/db'
import { io } from '../api/server'
import { aiService } from './ai.service'
import fs from 'fs'
import path from 'path'
import { paymentVerificationService } from './paymentVerification.service'
import { paymentService } from '../src/domains/payments/service'
import { logger } from '../api/utils/logger'
import { intentEngine } from './intentEngine.service'
import { sentimentEngine } from './sentimentEngine.service'
import { conversationStateService } from './conversationState.service'
import { ordersService } from './orders.service'
import { upsellService } from './upsell.service'
import { settingsService } from '../src/domains/settings/service'
import { customerMemoryService } from './customerMemory.service'
import { receiptGeneratorService } from './receiptGenerator.service'
import { trackingPDFService } from './trackingPDF.service'
import { mercadoPagoService } from './mercadoPago.service'
import { culqiService } from './culqi.service'
import { izipayService } from './izipay.service'
import { qrGeneratorService } from './qrGenerator.service'
import { MessageMedia } from 'whatsapp-web.js'
import { buyerPersonaEngine } from './buyerPersona.service'
import { negotiationEngine } from './negotiationEngine.service'
import { leadScoringEngine } from './leadScoring.service'
import { trendingEngine } from './trendingEngine.service'
import { encryption } from '../api/utils/encryption'
import { whatsappRouter } from './whatsappRouter.service'
import { fastCache } from '../api/utils/cache'
import { config } from '../config/env'

export class AIOrchestrator {
  /**
   * Procesa un mensaje entrante de WhatsApp.
   * Pipeline: M2(Intent) → M8(Sentiment) → M4(State) → M1(Prompt+IA) → M7(Upsell)
   */
  async handleIncomingMessage(
    userId: string,
    customerPhone: string,
    messageBody: string
  ): Promise<{ text: string; media?: string[] | string; actions?: string[] }> {
    try {
      // ════════════════════════════════════════
      // FASE 1: Cargar contexto del negocio (CACHED)
      // ════════════════════════════════════════
      const cacheKeyProvider = `provider_cfg_${userId}`
      let provider = await fastCache.get(cacheKeyProvider)

      if (!provider) {
        const { rows } = await db.query(
          'SELECT name, email, phone, logistics_config, payment_config, business_id FROM users WHERE id = $1',
          [userId]
        )
        provider = rows[0]
        if (provider) await fastCache.set(cacheKeyProvider, provider, 120) // 2 min cache
      }

      if (!provider) return { text: 'Error interno: proveedor no encontrado.' }

      const logisticsConfig = provider.logistics_config || {}
      const storeAddress = logisticsConfig.address || 'Consulta en nuestra plataforma para la dirección exacta'
      const pConfig = provider.payment_config || {}
      const paymentConfig = { ...(pConfig.payment || {}), ...(pConfig.manual || {}) }
      const manualConfig = pConfig.manual || {}

      // ---------------------------------------------------------------------
      // BLOQUEO DE SEGURIDAD INDUSTRIAL: ¿El proveedor está listo para cobrar?
      // ---------------------------------------------------------------------
      const isProviderReady = await paymentService.isProviderReady(userId)

      if (!isProviderReady) {
        logger.warn(`[CHECKOUT-BLOCK] Proveedor ${userId} intentó vender sin configuración.`)

        // 1. Notificar al proveedor (Alerta Roja)
        if (provider.phone) {
          whatsappRouter.sendMessage(userId, provider.phone, `⚠️ *ALERTA DE VENTA PERDIDA*\n\nUn cliente con el número *${customerPhone}* intentó comprar pero no tienes configurado ningún método de pago (Mercado Pago o Gmail).\n\nVe a tu panel ahora: ${config.server.frontendUrl}/provider/settings`).catch(() => { })
        }

        return {
          text: `Uy, por un tema técnico nuestra pasarela de pagos está en mantenimiento rápido. 🛠️\n\nPor favor, comunícate directamente con nuestro asesor por aquí para coordinar tu compra manual. ¡Gracias por tu comprensión!`
        }
      }

      const webAppLink = `${config.server.frontendUrl}/${provider.name.toLowerCase().replace(/\s+/g, '-')}`
      const checkoutLink = `${webAppLink}/checkout`

      // --- Resolver Credenciales de Mercado Pago ---
      const mpToken = encryption.decrypt(pConfig.mercadopago?.access_token || pConfig.access_token || '')

      // ════════════════════════════════════════
      // MOTOR DE PAGOS: Construir contexto de cobro
      // ════════════════════════════════════════
      let paymentContext = 'MÉTODOS DE PAGO DISPONIBLES:\n'
      if (mpToken) {
        paymentContext += `- 💳 Mercado Pago: Aceptamos todas las tarjetas y QR dinámico.\n`
      }
      if (paymentConfig.yape_phone) paymentContext += `- Yape: ${paymentConfig.yape_phone}\n`
      if (manualConfig.yape_qr) paymentContext += `  (QR de Yape disponible. Para enviarlo usa el comando [SEND_IMAGE:YAPE_QR])\n`

      if (paymentConfig.plin_phone) paymentContext += `- Plin: ${paymentConfig.plin_phone}\n`
      if (manualConfig.plin_qr) paymentContext += `  (QR de Plin disponible. Para enviarlo usa el comando [SEND_IMAGE:PLIN_QR])\n`

      if (paymentConfig.bank_account) {
        paymentContext += `- Transferencia: ${paymentConfig.bank_name || 'Banco'} (${paymentConfig.bank_account})\n`
        if (paymentConfig.bank_holder) paymentContext += `  A nombre de: ${paymentConfig.bank_holder}\n`
      }
      if (!paymentConfig.yape_phone && !paymentConfig.bank_account && !manualConfig.yape_qr && !manualConfig.plin_qr && !mpToken) {
        paymentContext = 'MÉTODOS DE PAGO: Consultar con un asesor humano.'
      }

      // ════════════════════════════════════════
      // MOTOR 2: Intent Engine — clasificación <10ms
      // ════════════════════════════════════════
      const intentResult = intentEngine.classify(messageBody)
      const intent = intentResult.intent // ← string 'BUY' | 'PAYMENT' | etc.
      logger.info(`[INTENT] ${customerPhone} → ${intent} (confianza: ${intentResult.confidence})`)


      // ─────────────────────────────────────────────────────────────────────
      // INTERCEPTOR DINÁMICO: Solicitud de Boleta (RECEIPT_REQUEST)
      // ─────────────────────────────────────────────────────────────────────
      if (intent === 'RECEIPT_REQUEST') {
        const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9);
        const { rows: userOrders } = await db.query(
          `SELECT id, payment_reference_code, status, payment_status, total, products, customer_name, payment_method, created_at
           FROM orders 
           WHERE user_id = $1 AND (customer_phone LIKE $2 OR customer_phone = $3)
           ORDER BY created_at DESC LIMIT 1`,
          [userId, `%${cleanPhone}`, customerPhone]
        );

        if (userOrders.length === 0) {
          const noOrderReply = `⚠️ *Aún no tienes pedidos registrados*
          
Hola, para generarte una boleta primero necesitas realizar un pedido. Puedes ver nuestro catálogo web y comprar seguro aquí: ${webAppLink}

¡Dime qué te gustaría llevar y lo preparamos! 🚀`;

          await db.query(
            'INSERT INTO conversation_history (customer_phone, user_id, role, content) VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)',
            [customerPhone, userId, 'user', messageBody, 'assistant', noOrderReply]
          );
          return { text: noOrderReply };
        }

        const latestOrder = userOrders[0];
        const orderIdShort = latestOrder.payment_reference_code || latestOrder.id.substring(0, 8);

        let receiptPath = '';
        try {
          const productsList = typeof latestOrder.products === 'string' ? JSON.parse(latestOrder.products) : latestOrder.products;

          receiptPath = await receiptGeneratorService.generateReceiptPDF({
            orderId: latestOrder.id,
            customerName: latestOrder.customer_name || 'Cliente WA',
            customerPhone,
            items: (productsList || []).map((i: any) => ({ name: i.name, quantity: i.quantity || i.qty || 1, price: i.price })),
            total: Number(latestOrder.total),
            date: latestOrder.created_at || new Date(),
            storeName: provider.name,
            paymentMethod: latestOrder.payment_method || 'transferencia',
            isPaid: latestOrder.payment_status === 'paid'
          });
        } catch (pdfErr: any) {
          logger.error('[RECEIPT-REQUEST] Error generando PDF:', pdfErr.message);
        }

        if (!receiptPath) {
          const errorReply = `⚠️ Hubo un inconveniente al generar el PDF de tu boleta para el pedido *#${orderIdShort}*. Por favor, solicita ayuda a uno de nuestros asesores en el chat para que te la envíe manualmente.`;
          return { text: errorReply };
        }

        let replyText = '';
        if (latestOrder.payment_status === 'paid') {
          replyText = `✅ *BOLETA DE VENTA CONFIRMADA*
          
Aquí tienes tu comprobante oficial del pedido *#${orderIdShort}*. Tu pago ha sido verificado con éxito. ¡Muchas gracias por tu compra! 🎉`;
        } else {
          replyText = `📄 *COMPROBANTE PENDIENTE DE PAGO*
          
Aquí tienes el resumen previo de tu pedido *#${orderIdShort}*. 

⚠️ *Estado:* Pendiente de Pago
💰 *Total:* S/ ${Number(latestOrder.total).toFixed(2)}

Una vez realices la transferencia, compárteme la captura de pantalla por aquí para validarlo al instante. 📸`;
        }

        await db.query(
          'INSERT INTO conversation_history (customer_phone, user_id, role, content) VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)',
          [customerPhone, userId, 'user', messageBody, 'assistant', replyText]
        );

        return {
          text: replyText,
          media: [receiptPath]
        };
      }

      // ════════════════════════════════════════
      // OBTENER CONTEXTO INICIAL (Estado y DB)
      // ════════════════════════════════════════
      const convState = await conversationStateService.get(userId, customerPhone)
      const { rows: historyRows } = await db.query(
        `SELECT role, content FROM conversation_history 
         WHERE customer_phone = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 8`,
        [customerPhone, userId]
      )
      const chatHistory = historyRows.reverse().map(h => ({ role: h.role, content: h.content }))

      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9)
      const { rows: orders } = await db.query(
        `SELECT id, payment_reference_code, status, fulfillment_status, total, paid_amount, pending_amount, created_at, guide_number, courier_agency, shipping_type, payment_status, payment_details, products 
         FROM orders WHERE user_id = $1 AND (customer_phone LIKE $2 OR customer_phone = $3)
         ORDER BY created_at DESC LIMIT 3`,
        [userId, `%${cleanPhone}`, customerPhone]
      )
      const hasPendingOrder = orders.some(o => o.payment_status === 'pending')

      const { logisticsService } = await import("./logistics.service")
      const systemAgencies = await logisticsService.listAgencies()
      const allowedAgenciesNames = systemAgencies.map((a: any) => a.name).join(' / ') || 'Shalom / Olva Courier'

      // ════════════════════════════════════════
      // MOTOR 2B: Quick Response — <100ms sin IA para intents simples
      // ════════════════════════════════════════
      // ANTI-ROBOTIZACIÓN: Solo usar respuestas rápidas si la conversación es nueva, no hay carrito activo y no hay pedidos pendientes.
      let quickReply = null
      const hasActiveCart = convState && convState.cartItems && convState.cartItems.length > 0
      if (!hasActiveCart && historyRows.length <= 4 && !hasPendingOrder) {
        quickReply = intentEngine.getQuickResponse(intent, provider.name, webAppLink, logisticsConfig, pConfig)
      }

      if (quickReply) {
        // Persistir en historial igual que una respuesta normal
        if (messageBody.length > 1) {
          await db.query(
            'INSERT INTO conversation_history (customer_phone, user_id, role, content) VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)',
            [customerPhone, userId, 'user', messageBody, 'assistant', quickReply]
          )
        }
        logger.info(`[QUICK-REPLY] ⚡ ${intent} → respuesta instantánea sin IA para ${customerPhone}`)
        return { text: quickReply }
      }

      // ════════════════════════════════════════
      // MOTOR 8: Sentiment Engine — análisis emocional
      // ════════════════════════════════════════
      const sentimentResult = sentimentEngine.analyze(messageBody)
      if (sentimentResult.shouldEscalate) {
        await sentimentEngine.notifyEscalation(userId, customerPhone, messageBody, sentimentResult.sentiment)
        logger.warn(`[SENTIMENT] Escalamiento activado: ${sentimentResult.sentiment}`)
      }

      // ════════════════════════════════════════
      // INTERCEPCIÓN NPS: ¿Flujo de satisfacción activo?
      // ════════════════════════════════════════
      if (convState && convState.npsPending) {
        const { npsService } = await import('./nps.service')
        const npsReply = await npsService.handleNpsInput(userId, customerPhone, messageBody, convState)
        if (npsReply) {
          return { text: npsReply }
        }
      }

      let cartContext = ''
      let filterCatalogType: string | null = null

      if (convState && convState.cartItems && convState.cartItems.length > 0) {
        cartContext = `\n🛒 CARRITO ACTUAL DEL CLIENTE:\n${await conversationStateService.getCartSummary(userId, customerPhone)}`
        const firstItem = convState.cartItems[0]
        if (firstItem) filterCatalogType = (firstItem as any).catalog_type || 'national'
      }

      // ════════════════════════════════════════
      // FASE 2: Cargar catálogo (RAG / CACHED)
      // ════════════════════════════════════════
      let products: any[] = []
      
      // Intentar RAG si el mensaje tiene palabras clave
      if (messageBody.trim().split(/\s+/).length > 0) {
        // RAG Híbrido: Full-Text Search + Trigramas para errores ortográficos (ej. "latos" en vez de "laptops")
        let ragQuery = `
          SELECT id, name, price, min_price, stock, description, attributes, images, catalog_type, lead_time_days 
          FROM products 
          WHERE user_id = $1 
            AND (
              to_tsvector('spanish', name || ' ' || coalesce(description, '')) @@ websearch_to_tsquery('spanish', $2)
              OR name % $2
              OR name ILIKE '%' || $2 || '%'
            )
        `
        const ragParams: any[] = [userId, messageBody]
        
        if (filterCatalogType) {
          ragQuery += ' AND catalog_type = $3'
          ragParams.push(filterCatalogType)
        }
        
        ragQuery += ` ORDER BY ts_rank(to_tsvector('spanish', name || ' ' || coalesce(description, '')), websearch_to_tsquery('spanish', $2)) DESC, similarity(name, $2) DESC LIMIT 6`
        
        try {
          const { rows: ragRows } = await db.query(ragQuery, ragParams)
          if (ragRows.length > 0) {
            products = ragRows
            logger.info(`[RAG] Encontrados ${products.length} productos para: "${messageBody}"`)
          }
        } catch (e: any) {
          logger.warn(`[RAG] Error en búsqueda de texto: ${e.message}`)
        }
      }

      // FALLBACK si no hay resultados RAG
      if (products.length === 0) {
        const cacheKeyCatalog = `catalog_${userId}_${filterCatalogType || 'all'}_limit10`
        products = await fastCache.get(cacheKeyCatalog)

        if (!products) {
          let productQuery = 'SELECT id, name, price, min_price, stock, description, attributes, images, catalog_type, lead_time_days FROM products WHERE user_id = $1'
          const queryParams: any[] = [userId]
          if (filterCatalogType) {
            productQuery += ' AND catalog_type = $2'
            queryParams.push(filterCatalogType)
          }
          productQuery += ' LIMIT 10' // Aumentamos de 4 a 10 para dar más opciones a la IA si el RAG falla

          const { rows } = await db.query(productQuery, queryParams)
          products = rows
          if (products) await fastCache.set(cacheKeyCatalog, products, 2)
        }
      }

      // ════════════════════════════════════════
      // INTERCEPCIÓN CÓDIGO DE OPERACIÓN (TEXTO)
      // ════════════════════════════════════════
      const codeKeywords = /(?:operaci[oó]n|c[oó]digo|pago|yape|plin|#)/i
      const trackingKeywords = /(?:rastrea|rastrear|guia|gu[ií]a|shalom|olva|paquete|envio|env[ií]o|donde esta|dónde está)/i
      const isTrackingQuery = trackingKeywords.test(messageBody)

      if (hasPendingOrder && codeKeywords.test(messageBody) && !isTrackingQuery) {
        const codeMatches = messageBody.match(/([0-9A-Z]{6,12})\b/g)
        const possibleCode = codeMatches?.find(c => /\d/.test(c))
        if (possibleCode) {
          const { paymentVerificationService } = await import("./paymentVerification.service")
          const verifyResult = await paymentVerificationService.verifyPaymentByCode(possibleCode, userId, customerPhone)
          // Insertar registro en historial
          await db.query(
            'INSERT INTO conversation_history (customer_phone, user_id, role, content) VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)',
            [customerPhone, userId, 'user', messageBody, 'assistant', verifyResult.message]
          )
          // Generar QR Dinámico si está configurado
          let qrMedia = undefined
          try {
            const { mercadoPagoService } = await import("./mercadoPago.service")
            const total = await conversationStateService.getCartTotal(userId, customerPhone)
            const cart = await conversationStateService.get(userId, customerPhone)
            if (mpToken && cart && cart.cartItems && cart.cartItems.length > 0) {
              const tempOrder = await ordersService.createOrderFromCart(userId, customerPhone, cart.cartItems, total)
              const qrResult = await mercadoPagoService.generateOrderQR(
                mpToken,
                { id: tempOrder.id, total, customer_email: `${customerPhone}@atines.com`, customer_name: `Cliente WA` },
                (cart.cartItems || []).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, unit_price: i.price }))
              );
              qrMedia = qrResult.qrFilePath;
            }
          } catch (e: any) {
            logger.warn('[QR-GEN] No se pudo generar QR después de la verificación:', e?.message)
          }
          // Mensaje de respuesta
          const responseText = `${verifyResult.message}\n\n🚀 Estamos validando tu pago para generar la boleta y el código QR. En breve lo recibirás.`
          return { text: responseText, media: qrMedia ? [qrMedia] : undefined }
        }
      }


      // ════════════════════════════════════════
      // MOTOR 3: Personalidad por Rubro (Tono Adaptativo Real)
      // ════════════════════════════════════════
      const businessType: string = logisticsConfig.business_type || 'general'
      const businessToneMap: Record<string, string> = {
        'moda': 'Eres una cerradora de ventas agresiva y experta en moda. Usa emojis 👗✨💄. Habla de exclusividad y tendencias.',
        'tecnologia': 'Eres una cerradora experta en tecnología. Usa emojis 💻⚡🔧. Habla de rendimiento y garantía.',
        'medicina': 'Eres una consultora médica empática y profesional. Usa emojis 🩺💙. Prioriza la salud y el bienestar, no presiones la venta.',
        'legal': 'Eres una asesora legal corporativa, sumamente profesional y directa. Usa emojis ⚖️🏢. Muestra autoridad y confianza.',
        'alimentos': 'Eres un anfitrión cálido y veloz. Usa emojis 🍕🥗😋. Habla de frescura y delivery rápido.',
        'servicios': 'Eres un consultor profesional. Usa emojis 🏢✅📋. Habla de resultados y experiencia.',
        'general': 'Eres una cerradora estrella de clase mundial. Usa emojis 🛍️⭐💫. Habla de calidad y precio.',
      }
      const businessTone = businessToneMap[businessType] || businessToneMap['general']

      // ════════════════════════════════════════
      // MOTOR 7: Upselling — sugerencias proactivas
      // ════════════════════════════════════════
      let upsellContext = ''
      if (intent === 'BUY' || intent === 'PAYMENT' || intent === 'UPSELL_PROBE') {
        const currentCart = await conversationStateService.get(userId, customerPhone)
        if (currentCart && currentCart.cartItems && currentCart.cartItems.length > 0) {
          upsellContext = await upsellService.getUpsellHook(userId, currentCart.cartItems)
        }
      }

      // (Generación preventiva de pedidos eliminada para evitar duplicados)
      let orderRefContext = ''

      // ════════════════════════════════════════
      // MOTOR 9: Buyer Persona — Perfil Psicológico <5ms
      // ════════════════════════════════════════
      const recentUserMessages = historyRows.filter(h => h.role === 'user').map(h => h.content)
      recentUserMessages.push(messageBody)
      const personaAnalysis = buyerPersonaEngine.analyze(recentUserMessages)
      logger.info(`[PERSONA] ${customerPhone} → ${personaAnalysis.persona} (${(personaAnalysis.confidence * 100).toFixed(0)}%)`)

      // ════════════════════════════════════════
      // MOTOR 10: Negociación Dinámica — Cierre Inteligente
      // ════════════════════════════════════════
      const closeTactic = await negotiationEngine.processNegotiation(
        userId,
        customerPhone,
        messageBody,
        convState?.cartItems || []
      )
      const closeSignal = closeTactic.signal
      logger.info(`[NEGOTIATION] Señal: ${closeSignal} → Táctica: ${closeTactic.tactic} | Sugerido: S/ ${closeTactic.suggestedPrice || 'N/A'}`)

      // ════════════════════════════════════════
      // MOTOR 11: Lead Scoring — Prioridad del cliente
      // ════════════════════════════════════════
      const leadScore = await leadScoringEngine.calculate(userId, customerPhone)
      leadScoringEngine.saveScore(userId, customerPhone, leadScore).catch(() => { })
      logger.info(`[LEAD] ${customerPhone} → Score: ${leadScore.score}/100 | Tier: ${leadScore.tier}`)

      // ════════════════════════════════════════
      // MOTOR 12: Trending Engine — Demanda en Tiempo Real
      // ════════════════════════════════════════
      const trendingContext = await trendingEngine.getTrendingContext(userId, messageBody)

      // ════════════════════════════════════════
      // MOTOR 1: Construir Prompt Universal — 12 Motores Activos
      // ════════════════════════════════════════
      const productsContext = products.length > 0
        ? products.map((p: any) => {
          const desc = p.description ? ` — ${String(p.description).slice(0, 50)}` : ''
          const attrs = p.attributes && Object.keys(p.attributes).length > 0 ? ` — Opciones: ${JSON.stringify(p.attributes)}` : ''
          const isImport = p.catalog_type === 'global'
          // Manejo de Stock NULL (Disponible infinito) vs 0 (Agotado)
          let stockLabel = isImport ? `✈️ IMP (${p.lead_time_days || 15}d)` : (p.stock === null ? `✅ Stock:Disponible` : (p.stock > 0 ? `✅ Stock:${p.stock}` : `❌ AGOTADO`))
          // Mostrar si hay precio mínimo de descuento configurado o no (crítico para negociación)
          const minPriceLabel = (p.min_price && parseFloat(p.min_price) < parseFloat(p.price))
            ? ` | DESC_MIN:S/${parseFloat(p.min_price).toFixed(2)}`
            : ` | NO_DESC`
          return `• *${p.name}*: S/${p.price}${minPriceLabel} | ${stockLabel}${desc}${attrs} [ID:${p.id}]`
        }).join('\n')
        : 'SIN_PRODUCTOS'

      const ordersContext = orders.length > 0
        ? orders.map(o => {
          const ref = o.payment_reference_code || o.id.slice(0, 8)
          const isIntl = o.shipping_type === 'international' || o.shipping_type === 'global'
          const track = o.guide_number ? `Guía ${o.courier_agency}: ${o.guide_number}` : 'Sin guía local aún'
          const fStatus = isIntl ? `Hito: ${o.fulfillment_status || 'En origen'}` : `Almacén: ${o.fulfillment_status || 'Preparando'}`
          const financial = `S/ ${Number(o.total).toFixed(2)} | Abonado S/ ${Number(o.paid_amount || 0).toFixed(2)} | Pendiente S/ ${Number(o.pending_amount || 0).toFixed(2)}`
          return `• Pedido #${ref} (${isIntl ? '✈️ Global' : '📦 Nacional'}) → *${o.status}* | ${financial} | ${fStatus} | ${track}`
        }).join('\n')
        : 'Sin pedidos previos.'

      // 🧠 MEMORIA SELECTIVA (ADN DEL CLIENTE)
      const memoryContext = await customerMemoryService.getMemoryContext(userId, customerPhone)

      // Extraer nombre del cliente si existe para Inyección de Identidad
      let customerName = 'Cliente'
      const { rows: nameRows } = await db.query('SELECT customer_name FROM orders WHERE customer_phone = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1', [customerPhone, userId])
      if (nameRows.length > 0 && nameRows[0].customer_name) {
        customerName = nameRows[0].customer_name.split(' ')[0]
      }

      // 🧩 Prompting Dinámico según Intent — ÉLITE PRO
      // === MEJORA #4: Checkout pre-rellenado con memoria ===
      const existingOrder = orders.find(o => o.status === 'pending' || o.status === 'paid')
      const prefilledCheckout = existingOrder
        ? `⚡ DATOS YA EN MEMORIA: Este cliente ha comprado antes. NO le pidas datos que ya tenemos. Avanza directamente al paso que falta.`
        : ''

      // === MEJORA #1: Pivote Importación (lenguaje ultra persuasivo) ===
      const hasOutOfStock = products.some((p: any) => p.catalog_type !== 'global' && p.stock === 0)
      const importPivot = hasOutOfStock
        ? `🔄 PIVOTE IMPORTACIÓN OBLIGATORIO: Si el cliente pide un producto con stock ❌ AGOTADO, ESTÁ PROHIBIDO decir "no lo tenemos" o "no hay". DEBES responder así: "¡Se nos agotó aquí mismo porque se vende a lo loco! 🔥 Pero tengo una noticia MEJOR: te lo traigo importado directo de origen, precio más exclusivo y con solo el 50% de adelanto. ¿Lo separamos ahora?" Si hay versión de importación en el catálogo (catalog_type:global), agrégala al carrito directamente con [ADD_TO_CART:ID:1].`
        : ''

      // === MEJORA #4: Modo cotización por volumen ===
      const wantsBulk = /varios|docena|unidades|lote|cantidad|mayor|mayorista|distribuidor/i.test(messageBody)
      const bulkMode = wantsBulk
        ? `📦 MODO MAYORISTA ACTIVO: El cliente quiere comprar en volumen. Muéstrale el precio unitario normal y el precio por mayor (usa min_price del catálogo como precio de lote). Di: "Si llevas [X] unidades, te los dejo en S/[min_price] c/u. ¿Cuántas necesitas?"`
        : ''

      let dynamicRules = ''
      if (intent === 'BUY' || intent === 'PAYMENT' || hasPendingOrder) {
        dynamicRules = `
🎯 PROTOCOLO DE PAGOS Y CHECKOUT (ÉLITE PRO):
${prefilledCheckout}
- BOLETAS: Si piden comprobante, usa [SEND_RECEIPT_PDF].
- CARRITO INTELIGENTE: Si el cliente ya tiene productos en carrito ([CARRITO ACTUAL] en el contexto), NO ofrezcas agregarlo de nuevo. Pasa directo a pedir DNI y Nombre.
- Usa [ADD_TO_CART:ID:CANTIDAD] para agregar. [UPDATE_CART:ID:CANTIDAD] para corregir.
- CHECKOUT 4 PASOS ESTRICTOS:
  1. FACTURACIÓN: Pide Nombres y Apellidos + DNI/RUC. Usa [UPDATE_BILLING_DETAILS:NOMBRE_APELLIDOS:DNI]
     ⚠️ OBLIGATORIO: El nombre debe tener MÍNIMO 2 palabras (Nombre + Apellido). Rechaza nombres sueltos.
  2. DESPACHO: Pide Provincia, Distrito, Agencia. Usa [UPDATE_SHIPPING_DETAILS:PROVINCIA:DISTRITO:METODO:DETALLE]
     ⚠️ SOLO acepta como método: "Shalom" o "Olva Courier". Si el cliente menciona otra agencia, corrígele amablemente.
  3. RESUMEN Y VERIFICACIÓN (OBLIGATORIO): Antes de cobrar, muestra un resumen claro con el Nombre, DNI, Provincia, Distrito y Agencia de envío. Pregunta explícitamente: "¿Son correctos tus datos para el envío o deseas corregir alguno? (Si todo está bien, escríbeme 'Sí/Correcto', o dime qué corregir)".
  4. CHECKOUT: SOLO si el cliente confirma que los datos son correctos (ej: "sí", "correcto", "de acuerdo"), ejecuta el comando [CHECKOUT]. Si desea cambiar algo, corrígelo y vuelve a mostrar el resumen.
- PAGO DIRECTO: Si solo piden QR sin boleta, usa [SEND_PAYMENT_QR]. No simules cuentas manualmente.
${paymentConfig.negotiation?.enabled ? `- OFERTA FLASH (min_price): Si el cliente duda por precio o pide rebaja, di: "Solo hoy te lo dejo en S/${paymentConfig.negotiation?.min_advance || '[MIN_PRICE]'} si cerramos ahora mismo. ¿A qué provincia te lo mando?"` : ''}
${importPivot}
${bulkMode}

🎯 COMANDOS DE PAGO DISPONIBLES:
- [UPDATE_BILLING_DETAILS:NOMBRE_APELLIDOS:DNI_O_RUC]
- [UPDATE_SHIPPING_DETAILS:PROVINCIA:DISTRITO:METODO:DETALLES]
- [ADD_TO_CART:PRODUCT_ID:CANTIDAD] / [UPDATE_CART:PRODUCT_ID:CANTIDAD]
- [CHECKOUT]
- [SEND_PAYMENT_QR]
- [SEND_RECEIPT_PDF]`
      } else if (intent as string === 'SUPPORT' || intent === 'COMPLEX' || intent === 'GREETING') {
        dynamicRules = `
🎯 PROTOCOLO DE SOPORTE ANTI-ESCALAMIENTO (ÉLITE PRO):
- RASTREO OBLIGATORIO PASO 1: Si preguntan "¿dónde está mi pedido?", PRIMERO mira el HISTORIAL/MEMORIA del cliente. Si tienes datos de su pedido, usa [REALTIME_TRACKING:AGENCIA:NUMERO:DNI] o [SEND_TRACKING_PDF] AUTOMÁTICAMENTE. NUNCA digas "no tengo registro" sin intentar rastrear antes.
- RASTREO PASO 2: Solo si NO hay ningún pedido en historial, pide: "¿Me puedes pasar tu código de pedido o número de guía para rastrearlo en tiempo real?"
- ESCALAMIENTO: Solo usa [ESCALATE_TO_HUMAN] si el cliente está agresivo, reclama daños graves o insiste en hablar con humano.
- GARANTÍA: Cambios hasta 7 días en tienda. Garantía 3-12 meses por falla de fábrica.
- VISUAL SELLING: Cuando envíes [SEND_IMAGE:PRODUCT_ID], añade SIEMPRE un gancho corto después: "¿Lo separamos? 😊"
- CROSS-SELLING: Si el cliente ya compró antes (ver historial), ofrécele un accesorio o producto complementario citando su compra previa: "Ya que tienes [PRODUCTO ANTERIOR], ¿te interesa [COMPLEMENTO]?"
${importPivot}
${bulkMode}

🎯 COMANDOS DISPONIBLES:
- [SEND_TRACKING_PDF]
- [REALTIME_TRACKING:AGENCIA:NUMERO:DNI_O_ANO]
- [ESCALATE_TO_HUMAN]
- [SEND_IMAGE:PRODUCT_ID]
- [ADD_TO_CART:PRODUCT_ID:CANTIDAD]`
      } else {
        dynamicRules = `
🎯 PROTOCOLO DE VENTAS BÁSICO (ÉLITE PRO):
- ACCIÓN DIRECTA: Si el cliente muestra interés, usa [ADD_TO_CART:ID:1] inmediatamente. NO preguntes si quiere agregarlo.
- VISUAL SELLING: Usa [SEND_IMAGE:PRODUCT_ID] si el cliente pregunta cómo es el producto. Después del envío añade: "¿Te lo separamos?"
- CROSS-SELLING: Mira el historial del cliente. Si compró antes, ofrécele algo complementario.
${importPivot}
${bulkMode}

🎯 COMANDOS DISPONIBLES:
- [ADD_TO_CART:PRODUCT_ID:CANTIDAD]
- [SEND_IMAGE:PRODUCT_ID]
- [ESCALATE_TO_HUMAN]`
      }

      // === MEJORA #2: Cross-selling con historial explícito ===
      const pastPurchaseNames = orders
        .filter((o: any) => o.status === 'paid' || o.status === 'delivered')
        .slice(0, 2)
        .map((o: any) => o.payment_reference_code || 'producto previo')
      const crossSellHint = pastPurchaseNames.length > 0
        ? `🛒 HISTORIAL DE COMPRAS: Este cliente ya compró antes (refs: ${pastPurchaseNames.join(', ')}). Cita su compra previa para recomendar complementos de forma personalizada.`
        : ''

      const systemPrompt = `[ESTÁS HABLANDO CON: ${customerName}]
Eres *Atti*, Especialista en Ventas y Soporte de "${provider.name}". ${businessTone} Experta en ventas nacionales, importaciones y soporte post-venta. Directa, persuasiva y con carisma.

🧠 REGLAS DE VENTAS ÉLITE PRO (ESTILO MERCADO LIBRE + ALIBABA):
1. BREVEDAD MÁXIMA: 1-2 líneas como máximo. Sé un asesor experto que sabe exactamente qué decir y cuándo.
2. FOMO PERMANENTE: Si stock < 20 → "¡Quedan pocos, están saliendo volando! 🔥" Si stock = 0 → activa el PIVOTE DE IMPORTACIÓN.
3. ACCIÓN DIRECTA: Si el cliente dice "sí", "ok", "quiero", "agrégalo" → NO preguntes más. Ejecuta [ADD_TO_CART:ID:1] de inmediato y avanza al siguiente paso de la venta.
4. 🔒 PROTECCIÓN ESTRICTA DE PRECIOS — REGLA DE HIERRO:
   → Si el producto tiene "NO_DESC" en el catálogo: JAMÁS bajes el precio. Ni un sol. Ni por ruego. El precio es fijo.
     En cambio, añade VALOR NO MONETARIO: "El precio es fijo, pero te incluyo prioridad de envío y garantía extendida 🤝".
   → Si el producto tiene "DESC_MIN:S/X": PUEDES negociar de forma GRADUAL e INTELIGENTE en máximo 3 pasos:
     • Paso 1 (primera queja): Cede el 35% del margen entre precio y DESC_MIN. No reveles el precio piso.
     • Paso 2 (segunda queja): Cede el 70% del margen. Crea urgencia: "Solo por hoy".
     • Paso 3 (tercera queja): Ofrece exactamente el DESC_MIN. Deja claro que es el precio final inamovible.
   → NUNCA inventes un precio que no esté en el catálogo. NUNCA digas "te lo dejo en" sin tener DESC_MIN autorizado.
5. CATÁLOGOS: Si piden "catálogo", responde brevemente y añade [SEND_CATALOGUE_PDF:all]. Después pregunta: "¿Cuál te llamó la atención para separártelo?"
6. NO REPITAS PREGUNTAS: Si el historial ya tiene nombre, DNI o dirección, úsalos. No los pidas de nuevo.
7. CONFIRMACIÓN DE DATOS DE ENVÍO Y FACTURACIÓN: Cuando el cliente te proporcione sus datos para la boleta y el envío (DNI, Nombre, Provincia, Distrito), DEBES resumir todos los datos de manera clara en tu respuesta y preguntarle explícitamente si son correctos o si desea corregir alguno. NO ejecutes el comando [CHECKOUT] hasta que el cliente te responda explícitamente que los datos son correctos. Si desea corregir algo, permítele indicártelo, actualízalo usando los comandos y vuelve a presentar el resumen.
8. ENVÍO DE FOTOS DE PRODUCTOS: Si el cliente te pide fotos, imágenes, "cómo es", "cómo se ve" o "muéstrame foto" de un producto específico, DEBES generar obligatoriamente el comando [SEND_IMAGE:PRODUCT_ID] reemplazando PRODUCT_ID por el ID real de ese producto de la sección de Catálogo. No inventes IDs, usa estrictamente el ID del catálogo. Si no sabes qué producto es, pregúntale antes. NUNCA digas que no puedes enviar imágenes; tú SÍ puedes hacerlo a través de este comando.
9. ⚠️ REGLA CRÍTICA — DISTINCIÓN ABSOLUTA ENTRE FLUJOS (JAMÁS CONFUNDIR):
   🏪 PRODUCTOS NACIONALES (catalog_type: national) — Identificación: tienen ✅ Stock en el catálogo.
     → Son productos EN STOCK en Perú, disponibles de inmediato.
     → El envío se realiza por agencia (*Shalom* o *Olva Courier*), y el flete de la agencia lo paga el cliente directamente al recibir su paquete en destino.
     → Llega en 24h Lima / 24-72h provincias.
     → NO menciones adelantos, aduanas, ni plazos de importación para estos productos.
   ✈️ PRODUCTOS DE IMPORTACIÓN (catalog_type: global) — Identificación: tienen ✈️ IMP en el catálogo.
     → Son productos BAJO PEDIDO. NO están en stock en Perú.
     → El proceso logístico completo (compra internacional, transporte y aduana) es gestionado de forma 100% segura y profesional por la empresa *Atines*.
     → Requiere obligatoriamente un *50% de adelanto* para iniciar la importación.
     → Plazo de entrega: de *10 a 20 días hábiles* desde el pago del adelanto.
     → El envío internacional hasta que llegue a Lima corre por cuenta de la empresa. Una vez que el producto llega a Lima y se envía al cliente por agencia (*Shalom* o *Olva Courier*), el flete de la agencia nacional lo paga el cliente directamente al recibir su paquete.
     → NUNCA mezcles este flujo con el nacional. Son procesos completamente distintos.
   🚚 AGENCIAS AUTORIZADAS: Para AMBOS flujos, la distribución final al cliente en Perú se realiza ÚNICAMENTE por *Shalom* o *Olva Courier*. Si el cliente pide otra agencia, indícale amablemente que solo operamos con estas dos.

🎭 PERFIL PSICOLÓGICO: ${personaAnalysis.responseStrategy}
🥊 SEÑAL DE CIERRE: ${closeTactic.hook} ${closeTactic.suggestedPrice ? `(Sugerido S/${closeTactic.suggestedPrice})` : ''}
⭐ LEAD SCORE: ${leadScore.tier} — ${leadScore.score}/100
${crossSellHint}

📈 DEMANDA EN TIEMPO REAL: ${trendingContext || 'N/A'}
📦 CATÁLOGO DISPONIBLE:
${productsContext}

📋 MEMORIA DE CLIENTE:
${ordersContext}
${cartContext}
${upsellContext}
${memoryContext}

📍 BASE CONOCIMIENTO OPERACIONAL:
- 📦 NACIONAL (stock local): Envío inmediato por agencia (Shalom o Olva Courier). El flete de la agencia lo paga el cliente directamente al recibir su paquete. Llega en 24h Lima / 24-72h provincias.
- 🏪 LOCAL: Recojo gratis en "${storeAddress}". Delivery a acordar.
- ✈️ IMPORTACIONES (bajo pedido vía Atines): La empresa Atines gestiona el proceso completo de importación internacional y aduanas (el envío internacional hasta Lima corre por cuenta de la empresa). Requiere 50% de adelanto para iniciar. Plazo: 10 a 20 días hábiles. El envío en Perú se realiza por agencia (Shalom o Olva Courier) y el flete de la agencia lo paga el cliente directamente al recibir su paquete.
- 💳 PAGOS: ${paymentContext}
- 🔗 SEGUIMIENTO ONLINE: ${webAppLink}
${dynamicRules}

━━━━━━━━━━━━━━━━━━━━━
ESTILO WHATSAPP ÉLITE:
- ✅ Habla con naturalidad, como un asesor humano experto de alto nivel.
- 🚫 NUNCA más de 2 líneas de texto (excepto checkout/resumen oficial).
- 🚫 NUNCA repitas saludos robóticos. Sé variado, fresco y cercano.
- 🚫 NUNCA digas "entendido" o "claro" sin añadir valor o acción concreta.
- 🚫 JAMÁS confundas el flujo Nacional con el de Importación. Son 100% distintos.

INTENT: ${intent} | URGENCIA: ${personaAnalysis.urgencyLevel} | LEAD: ${leadScore.tier} | CIERRE: ${closeSignal}
MENSAJE DEL CLIENTE: "${messageBody}"`


      // ════════════════════════════════════════
      // LLAMADA A LA IA
      // ════════════════════════════════════════
      const aiResponse = await aiService.chat(messageBody, chatHistory, userId, customerPhone, false, systemPrompt)
      const rawText = aiResponse?.text || 'Lo siento, estoy teniendo problemas. Intenta de nuevo.'

      // ════════════════════════════════════════
      // POST-PROCESADO: Extraer comandos de acción
      // ════════════════════════════════════════
      let media: any = undefined
      let cleanedText = rawText

      // FALLBACK DE SEGURIDAD PARA IMÁGENES:
      // Si la intención es 'IMAGE' y el bot no generó el comando [SEND_IMAGE], pero tenemos productos detectados,
      // adjuntamos la imagen del primer producto de forma automática para evitar fallos y bucles de fotos.
      if (intent === 'IMAGE' && !cleanedText.includes('[SEND_IMAGE:') && products.length > 0) {
        const productToSend = products[0]
        cleanedText += `\n[SEND_IMAGE:${productToSend.id}]`
        logger.info(`[Failsafe Imagen] Adjuntando automáticamente comando de imagen para producto ID: ${productToSend.id}`)
      }

      // --- COMANDO DE CARRITO ---
      const cartMatches = [...cleanedText.matchAll(/\[ADD_TO_CART:([^:]+):([0-9]+)(?::([^\]]+))?\]/g)]
      for (const m of cartMatches) {
        const prodId = m[1]
        const qty = parseInt(m[2], 10)
        const details = m[3] ? m[3].trim() : ''
        const prod = products.find((p: any) => String(p.id) === String(prodId))
        if (prod) {
          await conversationStateService.addToCart(userId, customerPhone, {
            id: prod.id,
            name: prod.name,
            price: Number(prod.price),
            catalog_type: prod.catalog_type,
            variant_details: details
          }, qty)
          logger.info(`[CARRITO] Agregado ${qty}x ${prod.name} ${details ? `(${details})` : ''} para ${customerPhone}`)
        }
      }
      cleanedText = cleanedText.replace(/\[ADD_TO_CART:[^\]]+\]/g, '')

      // --- COMANDO FACTURACIÓN (UPDATE_BILLING_DETAILS) ---
      const billingMatches = [...cleanedText.matchAll(/\[UPDATE_BILLING_DETAILS:([^:]+):([^\]]+)\]/g)]
      let updatedBillingName = null
      let updatedBillingDNI = null
      let billingValidationErrorMessage = ''
      
      for (const m of billingMatches) {
        const name = m[1].trim()
        const dni = m[2].trim()
        
        // Validar nombre completo (mínimo 2 palabras: Nombre + Apellido)
        const nameParts = name.split(/\s+/).filter(Boolean);
        const hasMin2Words = nameParts.length >= 2;
        // Validar que el nombre no contenga dígitos (evitar datos basura como "12345 Auner")
        const nameHasDigits = /\d/.test(name);
        
        // Validar DNI (8 dígitos) o RUC (11 dígitos)
        const digits = dni.replace(/\D/g, '');
        const isDni = digits.length === 8;
        const isRuc = digits.length === 11;
        const isWrongLength = digits.length < 8 || (digits.length > 8 && digits.length < 11) || digits.length > 11;
        
        if (!hasMin2Words || nameHasDigits) {
          billingValidationErrorMessage = `⚠️ *Nombre Incompleto:* Para generar tu boleta oficial necesito tus nombres y apellidos completos (ej: "Carlos Gómez"). Por favor, escríbelos así. Actualmente ingresaste: "${name}".`;
          break;
        }
        
        if (isWrongLength) {
          if (digits.length < 8) {
            billingValidationErrorMessage = `⚠️ *Documento Incorrecto:* El número ingresado (${digits}) tiene menos de 8 dígitos. Debe ser un DNI (8 dígitos) o RUC (11 dígitos) válido. Por favor, verifícalo.`;
          } else {
            billingValidationErrorMessage = `⚠️ *Documento Incorrecto:* El número ingresado (${digits}) tiene ${digits.length} dígitos. Recuerda que los DNI tienen 8 dígitos y los RUC tienen 11. Por favor, corrígelo para continuar.`;
          }
          break;
        }
        
        // Si es válido, guardar en memoria
        updatedBillingName = name
        updatedBillingDNI = digits
        await customerMemoryService.saveBillingInfo(userId, customerPhone, name, digits)
        logger.info(`[BILLING] Datos tributarios guardados con éxito: ${name} / ${digits}`)
      }
      cleanedText = cleanedText.replace(/\[UPDATE_BILLING_DETAILS:[^\]]+\]/g, '')

      // Si falló la validación tributaria, interceptamos de inmediato la respuesta del bot
      if (billingValidationErrorMessage) {
        return { text: billingValidationErrorMessage }
      }

      // --- COMANDO ENVÍO (UPDATE_SHIPPING_DETAILS) ---
      const shippingMatches = [...cleanedText.matchAll(/\[UPDATE_SHIPPING_DETAILS:([^:]+):([^:]+):([^:]+)(?::([^\]]+))?\]/g)]
      let shippingValidationErrorMessage = ''

      for (const m of shippingMatches) {
        const province = m[1].trim()
        const district = m[2].trim()
        const method = m[3].trim()
        const details = m[4] ? m[4].trim() : ''

        // Validar que la agencia ingresada exista en el sistema
        const methodLower = method.toLowerCase()
        const matchedAgency = systemAgencies.find((a: any) => 
          a.name.toLowerCase().includes(methodLower) || 
          methodLower.includes(a.name.toLowerCase())
        )

        if (!matchedAgency && methodLower !== 'recojo' && methodLower !== 'delivery') {
          const allowedNames = systemAgencies.map((a: any) => a.name).join(', ') || 'Shalom, Olva Courier'
          shippingValidationErrorMessage = `⚠️ *Agencia No Reconocida:* La agencia de envío "${method}" no está disponible actualmente. \n\n🚚 *Agencias autorizadas:* ${allowedNames}\n\nPor favor, elige una de nuestras agencias autorizadas o escribe *Recojo* si deseas retirar el producto en tienda. 😉`;
          break;
        }

        const finalMethod = matchedAgency ? matchedAgency.name : method
        await customerMemoryService.saveShippingInfo(userId, customerPhone, province, district, finalMethod, details)
        logger.info(`[SHIPPING] Datos de envío guardados: ${province} / ${district} / ${finalMethod} / ${details}`)
      }
      cleanedText = cleanedText.replace(/\[UPDATE_SHIPPING_DETAILS:[^\]]+\]/g, '')

      if (shippingValidationErrorMessage) {
        return { text: shippingValidationErrorMessage }
      }

      // --- COMANDO DE CARRITO (SOBRESCRIBIR / ACTUALIZAR CANTIDAD EXACTA) ---
      const updateCartMatches = [...cleanedText.matchAll(/\[UPDATE_CART:([^:]+):([0-9]+)(?::([^\]]+))?\]/g)]
      for (const m of updateCartMatches) {
        const prodId = m[1];
        const qty = parseInt(m[2], 10);
        const details = m[3] ? m[3].trim() : '';
        await conversationStateService.updateCartQty(userId, customerPhone, prodId, qty, details);
        logger.info(`[CARRITO] Actualizada cantidad exacta a ${qty}x para producto ID ${prodId} para ${customerPhone}`);
      }
      cleanedText = cleanedText.replace(/\[UPDATE_CART:[^\]]+\]/g, '')

      // --- COMANDO: ADELANTO NEGOCIADO ---
      const advanceMatch = cleanedText.match(/\[SET_ADVANCE:([0-9.]+)\]/)
      if (advanceMatch) {
        try {
          const advanceAmount = parseFloat(advanceMatch[1])
          if (!isNaN(advanceAmount) && advanceAmount > 0 && advanceAmount <= 50000) {
            await conversationStateService.setNegotiatedAdvance(userId, customerPhone, advanceAmount)
            logger.info(`[ADVANCE] S/ ${advanceAmount} negociado con ${customerPhone}`)
          }
        } catch (e: any) {
          logger.error('[ORCHESTRATOR] Error aplicando adelanto negociado:', e.message)
        }
        cleanedText = cleanedText.replace(/\[SET_ADVANCE:[^\]]+\]/g, '')
      }

      // --- COMANDO CHECKOUT ---
      if (cleanedText.includes('[ESCALATE_TO_HUMAN]')) {
        logger.warn(`[ESCALATION] 🆘 ${customerPhone} ha sido escalado a un agente humano. Bot en pausa por 30 min.`)
        // Pausar IA temporalmente (30 minutos — proveedor puede reactivar antes desde el panel)
        await conversationStateService.set(userId, customerPhone, { pausedUntil: Date.now() + 30 * 60 * 1000 })
        // Enviar alerta Socket.io al Dashboard
        io.to(`user_${userId}`).emit('human_escalation_alert', {
          customerPhone,
          customerName,
          timestamp: new Date().toISOString(),
          message: `🆘 ¡ATENCIÓN! El cliente ${customerName} (${customerPhone}) ha solicitado hablar con un humano. El bot está pausado.`
        })
        cleanedText = cleanedText.replace(/\[ESCALATE_TO_HUMAN\]/g, '')
      }

      // --- COMANDO CHECKOUT ---
      let usedFallbackBilling = false
      if (cleanedText.includes('[CHECKOUT]')) {
        // 🛡️ FAILSAFE TRIBUTARIO: Prevenir alucinaciones de la IA
        let billingInfo = await customerMemoryService.getBillingInfo(userId, customerPhone)
        
        if (!billingInfo) {
          // Fallback dinámico de recuperación: Buscar en pedidos previos o en el historial reciente
          let dni = ''
          let name = ''

          // A. Buscar en el último pedido
          const cleanPhoneSuffix = customerPhone.replace(/\D/g, '').slice(-9)
          const { rows: lastOrderRows } = await db.query(
            `SELECT customer_name, shipping_address FROM orders 
             WHERE user_id = $1 AND (customer_phone LIKE $2 OR customer_phone = $3)
             ORDER BY created_at DESC LIMIT 1`,
            [userId, `%${cleanPhoneSuffix}`, customerPhone]
          )
          
          if (lastOrderRows.length > 0) {
            name = lastOrderRows[0].customer_name.split(' (')[0].trim() // Limpiar "Cliente WA (1234)"
            const dniMatch = lastOrderRows[0].shipping_address.match(/DNI\/RUC:\s*(\d{8,11})/)
            if (dniMatch) {
              dni = dniMatch[1]
            }
          }

          // B. Buscar DNI/RUC en el historial de conversación reciente
          if (!dni) {
            for (const msg of historyRows) {
              const dniMatch = msg.content.match(/\b\d{8,11}\b/)
              if (dniMatch) {
                dni = dniMatch[0]
                break
              }
            }
          }

          // C. Buscar Nombre en el historial de conversación reciente (ej. "me llamo Carlos", "mi nombre es Juan")
          if (!name) {
            for (const msg of historyRows) {
              if (msg.role === 'user') {
                const nameMatch = msg.content.match(/(?:me llamo|mi nombre es|soy)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,30})/i)
                if (nameMatch) {
                  name = nameMatch[1].trim()
                  break
                }
              }
            }
          }

          // Si recuperamos el DNI/RUC, guardarlo en la memoria y continuar el checkout
          if (dni) {
            const finalName = name || customerName || 'Cliente WA'
            await customerMemoryService.saveBillingInfo(userId, customerPhone, finalName, dni)
            billingInfo = { name: finalName, dni }
            logger.info(`[CHECKOUT-FAILSAFE] Datos tributarios recuperados dinámicamente: ${finalName} / ${dni}`)
          }
        }

        // D. Si tras buscar exhaustivamente no tenemos datos, aplicamos Fallback Flexible (boleta genérica)
        if (!billingInfo) {
          logger.info(`[CHECKOUT-FAILSAFE] Datos tributarios no encontrados para ${customerPhone}. Aplicando fallback flexible...`)
          
          // Usamos el número de celular o '00000000' como DNI genérico
          const cleanPhone = customerPhone.replace(/\D/g, '')
          const dniFallback = cleanPhone.slice(-8) || '00000000'
          const nameFallback = customerName && customerName !== 'Cliente' ? customerName : 'Cliente WA'
          
          await customerMemoryService.saveBillingInfo(userId, customerPhone, nameFallback, dniFallback)
          billingInfo = { name: nameFallback, dni: dniFallback }
          usedFallbackBilling = true
        }

        const total = await conversationStateService.getCartTotal(userId, customerPhone)
        const cartItems = await conversationStateService.get(userId, customerPhone)
        const summary = await conversationStateService.getCartSummary(userId, customerPhone)

        // Crear pedido en DB si no existe
        const newOrder = await ordersService.createOrderFromCart(userId, customerPhone, cartItems?.cartItems || [], total)

        if (newOrder) {
          // --- BLOQUEO DE SEGURIDAD INDUSTRIAL ---
          const isProviderReady = await paymentService.isProviderReady(userId)
          if (!isProviderReady) {
            logger.warn(`[CHECKOUT-BLOCK] Proveedor ${userId} sin configuración para pedido ${newOrder.id}`)

            // Notificar al proveedor
            if (provider.phone) {
              whatsappRouter.sendMessage(userId, provider.phone, `⚠️ *VENTA BLOQUEADA: CONFIGURACIÓN PENDIENTE*\n\nUn cliente intentó pagar el pedido *#${newOrder.id.slice(0, 8)}* por *S/ ${total}*, pero no has conectado tu Mercado Pago o Gmail.\n\nConfigura tu cuenta ahora para cobrar esta venta: ${config.server.frontendUrl}/provider/settings`).catch(() => { })
            }

            return {
              text: `Uy, por un tema técnico nuestra pasarela de pagos está en mantenimiento rápido. 🛠️\n\nPor favor, comunícate directamente con nuestro asesor por aquí para coordinar tu compra manual. ¡Gracias por tu comprensión!`
            }
          }
          // ════════════════════════════════════════
          // MOTOR QR: Prioridad → MP → Yape → Plin → Manual
          // ════════════════════════════════════════
          let qrImagePath = ''       // La imagen QR que se enviará
          let paymentLabel = ''      // Texto del método de pago para el mensaje
          let paymentDetail = ''     // Instrucciones específicas

          // 1️⃣ MERCADO PAGO — QR dinámico (el más potente: acepta Yape, tarjetas, BBVA, etc.)
          if (mpToken) {
            try {
              const qrResult = await mercadoPagoService.generateOrderQR(
                mpToken,
                { id: newOrder.id, total, customer_email: `${customerPhone}@atines.com`, customer_name: `Cliente WA` },
                (cartItems?.cartItems || []).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, unit_price: i.price }))
              )
              qrImagePath = qrResult.qrFilePath
              paymentLabel = '💳 *PAGO QR — MERCADO PAGO*'
              paymentDetail = `📲 *Escanea el QR adjunto* con tu app bancaria (Yape, BCP, BBVA, Interbank, etc.).\n✅ Se confirma automáticamente en segundos.`
              logger.info(`[CHECKOUT] QR Mercado Pago generado para pedido ${newOrder.id}`)
            } catch (e: any) {
              logger.error('[CHECKOUT] Error Mercado Pago QR:', e.message)
            }
          }

          // 2️⃣ YAPE — QR manual subido por el proveedor
          if (!qrImagePath && manualConfig?.yape_qr) {
            qrImagePath = manualConfig.yape_qr
            const phone = manualConfig?.yape_phone || paymentConfig?.phone || ''
            paymentLabel = '💚 *PAGO CON YAPE*'
            paymentDetail = `📲 *Escanea el QR adjunto* con tu app Yape y paga al instante.${phone ? `\n📱 También puedes yapar al número: *${phone}*` : ''}\n👤 *Titular:* ${manualConfig?.bank_holder || provider.name}`
          }

          // 3️⃣ PLIN — QR manual subido por el proveedor
          if (!qrImagePath && manualConfig?.plin_qr) {
            qrImagePath = manualConfig.plin_qr
            const phone = manualConfig?.plin_phone || paymentConfig?.phone || ''
            paymentLabel = '🔵 *PAGO CON PLIN*'
            paymentDetail = `📲 *Escanea el QR adjunto* con tu app Plin y paga al instante.${phone ? `\n📱 También puedes enviar al número: *${phone}*` : ''}\n👤 *Titular:* ${manualConfig?.bank_holder || provider.name}`
          }

          // 4️⃣ FALLBACK — Número manual sin QR
          if (!qrImagePath) {
            const phone = manualConfig?.yape_phone || manualConfig?.plin_phone || paymentConfig?.phone || ''
            paymentLabel = '📱 *PAGO MANUAL (YAPE / PLIN)*'
            paymentDetail = `📱 *Número:* ${phone || 'Consulta al vendedor'}\n👤 *Titular:* ${manualConfig?.bank_holder || provider.name}\n_Envía el monto exacto e incluye tu nombre en el concepto._`
          }

          // ── Generar Boleta PDF (Resiliencia Industrial: no detiene el flujo si falla) ──
          let receiptPath = ''
          try {
            // 🧠 Usar el nombre de facturación recuperado/de fallback
            const customerDisplayName = billingInfo?.name || `Cliente WA (${customerPhone.slice(-4)})`

            // Obtener dirección de envío de la memoria
            const shippingInfo = await customerMemoryService.getShippingInfo(userId, customerPhone)
            let formattedShippingAddress = ''
            if (shippingInfo) {
              formattedShippingAddress = `${shippingInfo.deliveryMethod} - ${shippingInfo.province}, ${shippingInfo.district}`
              if (shippingInfo.details) {
                formattedShippingAddress += ` (${shippingInfo.details})`
              }
            }

            receiptPath = await receiptGeneratorService.generateReceiptPDF({
              orderId: newOrder.payment_reference_code || newOrder.id.substring(0, 8),
              customerName: customerDisplayName,
              customerPhone,
              items: (cartItems?.cartItems || []).map((i: any) => ({ name: i.name, quantity: i.quantity || 1, price: i.price })),
              total,
              date: new Date(),
              storeName: provider.name,
              paymentMethod: paymentLabel.replace(/\*/g, '').replace(/[📲💚🔵💳📱]/g, '').trim(),
              isPaid: newOrder.payment_status === 'paid',
              shippingAddress: formattedShippingAddress || undefined
            })
          } catch (pdfErr: any) {
            logger.error('[CHECKOUT] Error generando Boleta PDF:', pdfErr.message)
          }

          // ── Adjuntar QR + Boleta ───────────────────────────────────────
          const currentMedia: string[] = []
          if (qrImagePath) {
            const isHttp = qrImagePath.startsWith('http')
            const isData = qrImagePath.startsWith('data:')
            if (isHttp || isData) {
              currentMedia.push(qrImagePath)
            } else {
              // Si es un archivo local, verificar si existe antes de adjuntarlo
              const cleanPath = qrImagePath.startsWith('/') ? qrImagePath.slice(1) : qrImagePath
              const absPath = path.isAbsolute(qrImagePath) ? qrImagePath : path.join(process.cwd(), cleanPath)
              if (fs.existsSync(absPath)) {
                currentMedia.push(qrImagePath)
              } else {
                logger.warn(`[CHECKOUT] Archivo físico del QR no encontrado en el disco. Omitiendo adjunto: ${absPath}`)
              }
            }
          }
          if (receiptPath) currentMedia.push(receiptPath)   // Boleta solo si se generó bien

          if (!media) media = currentMedia
          else if (Array.isArray(media)) media.push(...currentMedia)
          else media = [media, ...currentMedia]

          // ── Mensaje de Checkout ────────────────────────────────────────
          const isImport = (cartItems?.cartItems || []).some((i: any) => i.catalog_type === 'global' || i.catalog_type === 'international')
          const negotiated = cartItems?.negotiatedAdvance  // S/ acordados con el cliente
          const SPLIT_THRESHOLD = 200
          const shouldSplit = isImport && total > SPLIT_THRESHOLD

          let advanceToPay: number
          let advanceLabel: string

          if (negotiated && negotiated > 0 && negotiated < total) {
            // 🤝 ADELANTO NEGOCIADO — El cliente acordó un monto fijo
            advanceToPay = negotiated
            advanceLabel = `🤝 *Adelanto acordado:* S/ ${negotiated.toFixed(2)} ← _Pagar ahora para reservar_\n💳 _Saldo restante: S/ ${(total - negotiated).toFixed(2)} — se paga al recibir el producto_`
          } else if (shouldSplit) {
            // 📦 IMPORTACIÓN > S/200 → Regla del 50%
            advanceToPay = total * 0.5
            advanceLabel = `⚠️ *Adelanto (50%):* S/ ${advanceToPay.toFixed(2)} ← _Pagar ahora para iniciar la importación_\n💳 _Saldo: S/ ${advanceToPay.toFixed(2)} — se cobra cuando llega a Lima_`
          } else {
            // ✅ PAGO COMPLETO
            advanceToPay = total
            advanceLabel = `💰 *Total a pagar:* S/ ${total.toFixed(2)}`
          }

          const amountMsg = negotiated || shouldSplit
            ? `💰 *Total del pedido:* S/ ${total.toFixed(2)}\n${advanceLabel}`
            : advanceLabel

          let checkoutMsg = `\n\n🛒 *RESUMEN DE TU PEDIDO*\n${summary}\n\n`
          checkoutMsg += `${amountMsg}\n\n`
          checkoutMsg += `━━━━━━━━━━━━━━━━━━━━━\n`
          checkoutMsg += `${paymentLabel}\n${paymentDetail}\n\n`
          checkoutMsg += `━━━━━━━━━━━━━━━━━━━━━\n`

          // 💳 Enlace de Checkout Web Omnicanal Sincronizado
          const browserCheckoutUrl = `${config.server.frontendUrl}/checkout?phone=${encodeURIComponent(customerPhone)}&userId=${userId}`
          checkoutMsg += `💳 *¿Prefieres pagar con Tarjeta o Web?*\n👉 *Completa tu compra de forma segura aquí:* ${browserCheckoutUrl}\n\n`
          checkoutMsg += `━━━━━━━━━━━━━━━━━━━━━\n`

          checkoutMsg += `📎 Te adjunto:\n  1️⃣ *Código QR* → Escanea y paga\n  2️⃣ *Boleta PDF* → Tu comprobante oficial\n\n`
          checkoutMsg += `✅ *Una vez que pagues*, envíame la captura de pantalla y confirmo tu pedido automáticamente. ¡Gracias por confiar en nosotros! 🙌`

          if (usedFallbackBilling) {
            checkoutMsg += `\n\n_(He generado tu código de pago con datos básicos para tu comodidad. Si deseas tu boleta con datos específicos de Nombre/DNI/RUC, solo escríbelos aquí y los actualizaré de inmediato. 😉)_`
          }

          cleanedText = cleanedText.replace(/\[CHECKOUT\]/g, checkoutMsg)

          // 🔔 NOTIFICAR AL PROVEEDOR (A SU NÚMERO PERSONAL DE PERFIL)
          if (provider.phone) {
            const orderItemsText = (cartItems?.cartItems || []).map((i: any) => `• ${i.name} (x${i.quantity || 1})`).join('\n')
            const providerAlert = `🛒 *NUEVO PEDIDO GENERADO POR EL BOT*\n\n👤 *Cliente:* +${customerPhone.replace(/\D/g, '')}\n🔢 *Pedido:* #${newOrder.id.substring(0, 8)}\n🛍️ *Productos:*\n${orderItemsText}\n💰 *Total:* S/ ${total.toFixed(2)}\n⚙️ *Método:* ${paymentLabel.replace(/\*/g, '').replace(/[📲💚🔵💳📱]/g, '').trim()}\n🚚 *Entrega:* ${isImport ? '✈️ Importación Global' : '📦 Por coordinar (Agencia / Recojo / Delivery Local)'}\n\nEl bot Atti ya le envió la boleta y el código QR de pago al cliente. Te avisaremos cuando suba el comprobante. 🚀`
            whatsappRouter.sendMessage(userId, provider.phone, providerAlert).catch(() => { })
          }
        }
      }


      // ════════════════════════════════════════
      // COMANDO: [SEND_TRACKING_PDF] — Hoja de Ruta Visual
      // ════════════════════════════════════════
      if (cleanedText.includes('[SEND_TRACKING_PDF]')) {
        cleanedText = cleanedText.replace(/\[SEND_TRACKING_PDF\]/g, '').trim()
        try {
          const trackingPath = await trackingPDFService.generateForPhone(userId, customerPhone)
          if (trackingPath) {
            if (!media) media = [trackingPath]
            else if (Array.isArray(media)) media.push(trackingPath)
            else media = [media, trackingPath]
            logger.info(`[TRACKING-PDF] Enviando hoja de ruta a ${customerPhone}`)
          }
        } catch (e: any) {
          logger.error('[TRACKING-PDF] Error generando PDF:', e.message)
        }
      }

      // ════════════════════════════════════════
      // COMANDO: [REALTIME_TRACKING] — Scraping en vivo Shalom/Olva
      // ════════════════════════════════════════
      const realtimeMatch = cleanedText.match(/\[REALTIME_TRACKING:(SHALOM|OLVA):([^:]+):([^\]]+)\]/i)
      if (realtimeMatch) {
        const agency = realtimeMatch[1].toUpperCase()
        const guide = realtimeMatch[2].trim()
        const codeOrYear = realtimeMatch[3].trim()
        
        cleanedText = cleanedText.replace(/\[REALTIME_TRACKING:[^\]]+\]/gi, '').trim()
        
        try {
          // Enviar mensaje de espera por websockets/whatsapp de inmediato
          whatsappRouter.sendMessage(userId, customerPhone, `⏳ Consultando los sistemas de ${agency}, dame unos segundos...`).catch(() => {})

          const { logisticsAgentService } = await import('./logisticsAgent.service')
          let result;
          if (agency === 'SHALOM') {
            result = await logisticsAgentService.trackShalom(guide, codeOrYear)
          } else {
            result = await logisticsAgentService.trackOlva(guide, codeOrYear)
          }

          if (result && result.status) {
            let trackReply = ''
            if (result.screenshot) {
              trackReply = `📦 *Resultado Oficial de ${agency}*\n\n🔹 *Estado:* ${result.status}\n\nTe adjunto la captura de pantalla oficial con los detalles del movimiento.`
              if (!media) media = [result.screenshot]
              else if (Array.isArray(media)) media.push(result.screenshot)
              else media = [media, result.screenshot]
            } else {
              trackReply = `📦 *Consulta de Rastreo ${agency}*\n\n⚠️ *Resultado:* ${result.status}\n📝 *Detalle:* ${result.detail}`
            }
            cleanedText = cleanedText + '\n\n' + trackReply
            logger.info(`[REALTIME-TRACKING] Rastreo en ${agency} procesado para ${customerPhone}`)
          }
        } catch (e: any) {
          logger.error(`[REALTIME-TRACKING] Error en ${agency}:`, e.message)
          cleanedText += `\n\n⚠️ Tuvimos un inconveniente consultando el sistema de ${agency} en este momento. Intenta rastrearlo en su web o consulta en unos minutos.`
        }
      }

      // ════════════════════════════════════════
      // COMANDO: [SEND_PAYMENT_QR] — Generación Dinámica de QR de Cobro
      // ════════════════════════════════════════
      if (cleanedText.includes('[SEND_PAYMENT_QR]')) {
        cleanedText = cleanedText.replace(/\[SEND_PAYMENT_QR\]/g, '').trim()
        try {
          const total = await conversationStateService.getCartTotal(userId, customerPhone)
          const cartItems = await conversationStateService.get(userId, customerPhone)

          let qrImagePath = ''
          let paymentLabel = ''
          let paymentDetail = ''

          let orderToPay = null
          if (cartItems && cartItems.cartItems && cartItems.cartItems.length > 0) {
            // Generamos un pedido borrador/temporal en la DB para Mercado Pago
            orderToPay = await ordersService.createOrderFromCart(userId, customerPhone, cartItems.cartItems, total)
          } else {
            // FALLBACK DE SEGURIDAD: Si el carrito está vacío pero el cliente tiene un pedido pendiente en la DB,
            // recuperamos ese pedido para generar su QR y evitar el bucle de amnesia.
            const pendingOrder = orders.find(o => o.payment_status === 'pending')
            if (pendingOrder) {
              orderToPay = pendingOrder
              logger.info(`[SEND_PAYMENT_QR] Failsafe activo: Recuperado pedido pendiente #${pendingOrder.id.substring(0, 8)} para generar QR.`)
            }
          }

          if (mpToken && !orderToPay) {
            return { text: "⚠️ Para generar tu código QR dinámico de Mercado Pago, primero debes decirme qué productos deseas comprar para agregarlos a tu carrito. ¿Qué estabas buscando?" }
          }

          if (orderToPay) {
            // Si Mercado Pago está configurado, generar QR Dinámico para este total exacto
            if (mpToken) {
              try {
                const orderItems = orderToPay.products ? (typeof orderToPay.products === 'string' ? JSON.parse(orderToPay.products) : orderToPay.products) : [];
                const qrResult = await mercadoPagoService.generateOrderQR(
                  mpToken,
                  { id: orderToPay.id, total: Number(orderToPay.total || total), customer_email: `${customerPhone}@atines.com`, customer_name: `Cliente WA` },
                  (orderItems.length > 0 ? orderItems : (cartItems?.cartItems || [])).map((i: any) => ({ name: i.name, quantity: i.quantity || i.qty || 1, unit_price: i.price }))
                )
                qrImagePath = qrResult.qrFilePath
                paymentLabel = '💳 *PAGO QR DINÁMICO — MERCADO PAGO*'
                paymentDetail = `📲 *Escanea el QR adjunto* para pagar tu pedido de *S/ ${Number(orderToPay.total || total).toFixed(2)}* con Yape, Plin o tu banco de preferencia.`
                logger.info(`[SEND_PAYMENT_QR] QR Mercado Pago dinámico generado para ${customerPhone} (S/ ${Number(orderToPay.total || total)})`)
              } catch (e: any) {
                logger.error('[SEND_PAYMENT_QR] Error MP QR dinámico:', e.message)
              }
            }
          }

          // Fallbacks si no se generó QR dinámico o no hay items en el carrito (QR Estáticos del Proveedor)
          if (!qrImagePath) {
            if (manualConfig?.yape_qr) {
              qrImagePath = manualConfig.yape_qr
              const phone = manualConfig?.yape_phone || paymentConfig?.phone || ''
              paymentLabel = '💚 *PAGO CON YAPE*'
              paymentDetail = `📲 *Escanea el QR adjunto* con tu Yape para pagar.${phone ? `\n📱 O yapea al número: *${phone}*` : ''}\n👤 *Titular:* ${manualConfig?.bank_holder || provider.name}`
            } else if (manualConfig?.plin_qr) {
              qrImagePath = manualConfig.plin_qr
              const phone = manualConfig?.plin_phone || paymentConfig?.phone || ''
              paymentLabel = '🔵 *PAGO CON PLIN*'
              paymentDetail = `📲 *Escanea el QR adjunto* con tu Plin para pagar.${phone ? `\n📱 O plinea al número: *${phone}*` : ''}\n👤 *Titular:* ${manualConfig?.bank_holder || provider.name}`
            } else {
              const phone = manualConfig?.yape_phone || manualConfig?.plin_phone || paymentConfig?.phone || ''
              paymentLabel = '📱 *PAGO MANUAL (YAPE / PLIN)*'
              paymentDetail = `📱 *Número:* ${phone || 'Consulta al vendedor'}\n👤 *Titular:* ${manualConfig?.bank_holder || provider.name}`
            }
          }

          // Si obtuvimos un QR, adjuntarlo a la lista de multimedia
          if (qrImagePath) {
            if (!media) media = [qrImagePath]
            else if (Array.isArray(media)) media.push(qrImagePath)
            else media = [media, qrImagePath]

            // Añadir explicación corta del QR de pago al texto final
            const qrExplain = `\n\n${paymentLabel}\n${paymentDetail}\n\n_Para evitar confusiones, una vez realizado el pago, envíame tu **NÚMERO DE OPERACIÓN** escrito aquí mismo en el chat (o la captura de pantalla) para confirmarlo automáticamente al instante. 🙌_`
            cleanedText += qrExplain
          } else {
            cleanedText += '\n\n⚠️ *Disculpa, no se pudo generar el código QR de pago en este momento. Por favor comunícate con un asesor para coordinar tu pago o ingresa a la Web.*'
          }
        } catch (qrErr: any) {
          logger.error('[SEND_PAYMENT_QR] Error general:', qrErr.message)
        }
      }

      // --- COMANDOS DE IMAGEN ---
      const imageMatches = [...cleanedText.matchAll(/\[SEND_IMAGE:([^\]]+)\]/g)]
      let productIds = imageMatches.map(m => m[1])

      const mediaList: string[] = []
      productIds = productIds.filter(id => {
        if (id === 'YAPE_QR') {
          const qr = manualConfig.yape_qr || paymentConfig.qr_code
          if (qr) { mediaList.push(qr); return false }
        }
        if (id === 'PLIN_QR') {
          const qr = manualConfig.plin_qr || paymentConfig.qr_code
          if (qr) { mediaList.push(qr); return false }
        }
        return true
      })
      cleanedText = cleanedText.replace(/\[SEND_IMAGE:[^\]]+\]/g, '')

      // Búsqueda semántica de respaldo
      if (productIds.length === 0 && mediaList.length === 0 && !cartMatches.length) {
        const lowerText = cleanedText.toLowerCase()
        const bestMatch = products.find((p: any) =>
          lowerText.includes(p.name.toLowerCase()) ||
          (p.description && lowerText.includes(p.description.toLowerCase().slice(0, 20)))
        )
        if (bestMatch) productIds.push(bestMatch.id)
      }

      const allMedia: string[] = [...mediaList]
      if (productIds.length > 0) {
        const { rows: mediaRows } = await db.query(
          'SELECT images, videos FROM products WHERE id::text = ANY($1)',
          [productIds]
        )
        mediaRows.forEach(r => {
          const imgs = Array.isArray(r.images) ? r.images : (r.images ? [r.images] : [])
          const vids = Array.isArray(r.videos) ? r.videos : (r.videos ? [r.videos] : [])
          if (imgs.length > 0) imgs.slice(0, 4).forEach((img: any) => allMedia.push(img))
          else if (vids.length > 0) allMedia.push(vids[0])
        })
      }

      if (allMedia.length > 0) {
        // PRESERVAR media existente (QR de pago, boletas, etc.) y fusionar con imágenes de productos
        if (!media) {
          media = allMedia.length === 1 ? allMedia[0] : allMedia
        } else {
          const existingMedia = Array.isArray(media) ? media : [media]
          media = [...existingMedia, ...allMedia]
        }
      }

      // --- PUBLICIDAD AUTOMÁTICA ---
      const adConfig = await settingsService.getAdVideoConfig()
      if (adConfig && adConfig.enabled && adConfig.video_url) {
        const { rows: recentMsgs } = await db.query(
          "SELECT id FROM conversation_history WHERE customer_phone = $1 AND user_id = $2 AND role = 'user' AND created_at > NOW() - INTERVAL '12 hours'",
          [customerPhone, userId]
        )
        if (recentMsgs.length === 0) {
          const adVideo = adConfig.video_url
          if (!media) media = [adVideo]
          else if (Array.isArray(media)) media = [adVideo, ...media]
          else media = [adVideo, media]
        }
      }

      const actions: string[] = []
      const catalogMatch = cleanedText.match(/\[SEND_CATALOGUE_PDF(?::([a-z]+))?\]/i)
      if (catalogMatch) {
        const catalogType = catalogMatch[1]?.toLowerCase() || 'all' // 'national', 'global', or 'all'
        actions.push(`SEND_PDF:${catalogType}`)
        cleanedText = cleanedText.replace(/\[SEND_CATALOGUE_PDF(?::[a-z]+)?\]/gi, '')
      }
      // Fallback: intent PDF sin comando explícito → detectar subtipo del mensaje original, incluyendo errores como "catalago"
      if ((intent === 'PDF' || /cat[aá]l[oa]go|cat[aá]logos/i.test(messageBody)) && !actions.some(a => a.startsWith('SEND_PDF'))) {
        const lowerMsg = messageBody.toLowerCase()
        const wantsGlobal = /importaci[oó]n|importaciones|global|de afuera|de usa|de china|del exterior|importado/i.test(lowerMsg)
        const wantsNational = /nacional|local|de stock|en stock|entrega inmediata|disponible/i.test(lowerMsg)
        const detectedType = wantsGlobal && !wantsNational ? 'global' : wantsNational && !wantsGlobal ? 'national' : 'all'
        actions.push(`SEND_PDF:${detectedType}`)
      }
      if ((intent === 'VOICE' || rawText.includes('[SEND_VOICE_RESPONSE]')) && !actions.includes('SEND_VOICE')) actions.push('SEND_VOICE')
      cleanedText = cleanedText.replace(/\[SEND_VOICE_RESPONSE\]/g, '')

      const hasPdfAction = actions.some(a => a.startsWith('SEND_PDF'))
      if (hasPdfAction && (intent as string) !== 'CHECKOUT') media = undefined

      // ════════════════════════════════════════
      // FORMATO Y PERSISTENCIA
      // ════════════════════════════════════════
      const text = cleanedText.trim()

      if (messageBody.length > 1) {
        await db.query(
          'INSERT INTO conversation_history (customer_phone, user_id, role, content) VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)',
          [customerPhone, userId, 'user', messageBody, 'assistant', text]
        )
      }

      if (intent === 'BUY' || cartMatches.length > 0) {
        await conversationStateService.set(userId, customerPhone, { stage: 'PRODUCT_SELECTED' })
      }

      // 🧠 ACTUALIZACIÓN DE MEMORIA (Background)
      customerMemoryService.extractAndSave(userId, customerPhone, messageBody).catch(err => {
        logger.error('[ORCHESTRATOR] Error actualizando memoria en background:', err)
      })

      return { text, media, actions }

    } catch (error: any) {
      logger.error('Error en AIOrchestrator:', { error: error?.message })
      return { text: 'Lo siento, ocurrió un error interno. Por favor intenta de nuevo en un momento.' }
    }
  }
}

export const aiOrchestrator = new AIOrchestrator()
