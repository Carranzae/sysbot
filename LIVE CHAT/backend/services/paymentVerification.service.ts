import { aiRotatorService } from "./aiRotator.service"
import { db } from "../database/db"
import { logger } from "../api/utils/logger"
import { encryption } from "../api/utils/encryption"
import { scanGmailPayments } from "./paymentEmailVerifier.service"
import Tesseract from 'tesseract.js'
import sharp from 'sharp'

export class PaymentVerificationService {
  /**
   * Verifica un comprobante de pago (Yape/Plin) usando IA (Gemini Vision) y Tesseract OCR
   */
  async verifyPayment(base64Image: string, providerId: string, customerPhone: string) {
    try {
      const cleanBase64 = base64Image.split(',')[1] || base64Image

      // 1. OBTENER CONFIG DE PROVEEDOR
      const { rows: providerRows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [providerId])
      const providerCfg = providerRows[0]?.payment_config || {}
      const gmailCfg = providerCfg.gmail || {}

      // ==========================================
      // CAPA 1: PRE-FILTRO RÁPIDO CON TESSERACT OCR (PRECISIÓN EXTREMA)
      // ==========================================
      logger.info(`[VALIDADOR-OCR] Iniciando extracción rápida de texto con Sharp...`)
      try {
        // Pre-procesamiento de grado industrial para máxima precisión OCR
        const imageBuffer = Buffer.from(cleanBase64, 'base64')
        const processedBuffer = await sharp(imageBuffer)
          .grayscale() // Eliminar ruido de color
          .normalize() // Maximizar contraste (textos negros, fondo blanco)
          .sharpen()   // Afilar bordes para evitar confusión entre 8 y B
          .toBuffer()

        const ocrResult = await Tesseract.recognize(
          processedBuffer,
          'spa'
        )
        const ocrText = ocrResult.data.text
        logger.info(`[VALIDADOR-OCR] Texto extraído (${ocrText.length} chars): ${ocrText.substring(0, 200).replace(/\n/g, ' | ')}`)

        // Buscar códigos de 6 a 12 dígitos (Número de Operación)
        const possibleCodes = ocrText.match(/\b\d{6,12}\b/g)
        // Buscar montos con formato S/ o s/ (ej: S/ 150.00, S/50, 150.00)
        const amountMatch = ocrText.match(/S\/?[\s]*(\d[\d.,]+)/i)
        const ocrAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null
        // Buscar fecha (dd/mm/yyyy o yyyy-mm-dd)
        const dateMatch = ocrText.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/)
        const ocrDate = dateMatch ? dateMatch[1] : null
        
        logger.info(`[VALIDADOR-OCR] Códigos: ${possibleCodes?.join(', ') || 'ninguno'} | Monto: ${ocrAmount ? `S/ ${ocrAmount}` : 'N/A'} | Fecha: ${ocrDate || 'N/A'}`)

        if (possibleCodes && possibleCodes.length > 0) {

          // ═══════════════════════════════════════════════
          // RUTA A: CON GMAIL → Máxima seguridad (cruce bancario)
          // ═══════════════════════════════════════════════
          if (gmailCfg.refreshToken) {
            for (const code of possibleCodes) {
              const scanResult = await scanGmailPayments({
                refreshToken: encryption.decrypt(gmailCfg.refreshToken),
                query: `"${code}"`
              })

              if (scanResult.paid > 0 || scanResult.matched > 0) {
                logger.info(`[VALIDADOR-OCR] ✅ ¡Match perfecto OCR + Gmail con código: ${code}!`)
                
                // Buscar pedido pendiente
                const { rows: orders } = await db.query(
                  `SELECT id, total, payment_reference_code, payment_status, payment_details FROM orders 
                   WHERE user_id = $1 AND customer_phone LIKE $2 
                   AND payment_status = 'pending'
                   ORDER BY created_at DESC LIMIT 1`,
                  [providerId, `%${customerPhone.slice(-9)}%`]
                )

                if (orders.length > 0) {
                  const order = orders[0]
                  
                  // Actualizar pedido a confirmado
                  await db.query(
                    `UPDATE orders SET payment_status = 'confirmed', status = 'preparando',
                     payment_details = jsonb_set(COALESCE(payment_details, '{}')::jsonb, '{transaction_id}', $1::jsonb),
                     updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify(code), order.id]
                  )

                  // Limpiar el carrito del cliente
                  const { conversationStateService } = await import("./conversationState.service")
                  conversationStateService.reset(providerId, customerPhone)

                  // Notificar proveedor
                  const { rows: providerData } = await db.query('SELECT phone, almacen_phone FROM users WHERE id = $1', [providerId])
                  const provider = providerData[0]
                  if (provider?.phone) {
                    const { whatsappWebManager } = await import("./whatsappWeb.service")
                    const providerMsg = `💰 ¡Venta Confirmada (OCR + Gmail)! 💰\n\nEl cliente +${customerPhone.replace(/\D/g, '')} envió comprobante con código *#${code}* y fue verificado contra tu correo bancario.\n\nPedido #${order.payment_reference_code || order.id.slice(0,8)} → Estado: Preparando 🚀`
                    whatsappWebManager.sendMessage(providerId, provider.phone, providerMsg).catch(() => {})
                  }

                  return { 
                    success: true, 
                    message: `✅ *PAGO VERIFICADO AL INSTANTE* 💰\n\nHe leído tu comprobante automáticamente y el código de operación *#${code}* coincide con nuestros registros bancarios.\n\nTu pedido *#${order.payment_reference_code || order.id.slice(0,8)}* ha sido confirmado oficialmente y pasó al área de empaquetado. 🚀✨`, 
                    orderId: order.id 
                  }
                }
              }
            }
          }

          // ═══════════════════════════════════════════════
          // RUTA B: SIN GMAIL → Validación cautelosa por Base de Datos
          // (Solo si NO hay Gmail configurado)
          // ═══════════════════════════════════════════════
          if (!gmailCfg.refreshToken && ocrAmount && ocrAmount > 0) {
            logger.info(`[VALIDADOR-OCR-DB] Sin Gmail. Iniciando validación cautelosa por Base de Datos...`)

            for (const code of possibleCodes) {
              // ── SEGURIDAD 1: ¿Código ya usado antes? (Anti-reutilización) ──
              const { rows: duplicateCheck } = await db.query(
                `SELECT id, customer_phone FROM orders 
                 WHERE user_id = $1 AND payment_details->>'transaction_id' = $2`,
                [providerId, code]
              )

              if (duplicateCheck.length > 0) {
                logger.warn(`[VALIDADOR-OCR-DB] 🚨 CÓDIGO DUPLICADO: ${code} ya usado en pedido ${duplicateCheck[0].id}`)
                
                // Alertar al proveedor
                const { rows: providerData } = await db.query('SELECT phone FROM users WHERE id = $1', [providerId])
                if (providerData[0]?.phone) {
                  const { whatsappWebManager } = await import("./whatsappWeb.service")
                  whatsappWebManager.sendMessage(providerId, providerData[0].phone, 
                    `🚨 *ALERTA ANTIFRAUDE*\n\nEl cliente +${customerPhone.replace(/\D/g, '')} envió un comprobante con código de operación *#${code}* que YA FUE USADO en otro pedido.\n\n⚠️ Posible intento de reutilización de voucher.`
                  ).catch(() => {})
                }

                return {
                  success: false,
                  isFraud: true,
                  message: `⚠️ *ALERTA DE SEGURIDAD* ⚠️\n\nEste código de operación (#${code}) ya ha sido registrado anteriormente en nuestro sistema.\n\nSi crees que es un error, contacta a soporte. ⏳`
                }
              }

              // ── SEGURIDAD 2: ¿Fecha reciente? (Anti-vouchers viejos) ──
              if (ocrDate) {
                let parsedDate: Date | null = null
                if (ocrDate.includes('/')) {
                  const [d, m, y] = ocrDate.split('/')
                  parsedDate = new Date(`${y}-${m}-${d}`)
                } else {
                  parsedDate = new Date(ocrDate)
                }
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                  const hoursDiff = Math.abs(Date.now() - parsedDate.getTime()) / (1000 * 60 * 60)
                  if (hoursDiff > 48) {
                    logger.warn(`[VALIDADOR-OCR-DB] ⏳ Comprobante con fecha antigua: ${ocrDate} (${hoursDiff.toFixed(0)}h)`)
                    return {
                      success: false,
                      message: `⏳ *COMPROBANTE EXPIRADO*\n\nLa fecha de este pago (${ocrDate}) es demasiado antigua. Solo aceptamos comprobantes de las últimas 48 horas.`
                    }
                  }
                }
              }

              // ── SEGURIDAD 3: ¿Monto coincide con pedido pendiente? ──
              const { rows: orders } = await db.query(
                `SELECT id, total, payment_reference_code, payment_status, payment_details FROM orders 
                 WHERE user_id = $1 AND customer_phone LIKE $2 
                 AND payment_status = 'pending'
                 ORDER BY created_at DESC LIMIT 1`,
                [providerId, `%${customerPhone.slice(-9)}%`]
              )

              if (orders.length > 0) {
                const order = orders[0]
                const expectedAmount = order.payment_details?.expected_payment_amount 
                  ? parseFloat(order.payment_details.expected_payment_amount) 
                  : parseFloat(order.total)

                // Tolerancia de S/ 1.00 máximo (por redondeos o comisiones bancarias)
                const amountDiff = Math.abs(expectedAmount - ocrAmount)

                if (amountDiff < 1.0) {
                  logger.info(`[VALIDADOR-OCR-DB] ✅ Match por DB: Código ${code} | Monto OCR S/${ocrAmount} ≈ Pedido S/${expectedAmount} (diff: ${amountDiff.toFixed(2)})`)

                  // Actualizar pedido a confirmado
                  const paymentDetails = {
                    transaction_id: code,
                    amount: ocrAmount,
                    date: ocrDate || new Date().toISOString().split('T')[0],
                    verified_by: 'ocr_db_match',
                    verified_at: new Date().toISOString()
                  }

                  await db.query(
                    `UPDATE orders SET 
                      payment_status = 'confirmed', 
                      status = 'preparando',
                      payment_details = $1,
                      updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify(paymentDetails), order.id]
                  )

                  // Limpiar carrito
                  const { conversationStateService } = await import("./conversationState.service")
                  conversationStateService.reset(providerId, customerPhone)

                  // Notificar proveedor CON ALERTA de que fue sin Gmail
                  const { rows: providerData } = await db.query('SELECT phone, almacen_phone FROM users WHERE id = $1', [providerId])
                  const provider = providerData[0]
                  if (provider?.phone) {
                    const { whatsappWebManager } = await import("./whatsappWeb.service")
                    const providerMsg = `💰 *Venta Confirmada (OCR Automático)* 💰\n\nCliente +${customerPhone.replace(/\D/g, '')} envió comprobante.\n🔢 Código: *#${code}*\n💵 Monto: *S/ ${ocrAmount}*\n📦 Pedido: *#${order.payment_reference_code || order.id.slice(0,8)}*\n\n⚠️ _Verificado por lectura de imagen + base de datos (sin cruce de correo). Si deseas validación bancaria automática, configura tu Gmail en Ajustes._\n\n✅ Pedido en estado 'Preparando'.`
                    whatsappWebManager.sendMessage(providerId, provider.phone, providerMsg).catch(() => {})
                  }

                  return { 
                    success: true, 
                    message: `✅ *PAGO VERIFICADO* 💰\n\nHe leído tu comprobante: código de operación *#${code}* por *S/ ${ocrAmount.toFixed(2)}*, y coincide con tu pedido pendiente.\n\nTu pedido *#${order.payment_reference_code || order.id.slice(0,8)}* ha sido confirmado. 🚀✨`, 
                    orderId: order.id 
                  }
                } else {
                  logger.warn(`[VALIDADOR-OCR-DB] ⚠️ Monto NO coincide: OCR S/${ocrAmount} vs Pedido S/${expectedAmount} (diff: ${amountDiff.toFixed(2)})`)
                  return {
                    success: false,
                    message: `🔍 He leído tu comprobante y detecté un pago de *S/ ${ocrAmount.toFixed(2)}*, pero el monto de tu pedido es *S/ ${expectedAmount.toFixed(2)}*.\n\nPor favor verifica el monto o envía el comprobante correcto. Si necesitas ayuda, un asesor te atenderá. ⏳`
                  }
                }
              }
            }
          }
        }
        logger.info(`[VALIDADOR-OCR] No hubo match definitivo en OCR. Pasando a Gemini Vision...`)
      } catch (ocrErr: any) {
        logger.warn(`[VALIDADOR-OCR] Error leyendo imagen con Tesseract: ${ocrErr.message}. Pasando a Gemini...`)
      }

