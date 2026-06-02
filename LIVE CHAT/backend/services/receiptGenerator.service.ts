import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { logger } from '../api/utils/logger'

export interface ReceiptData {
  orderId: string
  customerName: string
  customerPhone: string
  items: { name: string; quantity: number; price: number }[]
  total: number
  date: Date
  storeName: string
  paymentMethod: string
  isPaid?: boolean
  shippingAddress?: string
}

export class ReceiptGeneratorService {
  /**
   * Genera una Boleta de Venta o una Orden de Pedido Pendiente
   */
  async generateReceiptPDF(data: ReceiptData): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margin: 30, 
          size: 'A6',
          info: { Title: `Recibo-${data.orderId}`, Author: 'Atines Platform' }
        })
        const prefix = data.isPaid ? 'BOLETA' : 'ORDEN'
        const fileName = `${prefix}-${data.orderId.substring(0, 8)}.pdf`
        const tempDir = path.join(process.cwd(), 'uploads', 'receipts')
        const filePath = path.join(tempDir, fileName)
        const logoPath = path.join(process.cwd(), 'uploads', 'imagenes', 'atines.png')

        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const stream = fs.createWriteStream(filePath)
        doc.pipe(stream)

        // --- DISEÑO CORPORATIVO PROFESIONAL ---
        const primaryColor = '#1e293b' // Slate 800
        const accentColor = '#4f46e5'  // Indigo 600

        // 1. Cabecera Sólida con Logo
        doc.rect(0, 0, doc.page.width, 70).fill(primaryColor)
        
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, (doc.page.width - 50) / 2, 10, { width: 50 })
          doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(data.storeName.toUpperCase(), 0, 52, { align: 'center', width: doc.page.width })
        } else {
          doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text(data.storeName.toUpperCase(), 0, 25, { align: 'center', width: doc.page.width })
          doc.fontSize(7).font('Helvetica').text('COMPROBANTE DE GESTIÓN INTERNA', 0, 45, { align: 'center', width: doc.page.width })
        }

        // 2. Info Pedido
        let y = 85
        const docTitle = data.isPaid ? `BOLETA DE VENTA` : `ORDEN DE PEDIDO (Pendiente)`
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(`${docTitle}: #${data.orderId.substring(0, 8)}`, 30, y)
        doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(`Fecha: ${data.date.toLocaleString('es-PE')}`, 30, y + 12)

        // 3. Cliente
        y = 115
        const boxHeight = data.shippingAddress ? 50 : 40
        doc.rect(30, y, doc.page.width - 60, boxHeight).stroke('#e2e8f0')
        doc.fillColor(primaryColor).fontSize(7).font('Helvetica-Bold').text('DATOS DEL CLIENTE', 38, y + 8)
        doc.font('Helvetica').text(`Nombre: ${data.customerName}`, 38, y + 17)
        doc.text(`WhatsApp: ${data.customerPhone}`, 38, y + 26)
        if (data.shippingAddress) {
          doc.text(`Envío: ${data.shippingAddress.substring(0, 45)}`, 38, y + 35)
        }

        // 4. Tabla de Items
        y = 115 + boxHeight + 15
        doc.fillColor(primaryColor).fontSize(7).font('Helvetica-Bold')
        doc.text('CANT', 30, y)
        doc.text('DESCRIPCIÓN', 60, y)
        doc.text('TOTAL', doc.page.width - 75, y, { align: 'right', width: 45 })
        
        y += 10
        doc.moveTo(30, y).lineTo(doc.page.width - 30, y).stroke('#cbd5e1')
        y += 8

        doc.font('Helvetica').fillColor('#334155')
        data.items.forEach(item => {
          doc.text(item.quantity.toString(), 30, y)
          doc.text(item.name.substring(0, 30), 60, y)
          doc.text(`S/ ${(item.quantity * item.price).toFixed(2)}`, doc.page.width - 75, y, { align: 'right', width: 45 })
          y += 14
        })

        // 5. Totalizador
        y += 10
        doc.rect(doc.page.width - 120, y, 90, 22).fill(primaryColor)
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
        doc.text(`TOTAL: S/ ${data.total.toFixed(2)}`, doc.page.width - 115, y + 7, { align: 'center', width: 80 })

        // 6. Footer
        y = doc.page.height - 60
        doc.moveTo(30, y).lineTo(doc.page.width - 30, y).stroke('#e2e8f0')
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
        doc.text('Validado por el sistema de seguridad Atines.', 0, y + 10, { align: 'center', width: doc.page.width })
        doc.fillColor(accentColor).font('Helvetica-Bold').text('¡GRACIAS POR TU COMPRA!', 0, y + 22, { align: 'center', width: doc.page.width })

        doc.end()
        stream.on('finish', () => resolve(filePath))
        stream.on('error', reject)

      } catch (error: any) {
        logger.error('Error generando Boleta PDF:', { error: error.message })
        reject(error)
      }
    })
  }
}

export const receiptGeneratorService = new ReceiptGeneratorService()
