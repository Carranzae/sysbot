/**
 * SERVICIO DE HOJA DE RUTA / TRACKING PDF
 * Genera un PDF de seguimiento del pedido con línea de tiempo visual.
 */
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { logger } from '../api/utils/logger'
import { db } from '../database/db'

export interface TrackingData {
  orderId: string
  referenceCode: string
  customerName: string
  customerPhone: string
  storeName: string
  shippingType: string          // 'national' | 'international' | 'global'
  currentStatus: string         // fulfillment_status key
  guideNumber?: string
  courierAgency?: string
  total: number
  paidAmount: number
  pendingAmount: number
  steps: Array<{ key: string; label: string; emoji: string; done: boolean }>
  date: Date
}

const STEPS_NATIONAL = [
  { key: 'pending',        label: 'Pedido Recibido',    emoji: '📋' },
  { key: 'collected',      label: 'Recolectado',        emoji: '📦' },
  { key: 'verified',       label: 'Control de Calidad', emoji: '✅' },
  { key: 'packed',         label: 'Empaquetado',        emoji: '🎁' },
  { key: 'guide_uploaded', label: 'Guía Registrada',    emoji: '🏷️' },
  { key: 'dispatched',     label: 'Despachado',         emoji: '🚚' },
]

const STEPS_INTERNATIONAL = [
  { key: 'pending',               label: 'Pedido Confirmado',       emoji: '📋' },
  { key: 'warehouse_received',    label: 'En Almacén Origen',       emoji: '🏢' },
  { key: 'origin_customs',        label: 'Aduanas Origen',          emoji: '🛂' },
  { key: 'international_transit', label: 'Tránsito Internacional',  emoji: '✈️' },
  { key: 'destination_customs',   label: 'Aduanas Perú',            emoji: '🛃' },
  { key: 'local_delivery',        label: 'En Almacén Lima',         emoji: '🇵🇪' },
  { key: 'dispatched',            label: 'Entregado',               emoji: '🏁' },
]