      // ==========================================
      // CAPA 2: ANÁLISIS FORENSE CON GEMINI VISION
      // ==========================================
      const prompt = `Analiza detalladamente esta imagen de captura de pantalla.
      Determina primero si corresponde a un comprobante o voucher de pago de bancos peruanos (Yape, Plin, BCP, BBVA, Interbank, Banco de la Nación, Scotiabank).
      
      Si NO es un comprobante de pago (es una foto de ropa, calzado, paisajes o cualquier otra cosa), responde exactamente con este JSON:
      {
        "is_valid_payment": false,
        "is_receipt_image": false,
        "fraud_score": 0,
        "amount": 0,
        "transaction_id": "",
        "sender_name": "",
        "date": "",
        "time": "",
        "bank": "",
        "fraud_reason": "No es una imagen de comprobante de pago."
      }

      Si SÍ es un comprobante de pago, analízalo con lupa forense digital para verificar si es real o es un fotomontaje/estafa.
      Extrae los datos en este formato JSON puro:
      {
        "is_valid_payment": boolean (true si el pago es legítimo y no muestra indicios de alteración, false en caso contrario),
        "is_receipt_image": true,
        "amount": number (monto transferido exacto),
        "transaction_id": "string (número de operación, referencia o código de rastreo completo)",
        "sender_name": "string (nombre del pagador o titular de origen)",
        "date": "string (formato YYYY-MM-DD)",
        "time": "string (formato HH:mm)",
        "bank": "string (Yape, Plin, BCP, BBVA, Interbank, etc.)",
        "fraud_score": number (de 0 a 10, donde 10 es fraude totalmente seguro y 0 es completamente legítimo),
        "fraud_reason": "string (razón clara y detallada si sospechas de fraude, edición, inconsistencias o si es ilegible)"
      }

      REGLAS DE AUDITORÍA FORENSE (HEURÍSTICAS PERUANAS):
      1. TIPOGRAFÍA ALTERADA: Los estafadores usan plantillas de Yape/Plin editadas. Observa si el tipo de letra del MONTO, la FECHA o el NÚMERO DE OPERACIÓN difiere en grosor, nitidez, alineación o color respecto a las otras letras.
      2. LOGOS Y BORDES: Verifica que los logos del banco no estén pixelados o recortados burdamente. Si los números del monto tienen un fondo con texturas comprimidas o borrosas, marca un fraud_score de 8 o más.
      3. INCOHERENCIA DE DATOS: Valida que la fecha y la hora del voucher sean lógicas y coherentes.
      4. DUALIDAD DE COLORES: Verifica si hay zonas con diferente balance de blancos alrededor de los textos clave.

      IMPORTANTE: Devuelve únicamente el objeto JSON puro y válido, sin bloques de código markdown (\`\`\`json) ni comentarios adicionales.`

