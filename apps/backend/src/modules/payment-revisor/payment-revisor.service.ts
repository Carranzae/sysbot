import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PaymentRevisorService {
  private readonly logger = new Logger(PaymentRevisorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesa la carga de una captura de pantalla de pago y realiza la lectura de OCR.
   */
  async processReceiptOCR(
    businessId: string,
    phone: string,
    fileUrl: string,
    fileId: string,
    expectedAmount?: number,
  ): Promise<any> {
    this.logger.log(`[Payment Revisor] Analizando comprobante de pago del cliente ${phone}`);

    // Simulación del motor OCR integrado (Tesseract/Google Vision)
    // En producción, aquí se llamaría a la API OCR con el archivo cargado.
    const randomAmount = expectedAmount || 150.00;
    const randomOpCode = `OP-${Math.floor(100000 + Math.random() * 900000)}`;

    const simulatedOcrData = {
      amount: randomAmount,
      securityCode: randomOpCode,
      paymentDate: new Date(),
      detectedBank: 'BCP / YAPE',
      rawText: `YAPE COMPROBANTE EXITOSO. Monto: S/ ${randomAmount}. Operación: ${randomOpCode}. Fecha: 2026-06-01.`,
    };

    // Crear el registro de comprobante pendiente
    const receipt = await this.prisma.paymentReceipt.create({
      data: {
        businessId,
        customerPhone: phone,
        amount: simulatedOcrData.amount,
        expectedAmount: expectedAmount || null,
        securityCode: simulatedOcrData.securityCode,
        paymentMethod: 'YAPE',
        status: 'PENDING',
        ocrData: simulatedOcrData,
        receiptFileId: fileId,
      },
    });

    // Validar cruzando información contra pasarelas en segundo plano
    const verifiedReceipt = await this.crossVerifyWithGateways(receipt.id, simulatedOcrData.securityCode, simulatedOcrData.amount);

    return verifiedReceipt;
  }

  /**
   * Simula o realiza la verificación cruzada con las APIs de pasarelas (Stripe, MercadoPago, Culqi, Izipay)
   */
  async crossVerifyWithGateways(receiptId: string, opCode: string, amount: number): Promise<any> {
    this.logger.log(`[Payment Revisor] Cruzando información de transacción '${opCode}' con pasarelas de pago...`);

    // Simulando chequeo de coincidencia en pasarela
    const matchFound = true; 

    if (matchFound) {
      const receipt = await this.prisma.paymentReceipt.update({
        where: { id: receiptId },
        data: {
          status: 'APPROVED',
          verifiedAt: new Date(),
          verifiedBy: 'AI_SWARM_REVISOR',
        },
      });

      // Generar automáticamente la factura correspondiente
      await this.generateAutoInvoice(receipt.businessId, receiptId, amount);

      this.logger.log(`[Payment Revisor] Pago aprobado y Factura generada para el comprobante ${receiptId}`);
      return receipt;
    } else {
      return this.prisma.paymentReceipt.update({
        where: { id: receiptId },
        data: {
          status: 'REJECTED',
        },
      });
    }
  }

  /**
   * Generación automática de comprobante PDF y envío de correos
   */
  private async generateAutoInvoice(businessId: string, receiptId: string, amount: number): Promise<any> {
    // Buscar la factura si ya existe o crear una nueva vinculada
    return this.prisma.invoice.create({
      data: {
        businessId,
        paymentReceiptId: receiptId,
        invoiceNumber: `FAC-${Date.now().toString().slice(-8)}`,
        status: 'PAID',
        amount,
        tax: amount * 0.18, 
        pdfUrl: `https://storage.googleapis.com/sysbot-invoices/invoice_${receiptId}.pdf`,
        dueDate: new Date(),
      },
    });
  }

  /**
   * Obtiene todos los recibos cargados en el sistema por negocio.
   */
  async getReceipts(businessId: string): Promise<any[]> {
    return this.prisma.paymentReceipt.findMany({
      where: { businessId },
      include: {
        receiptFile: true,
        invoices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
