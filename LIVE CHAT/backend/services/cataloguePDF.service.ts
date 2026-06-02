import PDFDocument from 'pdfkit'
import axios from 'axios'
import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'

export class CataloguePDFService {
  /**
   * Descarga una imagen y la devuelve como Buffer listo para PDFKit.
   * CRÍTICO: PDFKit necesita un Buffer de Node.js, no un ArrayBuffer crudo.
   * Retorna null si falla o si la URL no apunta a una imagen.
   */
  private async downloadImage(url: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AtinesCatalogueBot/1.0)',
        }
      })

      const contentType: string = String(response.headers['content-type'] || '')
      if (!contentType.startsWith('image/')) {
        logger.warn(`URL no es imagen válida (content-type: ${contentType}): ${url}`)
        return null
      }

      const buf = Buffer.from(response.data)
      logger.info(`✅ Imagen descargada: ${url.substring(0, 60)}... (${buf.length} bytes)`)
      return buf
    } catch (err: any) {
      logger.warn(`⚠️ Error descargando imagen: ${url.substring(0, 60)}... → ${err.message}`)
      return null
    }
  }

  /**
   * Genera un catálogo PDF profesional de los productos del proveedor.
   * catalogType: 'national' o 'global'
   * customTitle: Título para el encabezado (ej: CATÁLOGO NACIONAL)
   */
  async generatePDF(userId: string, catalogType: 'national' | 'global' = 'national', customTitle?: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // ─── PASO 1: Obtener datos de la base de datos ─────────────────────────
        const { rows: products } = await db.query(
          'SELECT id, name, price, description, images FROM products WHERE user_id = $1 AND catalog_type = $2 AND stock > 0 ORDER BY created_at DESC LIMIT 100',
          [userId, catalogType]
        )
        const { rows: provider } = await db.query('SELECT name FROM users WHERE id = $1', [userId])
        const storeName = provider[0]?.name || 'Mi Tienda'
        const displayTitle = customTitle || (catalogType === 'global' ? 'CATÁLOGO GLOBAL' : 'CATÁLOGO NACIONAL')

        logger.info(`📄 Generando ${displayTitle} para "${storeName}" (${userId}). Productos: ${products.length}`)

        // ─── PASO 2: Pre-descargar TODAS las imágenes ──────────────────────────
        // Esto garantiza que los buffers están listos ANTES de que se abra el stream de escritura del PDF,
        // evitando el error clásico de timing donde PDFKit no puede leer datos async correctamente.
        const imageBuffers = new Map<string, Buffer | null>()
        for (const product of products) {
          const images = product.images
          const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : null
          
          if (imageUrl && typeof imageUrl === 'string') {
            if (imageUrl.startsWith('http')) {
              imageBuffers.set(product.id, await this.downloadImage(imageUrl))
            } else if (imageUrl.startsWith('data:')) {
              try {
                const parts = imageUrl.split(';base64,')
                if (parts.length === 2) {
                  imageBuffers.set(product.id, Buffer.from(parts[1], 'base64'))
                  logger.info(`✅ Imagen base64 procesada para producto ${product.id}`)
                } else {
                  imageBuffers.set(product.id, null)
                }
              } catch (e: any) {
                logger.error(`Error procesando imagen base64 para ${product.id}: ${e.message}`)
                imageBuffers.set(product.id, null)
              }
            } else {
              imageBuffers.set(product.id, null)
            }
          } else {
            imageBuffers.set(product.id, null)
          }
        }

        // ─── PASO 3: Configurar el documento PDF ───────────────────────────────
        const doc = new PDFDocument({ margin: 50, size: 'A4' })
        
        // NOMBRE PROFESIONAL DEL ARCHIVO
        const typeLabel = catalogType === 'global' ? 'GLOBAL' : 'NACIONAL'
        const cleanStoreName = storeName.replace(/[^\w\s]/gi, '').trim().toUpperCase()
        const fileName = `CATALOGO ${typeLabel} - ${cleanStoreName}.pdf`
        
        const tempDir = path.join(process.cwd(), 'uploads', 'catalogs')
        const filePath = path.join(tempDir, fileName)

        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        const stream = fs.createWriteStream(filePath)
        doc.pipe(stream)

        // ─── PASO 4: Encabezado Premium Luxury ─────────────────────────────────
        doc.rect(0, 0, doc.page.width, 150).fill('#0f172a')

        doc.fillColor('#ffffff')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text(storeName.toUpperCase(), 50, 42)

        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('#94a3b8')
           .text(displayTitle, 50, 78)

        doc.fontSize(9)
           .fillColor('#64748b')
           .text(`Generado el: ${new Date().toLocaleDateString('es-PE')}  |  ${products.length} producto(s) en stock`, 50, 100)

        // Contenedor blanco para el Código QR
        doc.roundedRect(doc.page.width - 140, 20, 100, 110, 8).fill('#ffffff')
        
        const storeSlug = storeName.toLowerCase().replace(/\s+/g, '-')
        const storeUrl = `https://atines.pe/${storeSlug}`
        try {
          const qrBuffer = await QRCode.toBuffer(storeUrl, {
            margin: 1,
            width: 80,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          })
          doc.image(qrBuffer, doc.page.width - 130, 25, { width: 80, height: 80 })
          
          doc.fillColor('#0f172a')
             .fontSize(6.5)
             .font('Helvetica-Bold')
             .text('ESCANEA PARA COMPRAR', doc.page.width - 140, 112, { align: 'center', width: 100 })
        } catch (qrErr: any) {
          logger.error('Error generando QR para catálogo:', qrErr.message)
        }

        let y = 180
        const CARD_HEIGHT = 130
        const IMG_SIZE = 100
        const IMG_X = 55
        const TEXT_X = 170

        // ─── PASO 5: Renderizar cada producto ───────────────────────────────────
        for (const product of products) {
          // Nueva página si no hay espacio
          if (y + CARD_HEIGHT > 780) {
            doc.addPage()
            y = 50
          }

          // Clean white luxury card with subtle border
          doc.roundedRect(40, y - 10, 515, CARD_HEIGHT, 12).fill('#ffffff')
          doc.roundedRect(40, y - 10, 515, CARD_HEIGHT, 12).lineWidth(1).stroke('#f1f5f9')

          // Borde izquierdo decorativo (violeta premium)
          doc.rect(40, y - 10, 5, CARD_HEIGHT).fill('#8b5cf6')

          // ── Badge de Stock / Tipo ──
          const badgeText = catalogType === 'global' ? '✈️ IMPORTACIÓN' : '⚡ STOCK LOCAL'
          const badgeColor = catalogType === 'global' ? '#3b82f6' : '#10b981'
          
          doc.roundedRect(555 - 110, y - 4, 100, 15, 7.5).fill(badgeColor)
          doc.fillColor('#ffffff')
             .fontSize(6.5)
             .font('Helvetica-Bold')
             .text(badgeText, 555 - 110, y, { align: 'center', width: 100 })

          // ── Imagen ──
          const imgBuf = imageBuffers.get(product.id)
          if (imgBuf) {
            try {
              doc.image(imgBuf, IMG_X, y, {
                width: IMG_SIZE,
                height: IMG_SIZE,
                cover: [IMG_SIZE, IMG_SIZE]
              })
            } catch (imgErr: any) {
              logger.error(`PDFKit error insertando imagen de producto ${product.id}: ${imgErr.message}`)
              doc.rect(IMG_X, y, IMG_SIZE, IMG_SIZE).lineWidth(0.5).stroke('#e2e8f0')
              doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('Sin imagen', IMG_X + 18, y + 46)
            }
          } else {
            doc.rect(IMG_X, y, IMG_SIZE, IMG_SIZE).lineWidth(0.5).stroke('#e2e8f0')
            doc.fillColor('#cbd5e1').fontSize(7).font('Helvetica').text('Sin imagen', IMG_X + 18, y + 46)
          }

          // ── Nombre ──
          doc.fillColor('#1e293b')
             .fontSize(13)
             .font('Helvetica-Bold')
             .text(product.name || 'Producto sin nombre', TEXT_X, y + 5, {
               width: 360,
               lineBreak: false,
               ellipsis: true
             })

          // ── Precio ──
          doc.fillColor('#8b5cf6')
             .fontSize(16)
             .font('Helvetica-Bold')
             .text(`S/ ${Number(product.price).toFixed(2)}`, TEXT_X, y + 24)

          // ── Descripción ──
          const desc = product.description || 'Sin descripción disponible.'
          const descShort = desc.length > 170 ? desc.substring(0, 167) + '...' : desc
          doc.fillColor('#64748b')
             .fontSize(8.5)
             .font('Helvetica')
             .text(descShort, TEXT_X, y + 46, { width: 260, lineGap: 2 })

          // ── Botón de Compra Directa Clickable ──
          const productUrl = `${storeUrl}/products/${product.id}`
          
          doc.roundedRect(445, y + 78, 100, 22, 11).fill('#8b5cf6')
          doc.fillColor('#ffffff')
             .fontSize(7.5)
             .font('Helvetica-Bold')
             .text('VER PRODUCTO', 445, y + 85, { align: 'center', width: 100 })
          
          doc.link(445, y + 78, 100, 22, productUrl)

          y += CARD_HEIGHT + 20
        }

        // ─── PASO 6: Pie de página ──────────────────────────────────────────────
        doc.fillColor('#8b5cf6')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(
             `Visítanos en: ${storeUrl}`,
             0,
             doc.page.height - 40,
             { align: 'center', width: doc.page.width }
           )

        doc.end()

        stream.on('finish', () => {
          logger.info(`✅ PDF generado: ${filePath}`)
          resolve(filePath)
        })
        stream.on('error', reject)

      } catch (error: any) {
        logger.error('Error generando catálogo PDF:', { error: (error as any).message })
        reject(error)
      }
    })
  }
}

export const cataloguePDFService = new CataloguePDFService()