      const result = await aiRotatorService.executeWithRetry(async (model) => {
        return await model.generateContent([
          prompt,
          {
            inlineData: {
              data: cleanBase64,
              mimeType: "image/jpeg",
            },
          },
        ])
      }, 'gemini-2.0-flash', { base64: cleanBase64, prompt })

      let responseText = result.response.text().trim()
      responseText = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      const paymentData = JSON.parse(responseText)

      logger.info(`[VALIDADOR-IA] 👁️ Ojos de Gemini activos:`, {
        es_comprobante: paymentData.is_receipt_image,
        banco: paymentData.bank,
        monto: paymentData.amount,
        id_transaccion: paymentData.transaction_id,
        hora: paymentData.time,
        puntaje_fraude: paymentData.fraud_score
      })

      // Si no es una imagen de comprobante de pago, saltar silenciosamente a la búsqueda visual
      if (paymentData.is_receipt_image === false) {
        return { success: false }
      }

      if (paymentData.is_valid_payment && paymentData.fraud_score < 5) {
        if (!paymentData.transaction_id || paymentData.transaction_id.trim() === '') {
          return {
            success: false,
            message: `⚠️ *CÓDIGO ILEGIBLE*\n\nHe verificado que tu comprobante es válido, pero no logro distinguir bien el *Número de Operación* en la imagen.\n\nPor favor, **escribe el código de operación** aquí en el chat para validarlo en el sistema bancario de inmediato. ⏳`
          }
        }
        // 1. VERIFICACIÓN ANTIFRAUDE: ¿Ya existe este ID de transacción para este proveedor?
        const { rows: duplicateCheck } = await db.query(
          `SELECT id FROM orders 
           WHERE user_id = $1 AND payment_details->>'transaction_id' = $2`,
          [providerId, paymentData.transaction_id]
        )

        if (duplicateCheck.length > 0) {
          // Si es un duplicado, activamos alerta de fraude de inmediato
          const { rows: providerData } = await db.query('SELECT phone FROM users WHERE id = $1', [providerId])
          const provider = providerData[0]

          if (provider?.phone) {
            const { whatsappWebManager } = await import("./whatsappWeb.service")
            const fraudAlert = `🚨 *ALERTA DE SEGURIDAD: INTENTO DE REUTILIZACIÓN DE VOUCHER* 🚨\n\nEl cliente con número *+${customerPhone.replace(/\D/g, '')}* ha enviado un comprobante que ya ha sido registrado en otra venta.\n\n🏦 *Banco:* ${paymentData.bank}\n💵 *Monto:* S/ ${paymentData.amount}\n🔢 *Operación:* #${paymentData.transaction_id}\n\nEl bot Atti no ha confirmado este pedido. Por favor revisa con cuidado.`
            whatsappWebManager.sendMessage(providerId, provider.phone, fraudAlert).catch(() => {})
          }

          return { 
            success: false, 
            isFraud: true,
            message: `⚠️ *ALERTA DE SEGURIDAD* ⚠️\n\nEste comprobante (Operación #${paymentData.transaction_id}) ya ha sido registrado anteriormente en nuestro sistema.\n\nSi crees que esto es un error, por favor contacta a soporte para validarlo manualmente. ⏳` 
          }
        }

        let gmailMatched: boolean | null = null // null: no configurado, true: match, false: no match

        // 1.1 VERIFICACIÓN DE EMAIL (Doble validación industrial)
        const { rows: providerRows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [providerId])
        const providerCfg = providerRows[0]?.payment_config || {}
        const gmailCfg = providerCfg.gmail || {}

        if (gmailCfg.refreshToken) {
          logger.info(`[VALIDADOR-IA] 🔎 Iniciando Cross-Check en Gmail para ID: ${paymentData.transaction_id}...`)
          try {
            const scanResult = await scanGmailPayments({
              refreshToken: encryption.decrypt(gmailCfg.refreshToken),
              query: `"${paymentData.transaction_id}"` // Buscar específicamente este ID
            })
            
            if (scanResult.paid > 0) {
              gmailMatched = true
              logger.info(`[VALIDADOR-IA] ✅ ¡COINCIDENCIA ENCONTRADA EN GMAIL! El banco confirmó el dinero.`)
            } else {
              gmailMatched = false
              logger.warn(`[VALIDADOR-IA] ⚠️ Gemini vio el ID, pero no hay correo del banco aún. (Posible retraso bancario o fraude)`)
            }
          } catch (e: any) {
            logger.error(`[VALIDADOR-IA] ❌ Error conectando a Gmail: ${e.message}`)
          }
        }

        // 2. VERIFICACIÓN DE FECHA: No permitir vouchers viejos (más de 48h)
        const paymentDate = new Date(paymentData.date)
        const today = new Date()
        const diffHours = Math.abs(today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60)
        
        if (diffHours > 48) {
          return {
            success: false,
            message: `⏳ *COMPROBANTE EXPIRADO*\n\nLa fecha de este pago (${paymentData.date}) es demasiado antigua. Solo aceptamos comprobantes de las últimas 48 horas.`
          }
        }

        // Buscar el pedido (puede estar 'pending' o haber sido actualizado a 'paid'/'confirmed' por el scan de Gmail justo arriba)
        const { rows: orders } = await db.query(
          `SELECT id, total, payment_reference_code, payment_status, payment_details FROM orders 
           WHERE user_id = $1 AND customer_phone LIKE $2 
           AND (payment_status = 'pending' OR payment_details->>'transaction_id' = $3)
           ORDER BY created_at DESC LIMIT 1`,
          [providerId, `%${customerPhone.slice(-9)}%`, paymentData.transaction_id]
        )

        if (orders.length > 0) {
          const order = orders[0]
          
          // Obtener el monto esperado a pagar (completo, adelanto de importación, o el negociado)
          const expectedAmount = order.payment_details?.expected_payment_amount 
            ? parseFloat(order.payment_details.expected_payment_amount) 
            : parseFloat(order.total)

          // Comparar montos (permitir pequeña variación por comisiones)
          if (Math.abs(expectedAmount - paymentData.amount) < 0.1) {
            let finalMessage = ''
            
            if (gmailMatched === true) {
              finalMessage = `✅ *PAGO VERIFICADO - NIVEL DIOS* 💰\n\nHe detectado tu pago de *S/ ${paymentData.amount.toFixed(2)}* vía *${paymentData.bank}*.\n\n🔍 *Validación Cruzada:* He contrastado los datos con la notificación de mi correo y ¡coinciden perfectamente! ✅\n\nTu pedido *#${order.payment_reference_code || order.id.slice(0,8)}* ha sido confirmado y pasó al área de empaquetado. 🚀✨`
            } else if (gmailMatched === false) {
              // IA lo vio bien, pero el banco aún no manda el correo
              finalMessage = `⏳ *PAGO EN REVISIÓN BANCARIA*\n\nHe leído tu comprobante de *S/ ${paymentData.amount.toFixed(2)}* (Operación #${paymentData.transaction_id}).\n\nSin embargo, la confirmación oficial del banco aún no ha llegado a nuestro sistema. A veces toma unos minutos.\n\nTu pedido *#${order.payment_reference_code || order.id.slice(0,8)}* quedará en espera hasta que se acredite. ¡Te avisaremos! ⏳`
              // No actualizamos a confirmado, lo dejamos pendiente para que un humano o el escáner asíncrono lo valide
              return { success: true, message: finalMessage, orderId: order.id }
            } else {
              // No tiene Gmail configurado, validación puramente visual por IA
              finalMessage = `✅ *PAGO VERIFICADO POR IA* 💰\n\nHe procesado tu comprobante de *S/ ${paymentData.amount.toFixed(2)}* vía *${paymentData.bank}*.\n\nTu pedido *#${order.payment_reference_code || order.id.slice(0,8)}* ha sido confirmado. ¡Gracias por tu compra! 🚀✨`
            }

            // Solo actualizar si no ha sido confirmado aún por el scan de Gmail
            if (order.payment_status !== 'paid' && order.payment_status !== 'confirmed') {
              await db.query(
                `UPDATE orders SET 
                  payment_status = 'confirmed',
                  status = 'preparando',
                  payment_details = $1,
                  updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify(paymentData), order.id]
              )
            }

            // Limpiar el carrito del cliente ya que ya pagó
            const { conversationStateService } = await import("./conversationState.service")
            conversationStateService.reset(providerId, customerPhone)

            // NOTIFICAR AL PROVEEDOR / ALMACÉN
            const { rows: providerData } = await db.query('SELECT phone, almacen_phone FROM users WHERE id = $1', [providerId])
            const provider = providerData[0]

            if (provider?.phone) {
              const { whatsappWebManager } = await import("./whatsappWeb.service")
              const providerMsg = `💰 ¡Venta Confirmada por IA! 💰\n\nEl cliente ${paymentData.sender_name} acaba de pagar S/ ${paymentData.amount} por el pedido #${order.payment_reference_code || order.id.slice(0,8)}.\n\nEl pedido ya está en estado 'Preparando' para el almacén. 🚀`
              whatsappWebManager.sendMessage(providerId, provider.phone, providerMsg).catch(() => {})
            }

            if (provider?.almacen_phone) {
              const { whatsappWebManager } = await import("./whatsappWeb.service")
              const warehouseMsg = `✅ *PAGO VERIFICADO - INICIAR DESPACHO* #${order.payment_reference_code || order.id.slice(0,8)}\n\n💰 Monto: S/ ${paymentData.amount}\n👤 Cliente: ${paymentData.sender_name}\n\n🚀 Por favor, proceder con el empaquetado inmediato.`
              whatsappWebManager.sendMessage(providerId, provider.almacen_phone, warehouseMsg).catch(() => {})
            }

            return { 
              success: true, 
              message: finalMessage, 
              orderId: order.id 
            }
          } else {
            return { 
              success: false, 
              message: `🔍 He detectado un pago de *S/ ${paymentData.amount.toFixed(2)}*, pero el monto no coincide exactamente con el total de tu pedido (*S/ ${order.total.toFixed(2)}*).\n\nUn agente humano revisará esto en unos minutos para ayudarte. ⏳` 
        }
      }
    }
  } else {
        // 🚨 COMPROBANTE SOSPECHOSO DE FRAUDE (FOTOSHOP / EDICIÓN)
        logger.warn(`[VALIDADOR-IA] 🚨 SOSPECHA DE FRAUDE para ${customerPhone}:`, paymentData)

        // Notificar inmediatamente al dueño de la tienda
        const { rows: providerData } = await db.query('SELECT phone FROM users WHERE id = $1', [providerId])
        const provider = providerData[0]

        if (provider?.phone) {
          const { whatsappWebManager } = await import("./whatsappWeb.service")
          const fraudAlert = `🚨 *ALERTA DE SEGURIDAD: COMPROBANTE SOSPECHOSO* 🚨\n\nEl cliente con número *+${customerPhone.replace(/\D/g, '')}* ha enviado un comprobante de pago con alto índice de sospecha.\n\n📊 *Sospecha:* ${paymentData.fraud_score}/10\n📝 *Razón de la sospecha:* ${paymentData.fraud_reason || 'Modificaciones digitales o imagen alterada.'}\n💵 *Monto:* S/ ${paymentData.amount || 'No legible'}\n🏦 *Banco:* ${paymentData.bank || 'No legible'}\n\n⚠️ *Atención:* Por favor verifica el abono en tu banca móvil antes de despachar cualquier producto.`
          whatsappWebManager.sendMessage(providerId, provider.phone, fraudAlert).catch(() => {})
        }

        return {
          success: false,
          isFraud: true,
          message: `⚠️ *VERIFICACIÓN EN PROCESO* ⚠️\n\nTu comprobante de pago está tomando un poco más de tiempo para ser procesado por nuestro validador electrónico automático.\n\nUn asesor humano del departamento de facturación validará tu transferencia manualmente en unos minutos para habilitar tu despacho. ¡Muchas gracias por tu paciencia! ⏳`
        }
      }

      return { success: false, message: "No pudimos vincular este pago con un pedido pendiente. Un humano lo revisará pronto. ⏳" }
    } catch (error: any) {
      logger.error("Error en Verificación de Pago IA:", { error: error.message })
      return { success: false, error: "Error procesando el comprobante" }
    }
  }
  /**
   * Verifica un pago de Yape/Plin utilizando únicamente el Código de Operación ingresado por el cliente en texto.
   */
  async verifyPaymentByCode(operationCode: string, providerId: string, customerPhone: string) {
    try {
      const cleanCode = operationCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      
      if (!cleanCode || cleanCode.length < 5) {
        return { success: false, message: "El código ingresado no parece válido. Por favor verifica e intenta de nuevo." }
      }

      logger.info(`[VALIDADOR-TEXTO] 🔎 Iniciando Cross-Check en Gmail para ID de texto: ${cleanCode}...`)

      // Buscar el pedido pendiente
      const { rows: orders } = await db.query(
        `SELECT id, total, payment_reference_code, payment_status, payment_details FROM orders 
         WHERE user_id = $1 AND customer_phone LIKE $2 
         AND payment_status = 'pending'
         ORDER BY created_at DESC LIMIT 1`,
        [providerId, `%${customerPhone.slice(-9)}%`]
      )

      if (orders.length === 0) {
        return { success: false, message: "No encontramos ningún pedido pendiente asociado a este número para validar el código." }
      }

      const order = orders[0]

      // Buscar en Gmail
      const { rows: providerRows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [providerId])
      const providerCfg = providerRows[0]?.payment_config || {}
      const gmailCfg = providerCfg.gmail || {}

      if (!gmailCfg.refreshToken) {
        // Si no tiene Gmail configurado, no podemos validar texto automáticamente.
        return { success: false, message: "⚠️ *VERIFICACIÓN EN PROCESO*\n\nEl sistema de verificación automática no está configurado para este vendedor. Un asesor revisará tu código de operación en breve. ⏳" }
      }

      const scanResult = await scanGmailPayments({
        refreshToken: encryption.decrypt(gmailCfg.refreshToken),
        query: `"${cleanCode}"` // Buscar específicamente este código
      })

      if (scanResult.paid > 0 || scanResult.matched > 0) {
        // El scan de Gmail ya hizo la actualización de la base de datos y mandó correo si matched.
        // Pero para asegurar, verificamos el pedido de nuevo.
        const { rows: updatedOrders } = await db.query('SELECT payment_status FROM orders WHERE id = $1', [order.id])
        if (updatedOrders[0]?.payment_status === 'paid' || updatedOrders[0]?.payment_status === 'confirmed') {
          // Limpiar el carrito
          const { conversationStateService } = await import("./conversationState.service")
          conversationStateService.reset(providerId, customerPhone)

          // NOTIFICAR AL PROVEEDOR / ALMACÉN
          const { rows: providerData } = await db.query('SELECT phone, almacen_phone FROM users WHERE id = $1', [providerId])
          const provider = providerData[0]

          if (provider?.phone) {
            const { whatsappWebManager } = await import("./whatsappWeb.service")
            const providerMsg = `💰 ¡Venta Confirmada por Código (Texto)! 💰\n\nEl cliente de número +${customerPhone.replace(/\\D/g, '')} acaba de validar su código de operación *#${cleanCode}* por el pedido #${order.payment_reference_code || order.id.slice(0,8)}.\n\nEl pedido ya está en estado 'Preparando'. 🚀`
            whatsappWebManager.sendMessage(providerId, provider.phone, providerMsg).catch(() => {})
          }

          if (provider?.almacen_phone) {
            const { whatsappWebManager } = await import("./whatsappWeb.service")
            const warehouseMsg = `✅ *PAGO VERIFICADO (VÍA CÓDIGO) - INICIAR DESPACHO* #${order.payment_reference_code || order.id.slice(0,8)}\n\n🚀 Por favor, proceder con el empaquetado inmediato.`
            whatsappWebManager.sendMessage(providerId, provider.almacen_phone, warehouseMsg).catch(() => {})
          }

          return { 
            success: true, 
            message: `✅ *PAGO VERIFICADO - CÓDIGO ACEPTADO* 💰\n\nHe validado tu código de operación *#${cleanCode}* con éxito en nuestro sistema bancario.\n\nTu pedido *#${order.payment_reference_code || order.id.slice(0,8)}* ha sido confirmado oficialmente y pasó al área de empaquetado. 🚀✨`, 
            orderId: order.id 
          }
        } else {
           // Gmail encontró el código pero los montos no cuadran
           return { success: false, message: `🔍 He encontrado tu código de operación *#${cleanCode}*, pero el monto transferido no coincide exactamente con el total de tu pedido (*S/ ${order.total.toFixed(2)}*).\n\nUn agente humano revisará esto en unos minutos. ⏳` }
        }
      } else {
        return { success: false, message: `⚠️ *CÓDIGO NO ENCONTRADO*\n\nHe buscado el código de operación *#${cleanCode}* en el sistema del banco pero aún no aparece. A veces la notificación bancaria tarda unos minutos en llegar.\n\nPor favor, verifica que el código sea correcto, o si prefieres, envíame la *FOTO/CAPTURA DE PANTALLA* de tu comprobante para validarlo por IA. ⏳` }
      }

    } catch (error: any) {
      logger.error("Error en Verificación por Código de Texto:", { error: error.message })
      return { success: false, message: "Error procesando el código de pago." }
    }
  }
}

export const paymentVerificationService = new PaymentVerificationService()