export class TrackingPDFService {
  /**
   * Busca los datos del pedido por teléfono del cliente y construye el PDF.
   */
  async generateForPhone(userId: string, customerPhone: string): Promise<string | null> {
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9)
    const { rows } = await db.query(
      `SELECT o.*, u.name as store_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.user_id = $1
         AND (o.customer_phone LIKE $2 OR o.customer_phone = $3)
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [userId, `%${cleanPhone}`, customerPhone]
    )
    if (!rows.length) return null

    const o = rows[0]
    const isIntl = o.shipping_type === 'international' || o.shipping_type === 'global'
    const allSteps = isIntl ? STEPS_INTERNATIONAL : STEPS_NATIONAL
    const currentOrder = allSteps.findIndex(s => s.key === o.fulfillment_status)

    const steps = allSteps.map((s, idx) => ({
      ...s,
      done: idx <= currentOrder
    }))

    return this.generatePDF({
      orderId: o.id,
      referenceCode: o.payment_reference_code || o.id.slice(0, 8).toUpperCase(),
      customerName: o.customer_name || `Cliente (${customerPhone.slice(-4)})`,
      customerPhone,
      storeName: o.store_name || 'Atines',
      shippingType: o.shipping_type || 'national',
      currentStatus: o.fulfillment_status || 'pending',
      guideNumber: o.guide_number,
      courierAgency: o.courier_agency,
      total: parseFloat(o.total) || 0,
      paidAmount: parseFloat(o.paid_amount) || 0,
      pendingAmount: parseFloat(o.pending_amount) || 0,
      steps,
      date: new Date(),
    })
  }

  async generatePDF(data: TrackingData): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 30,
          size: 'A5',
          info: { Title: `Tracking-${data.referenceCode}`, Author: 'Atines Platform' }
        })

        const fileName = `TRACKING-${data.referenceCode}.pdf`
        const tempDir = path.join(process.cwd(), 'uploads', 'receipts')
        const filePath = path.join(tempDir, fileName)
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const stream = fs.createWriteStream(filePath)
        doc.pipe(stream)

        const W = doc.page.width
        const primary   = '#1e293b'
        const accent    = '#4f46e5'
        const success   = '#16a34a'
        const pending   = '#94a3b8'
        const isIntl    = data.shippingType === 'international' || data.shippingType === 'global'

        // ── CABECERA ──────────────────────────────────────────────────────
        doc.rect(0, 0, W, 65).fill(primary)
        doc.fillColor('#fff').fontSize(16).font('Helvetica-Bold')
           .text(data.storeName.toUpperCase(), 0, 12, { align: 'center', width: W })
        doc.fontSize(8).font('Helvetica')
           .text(isIntl ? '✈️  SEGUIMIENTO DE IMPORTACIÓN' : '📦  SEGUIMIENTO DE PEDIDO NACIONAL', 0, 33, { align: 'center', width: W })
        doc.fontSize(7).text(`Generado: ${data.date.toLocaleString('es-PE')}`, 0, 48, { align: 'center', width: W })

        // ── INFO PEDIDO ───────────────────────────────────────────────────
        let y = 80
        doc.fillColor(primary).fontSize(10).font('Helvetica-Bold')
           .text(`Pedido #${data.referenceCode}`, 30, y)
        doc.fontSize(8).font('Helvetica').fillColor('#475569')
           .text(`Cliente: ${data.customerName}  |  WA: ${data.customerPhone}`, 30, y + 14)

        if (data.guideNumber) {
          doc.fillColor(accent).font('Helvetica-Bold')
             .text(`Guía ${(data.courierAgency || '').toUpperCase()}: ${data.guideNumber}`, 30, y + 26)
        }

        // ── FINANCIERO ────────────────────────────────────────────────────
        y += 48
        doc.rect(30, y, W - 60, 32).fill('#f8fafc')
        doc.fillColor(primary).fontSize(8).font('Helvetica-Bold')
           .text(`Total: S/ ${data.total.toFixed(2)}`, 40, y + 5)
        doc.fillColor(success).font('Helvetica')
           .text(`✅ Pagado: S/ ${data.paidAmount.toFixed(2)}`, 40, y + 17)
        if (data.pendingAmount > 0) {
          doc.fillColor('#dc2626').font('Helvetica-Bold')
             .text(`⚠️  Saldo: S/ ${data.pendingAmount.toFixed(2)}`, W / 2, y + 17)
        }

        // ── LÍNEA DE TIEMPO ───────────────────────────────────────────────
        y += 50
        doc.fillColor(primary).fontSize(9).font('Helvetica-Bold')
           .text('ESTADO DE TU PEDIDO', 30, y)
        y += 16

        const lineX = 45
        const stepH = 28
        const totalH = data.steps.length * stepH

        // Línea vertical de fondo
        doc.save()
        doc.rect(lineX - 1, y, 2, totalH).fill(pending)
        doc.restore()

        data.steps.forEach((step, i) => {
          const cy = y + i * stepH + 10
          const color = step.done ? success : pending

          // Círculo indicador
          doc.circle(lineX, cy, 6).fill(color)
          if (step.done && i < data.steps.length - 1) {
            doc.rect(lineX - 1, cy + 6, 2, stepH - 12).fill(success)
          }

          // Texto del hito
          doc.fillColor(step.done ? primary : pending).fontSize(8)
             .font(step.done ? 'Helvetica-Bold' : 'Helvetica')
             .text(`${step.emoji}  ${step.label}`, lineX + 14, cy - 5)

          if (step.done && step.key === data.currentStatus) {
            doc.fillColor(accent).fontSize(7).font('Helvetica')
               .text('← ESTADO ACTUAL', lineX + 130, cy - 4)
          }
        })

        // ── FOOTER ────────────────────────────────────────────────────────
        y = doc.page.height - 50
        doc.moveTo(30, y).lineTo(W - 30, y).stroke('#e2e8f0')
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
           .text('Seguimiento oficial emitido por Atines Platform • atines.pe', 0, y + 8, { align: 'center', width: W })
        doc.fillColor(accent).font('Helvetica-Bold')
           .text('¡Gracias por confiar en nosotros!', 0, y + 20, { align: 'center', width: W })

        doc.end()
        stream.on('finish', () => {
          logger.info(`[TRACKING-PDF] Generado: ${fileName}`)
          resolve(filePath)
        })
        stream.on('error', reject)

      } catch (err: any) {
        logger.error('[TRACKING-PDF] Error:', err.message)
        reject(err)
      }
    })
  }
}

export const trackingPDFService = new TrackingPDFService()
