import { db } from '../database/db'
import { emailService } from './email.service'
import { config } from '../config/env'
import { createGmailClient, ensureLabelId, extractPlainTextFromMessage } from './gmail.service'
import { logger } from '../api/utils/logger'

export type GmailScanResult = {
  scanned: number
  matched: number
  paid: number
  mismatched: number
  unknown: number
  errors: number
}

const REFERENCE_RE = /PED-[A-Z0-9]+-[A-Z0-9]+/g
const AMOUNT_RE = /(S\/\s*|S\.\s*|PEN\s*|SOLES\s*)([0-9]+(?:\.[0-9]{1,2})?)/i
const TRANSACTION_ID_RE = /(?:operaci[oó]n|transacci[oó]n|rastreo)[\s#:]*([0-9A-Z]{6,12})/i
const PHONE_RE = /(?:9[0-9]{8})/g

function parseReference(text: string): string {
  const match = (text || '').toUpperCase().match(REFERENCE_RE)
  return match?.[0] || ''
}

function parseAmount(text: string): number | null {
  const m = (text || '').match(AMOUNT_RE)
  if (!m) return null
  const value = Number(String(m[2]).replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function parseTransactionId(text: string): string {
  const match = (text || '').match(TRANSACTION_ID_RE)
  return match?.[1] || ''
}

function parsePhones(text: string): string[] {
  return (text || '').match(PHONE_RE) || []
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01
}

export async function scanGmailPayments(options?: {
  userId?: string,
  providerId?: string, // Id del dueño de los pedidos
  labelName?: string,
  query?: string,
  accessToken?: string,
  refreshToken?: string
}): Promise<GmailScanResult> {
  const userId = options?.userId || config.gmail.user || 'me'
  const providerId = options?.providerId
  const labelName = options?.labelName || config.gmail.processedLabel || 'APP_NEGOCIO_PROCESSED'
  const query = options?.query || config.gmail.query || 'is:unread'

  if (!providerId) {
    logger.error('[GMAIL-SCAN] Error: providerId es obligatorio para el escaneo multi-tenant.')
    throw new Error('providerId is required')
  }

  const gmail = createGmailClient(options)
  const processedLabelId = await ensureLabelId(gmail, userId, labelName)

  const result: GmailScanResult = {
    scanned: 0,
    matched: 0,
    paid: 0,
    mismatched: 0,
    unknown: 0,
    errors: 0,
  }

  const list = await gmail.users.messages.list({
    userId,
    q: query,
    maxResults: 25,
  })

  const messages = list.data.messages || []
  if (messages.length === 0) return result

  for (const m of messages) {
    result.scanned += 1

    try {
      const msg = await gmail.users.messages.get({ userId, id: m.id!, format: 'full' })
      const text = extractPlainTextFromMessage(msg.data)

      const reference = parseReference(text)
      const amount = parseAmount(text)
      const transactionId = parseTransactionId(text)

      logger.info(`[GMAIL-SCAN] 📧 Analizando mensaje... Ref: ${reference || 'N/A'}, ID: ${transactionId || 'N/A'}, Monto: ${amount || 'N/A'}`)

      if (!reference && !transactionId) {
        result.unknown += 1
        await gmail.users.messages.modify({
          userId,
          id: m.id!,
          requestBody: { removeLabelIds: ['UNREAD'], addLabelIds: [processedLabelId] },
        })
        continue
      }

      // Buscar pedido por Referencia Interna (PED-XXX) o por ID de Transacción (Yape/Plin extraído por la IA previamente)
      let orderRows: any[] = []
      
      if (reference) {
        const res = await db.query(
          `SELECT * FROM orders WHERE payment_reference_code = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [reference, providerId]
        )
        orderRows = res.rows
      }
      
      if (orderRows.length === 0 && transactionId) {
        const res = await db.query(
          `SELECT * FROM orders WHERE payment_details->>'transaction_id' = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [transactionId, providerId]
        )
        orderRows = res.rows
      }

      // --- TERCER NIVEL: Coincidencia por Monto + Teléfono (Si no hay ID/Ref) ---
      if (orderRows.length === 0 && amount) {
        const detectedPhones = parsePhones(text)
        if (detectedPhones.length > 0) {
          // Buscar pedidos con este monto y alguno de los teléfonos detectados
          const res = await db.query(
            `SELECT * FROM orders 
             WHERE (ABS(total - $1) < 0.01 OR ABS(COALESCE((payment_details->>'expected_payment_amount')::numeric, total) - $1) < 0.01)
             AND payment_status = 'pending'
             AND user_id = $2
             AND (${detectedPhones.map((_, i) => `customer_phone LIKE $${i + 3}`).join(' OR ')})
             ORDER BY created_at DESC LIMIT 1`,
            [amount, providerId, ...detectedPhones.map(p => `%${p}%`)]
          )
          orderRows = res.rows
        }
      }

      const order = orderRows[0]

      if (!order) {
        result.unknown += 1
        await gmail.users.messages.modify({
          userId,
          id: m.id!,
          requestBody: { removeLabelIds: ['UNREAD'], addLabelIds: [processedLabelId] },
        })
        continue
      }

      result.matched += 1

      // Obtener el monto esperado a pagar (completo, adelanto de importación, o el negociado)
      const expectedAmount = order.payment_details?.expected_payment_amount 
        ? parseFloat(order.payment_details.expected_payment_amount) 
        : parseFloat(order.total)

      if (typeof amount === 'number' && amountsMatch(expectedAmount, amount)) {
        if (order.payment_status !== 'paid') {
          await db.query(
            `UPDATE orders
             SET payment_status = 'paid',
                 status = 'preparando',
                 updated_at = NOW()
             WHERE id = $1`,
            [order.id]
          )
        }

        result.paid += 1

        if (order.customer_email) {
          await emailService.sendEmail({
            to: order.customer_email,
            subject: `Pago confirmado - Pedido ${reference}`,
            html: `
              <h2>¡Pago confirmado!</h2>
              <p>Tu pago fue verificado automáticamente.</p>
              <p><strong>Pedido:</strong> ${reference}</p>
              <p><strong>Total de abono recibido:</strong> S/ ${amount.toFixed(2)}</p>
              <p><strong>Monto total del pedido:</strong> S/ ${Number(order.total).toFixed(2)}</p>
              <p>Puedes ver el estado en: <a href="${config.server.frontendUrl}/track-order?code=${encodeURIComponent(reference)}">Rastrear pedido</a></p>
            `,
          })
        }
      } else {
        await db.query(
          `UPDATE orders
           SET payment_status = 'failed',
               updated_at = NOW()
           WHERE id = $1`,
          [order.id]
        )

        result.mismatched += 1

        if (order.customer_email) {
          await emailService.sendEmail({
            to: order.customer_email,
            subject: `Pago en revisión - Pedido ${reference}`,
            html: `
              <h2>Pago en revisión</h2>
              <p>Detectamos un pago con referencia <strong>${reference}</strong> pero los datos no coinciden.</p>
              <p><strong>Total del pedido:</strong> S/ ${Number(order.total).toFixed(2)}</p>
              <p><strong>Monto detectado:</strong> ${amount == null ? 'No detectado' : 'S/ ' + amount.toFixed(2)}</p>
              <p>Si ya pagaste, por favor envía tu comprobante por WhatsApp desde la página de seguimiento.</p>
              <p><a href="${config.server.frontendUrl}/track-order?code=${encodeURIComponent(reference)}">Ver seguimiento</a></p>
            `,
          })
        }
      }

      await gmail.users.messages.modify({
        userId,
        id: m.id!,
        requestBody: { removeLabelIds: ['UNREAD'], addLabelIds: [processedLabelId] },
      })
    } catch {
      result.errors += 1
    }
  }

  return result
}
