import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentService } from '../payment/payment.service';
import PDFDocument from 'pdfkit';
import { join } from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

export interface GenerateInvoiceDto {
  paymentReceiptId: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'invoices');

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {
    // Asegurar que el directorio existe
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Genera una boleta PDF
   */
  async generateInvoice(dto: GenerateInvoiceDto) {
    try {
      this.logger.log(`[Invoice] Generando boleta para comprobante: ${dto.paymentReceiptId}`);

      // Obtener información del comprobante
      const receipt = await this.prisma.paymentReceipt.findUnique({
        where: { id: dto.paymentReceiptId },
        include: {
          business: {
            select: {
              name: true,
              botConfig: {
                select: {
                  businessRUC: true,
                  businessAddress: true,
                  businessLogoFileId: true,
                  invoicePrefix: true,
                  lastInvoiceNumber: true,
                },
              },
            },
          },
          appointment: {
            select: {
              customerName: true,
              specialty: true,
              specialist: true,
              appointmentDate: true,
            },
          },
        },
      });

      if (!receipt) {
        throw new Error('Comprobante no encontrado');
      }

      if (receipt.status !== 'VERIFIED') {
        throw new Error('El comprobante debe estar verificado para generar la boleta');
      }

      // Obtener siguiente número de boleta
      const invoiceNumber = await this.getNextInvoiceNumber(receipt.businessId);

      // Generar PDF
      const pdfPath = await this.createInvoicePDF(receipt, invoiceNumber);

      // Guardar archivo en BD
      const invoiceFile = await this.prisma.file.create({
        data: {
          filename: `invoice-${invoiceNumber}.pdf`,
          originalName: `Boleta-${invoiceNumber}.pdf`,
          mimeType: 'application/pdf',
          size: fs.statSync(pdfPath).size,
          url: pdfPath,
          fileType: 'DOCUMENT',
          isProcessed: true,
          isActive: true,
          businessId: receipt.businessId,
          description: `Boleta de venta ${invoiceNumber}`,
          tags: ['invoice', 'boleta', 'factura'],
        },
      });

      // Crear registro de boleta
      const invoice = await this.prisma.invoice.create({
        data: {
          businessId: receipt.businessId,
          customerPhone: receipt.customerPhone,
          customerName: receipt.customerName || receipt.appointment?.customerName || null,
          invoiceNumber: invoiceNumber,
          amount: receipt.amount,
          appointmentId: receipt.appointmentId,
          paymentReceiptId: receipt.id,
          invoiceFileId: invoiceFile.id,
        },
        include: {
          invoiceFile: true,
          appointment: true,
        },
      });

      this.logger.log(`[Invoice] ✅ Boleta generada: ${invoiceNumber}`);

      return invoice;
    } catch (error) {
      this.logger.error(`[Invoice] Error al generar boleta: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Crea el PDF de la boleta
   */
  private async createInvoicePDF(receipt: any, invoiceNumber: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const pdfPath = join(this.uploadsDir, `invoice-${invoiceNumber}.pdf`);
        const stream = fs.createWriteStream(pdfPath);

        doc.pipe(stream);

        const business = receipt.business;
        const config = business.botConfig;
        const appointment = receipt.appointment;

        // Logo (si existe)
        if (config?.businessLogoFileId) {
          try {
            const logoFile = await this.prisma.file.findUnique({
              where: { id: config.businessLogoFileId },
            });
            if (logoFile) {
              const logoPath = logoFile.url.startsWith('http') ? logoFile.url : join(process.cwd(), 'uploads', logoFile.filename);
              if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 50, { width: 100 });
              }
            }
          } catch (error) {
            this.logger.warn(`[Invoice] No se pudo cargar el logo: ${error.message}`);
          }
        }

        // Encabezado
        doc.fontSize(20).text(business.name, 50, 50);
        if (config?.businessRUC) {
          doc.fontSize(10).text(`RUC: ${config.businessRUC}`, 50, 80);
        }
        if (config?.businessAddress) {
          doc.fontSize(10).text(config.businessAddress, 50, 95);
        }

        // Título
        doc.fontSize(16).text('BOLETA DE VENTA', 50, 150);
        doc.fontSize(12).text(`N°: ${invoiceNumber}`, 50, 175);
        doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 50, 195);

        // Línea separadora
        doc.moveTo(50, 220).lineTo(550, 220).stroke();

        // Datos del cliente
        doc.fontSize(12).text('Cliente:', 50, 240);
        doc.fontSize(10).text(receipt.customerName || appointment?.customerName || receipt.customerPhone, 120, 240);
        doc.fontSize(10).text(`Teléfono: ${receipt.customerPhone}`, 50, 260);

        // Línea separadora
        doc.moveTo(50, 290).lineTo(550, 290).stroke();

        // Detalle
        doc.fontSize(12).text('DETALLE:', 50, 310);

        let yPos = 330;
        if (appointment) {
          doc.fontSize(10).text(`Servicio: ${appointment.specialty || 'Consulta médica'}`, 50, yPos);
          yPos += 20;
          if (appointment.specialist) {
            doc.fontSize(10).text(`Especialista: ${appointment.specialist}`, 50, yPos);
            yPos += 20;
          }
          doc.fontSize(10).text(`Fecha de cita: ${new Date(appointment.appointmentDate).toLocaleDateString('es-ES')}`, 50, yPos);
          yPos += 20;
        }

        doc.fontSize(10).text(`Monto: S/ ${Number(receipt.amount).toFixed(2)}`, 50, yPos);

        // Línea separadora
        yPos += 30;
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();

        // Total
        yPos += 20;
        doc.fontSize(14).font('Helvetica-Bold').text(`Total: S/ ${Number(receipt.amount).toFixed(2)}`, 400, yPos);

        // Pie de página
        yPos = 700;
        doc.fontSize(10).font('Helvetica').text('Gracias por su compra', 50, yPos, { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve(pdfPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Obtiene el siguiente número de boleta
   */
  private async getNextInvoiceNumber(businessId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        botConfig: {
          select: {
            invoicePrefix: true,
            lastInvoiceNumber: true,
          },
        },
      },
    });

    const prefix = business?.botConfig?.invoicePrefix || 'B001-';
    const lastNumber = business?.botConfig?.lastInvoiceNumber || 0;
    const nextNumber = lastNumber + 1;

    // Actualizar último número
    await this.prisma.botConfig.update({
      where: { businessId },
      data: {
        lastInvoiceNumber: nextNumber,
      },
    });

    return `${prefix}${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Envía la boleta al cliente por WhatsApp
   */
  async sendInvoiceToCustomer(invoiceId: string) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          invoiceFile: true,
          business: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new Error('Boleta no encontrada');
      }

      return {
        invoice,
        message: `📄 Aquí está tu boleta de pago. Gracias por tu compra.`,
        fileId: invoice.invoiceFileId,
      };
    } catch (error) {
      this.logger.error(`[Invoice] Error al enviar boleta: ${error.message}`);
      throw error;
    }
  }
}

