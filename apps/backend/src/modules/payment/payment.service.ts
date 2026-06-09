import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OCRService } from '../ocr/ocr.service';
import { EmailPaymentService } from '../email-payment/email-payment.service';
import { PaymentMethod, PaymentReceiptStatus } from '@prisma/client';
import { join } from 'path';
import * as fs from 'fs';

export interface ProcessReceiptDto {
  businessId: string;
  customerPhone: string;
  customerName?: string;
  receiptFileId: string;
  appointmentId?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private ocrService: OCRService,
    private emailPaymentService: EmailPaymentService,
  ) {}

  /**
   * Procesa un comprobante de pago
   */
  async processReceipt(dto: ProcessReceiptDto) {
    try {
      this.logger.log(`[Payment] Procesando comprobante para cliente: ${dto.customerPhone}`);

      // Obtener el archivo
      const file = await this.prisma.file.findUnique({
        where: { id: dto.receiptFileId },
      });

      if (!file) {
        throw new Error('Archivo no encontrado');
      }

      // Obtener ruta del archivo
      const filePath = file.url.startsWith('http') ? file.url : join(process.cwd(), 'uploads', file.filename);

      // Procesar con OCR
      this.logger.log(`[Payment] Extrayendo información del comprobante con OCR...`);
      const ocrResult = await this.ocrService.processReceipt(filePath);

      // Obtener monto esperado (de la cita si existe)
      let expectedAmount: number | null = null;
      if (dto.appointmentId) {
        const appointment = await this.prisma.appointment.findUnique({
          where: { id: dto.appointmentId },
          select: { price: true },
        });
        if (appointment?.price) {
          expectedAmount = Number(appointment.price);
        }
      }

      // Determinar método de pago basado en el texto
      const paymentMethod = this.detectPaymentMethod(ocrResult.text);

      // Crear registro de comprobante
      const receipt = await this.prisma.paymentReceipt.create({
        data: {
          businessId: dto.businessId,
          customerPhone: dto.customerPhone,
          customerName: dto.customerName,
          amount: ocrResult.amount || 0,
          expectedAmount: expectedAmount,
          securityCode: ocrResult.securityCode || null,
          paymentMethod: paymentMethod,
          receiptFileId: dto.receiptFileId,
          appointmentId: dto.appointmentId || null,
          status: PaymentReceiptStatus.PENDING,
          ocrData: {
            text: ocrResult.text,
            date: ocrResult.date?.toISOString(),
            operationNumber: ocrResult.operationNumber,
            confidence: ocrResult.confidence,
          },
        },
        include: {
          receiptFile: true,
          appointment: true,
        },
      });

      this.logger.log(`[Payment] Comprobante creado: ${receipt.id}, monto: ${receipt.amount}`);

      // Verificar monto
      const amountMatch = this.verifyAmount(Number(receipt.amount), expectedAmount);

      if (amountMatch) {
        this.logger.log(`[Payment] ✅ Monto verificado correctamente`);

        // Si es Yape/Plin, necesitamos código de seguridad
        if (paymentMethod === PaymentMethod.YAPE || paymentMethod === PaymentMethod.PLIN) {
          if (!receipt.securityCode) {
            // No se encontró código en OCR, necesitamos pedirlo
            return {
              receipt,
              needsSecurityCode: true,
              message: 'Por favor, envía el código de seguridad de tu comprobante para verificación final',
            };
          } else {
            // Ya tenemos código, verificar en correo
            return await this.verifySecurityCode(receipt.id);
          }
        } else {
          // Otros métodos de pago, aprobar directamente
          return await this.approvePayment(receipt.id);
        }
      } else {
        this.logger.warn(`[Payment] ⚠️ Monto no coincide. Esperado: ${expectedAmount}, Recibido: ${Number(receipt.amount)}`);
        return {
          receipt,
          needsSecurityCode: false,
          needsManualReview: true,
          message: 'El monto del comprobante no coincide con el esperado. Se requiere revisión manual.',
        };
      }
    } catch (error) {
      this.logger.error(`[Payment] Error al procesar comprobante: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verifica el código de seguridad en el correo
   */
  async verifySecurityCode(receiptId: string) {
    try {
      this.logger.log(`[Payment] Verificando código de seguridad para comprobante: ${receiptId}`);

      const receipt = await this.prisma.paymentReceipt.findUnique({
        where: { id: receiptId },
        include: {
          business: {
            select: {
              botConfig: {
                select: {
                  paymentEmail: true,
                  paymentEmailPassword: true,
                  paymentEmailProvider: true,
                },
              },
            },
          },
        },
      });

      if (!receipt) {
        throw new Error('Comprobante no encontrado');
      }

      if (!receipt.securityCode) {
        throw new Error('No hay código de seguridad para verificar');
      }

      const config = receipt.business.botConfig;
      if (!config?.paymentEmail || !config?.paymentEmailPassword) {
        throw new Error('No hay configuración de correo para verificación de pagos');
      }

      // Verificar código en correo
      const verified = await this.emailPaymentService.verifyPaymentCode(
        config.paymentEmail,
        config.paymentEmailPassword,
        (config.paymentEmailProvider as 'GMAIL' | 'OUTLOOK' | 'OTHER') || 'GMAIL',
        receipt.securityCode,
        Number(receipt.amount),
        receipt.customerName || undefined,
      );

      if (verified) {
        this.logger.log(`[Payment] ✅ Código verificado en correo`);
        await this.prisma.paymentReceipt.update({
          where: { id: receiptId },
          data: {
            emailVerified: true,
          },
        });
        return await this.approvePayment(receiptId);
      } else {
        this.logger.warn(`[Payment] ⚠️ Código no verificado en correo`);
        return {
          receipt,
          needsSecurityCode: false,
          needsManualReview: true,
          message: 'El código de seguridad no se pudo verificar automáticamente. Se requiere revisión manual.',
        };
      }
    } catch (error) {
      this.logger.error(`[Payment] Error al verificar código: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Aprueba un pago
   */
  async approvePayment(receiptId: string, verifiedBy?: string) {
    try {
      this.logger.log(`[Payment] Aprobando pago: ${receiptId}`);

      const receipt = await this.prisma.paymentReceipt.update({
        where: { id: receiptId },
        data: {
          status: PaymentReceiptStatus.VERIFIED,
          verifiedAt: new Date(),
          verifiedBy: verifiedBy || null,
        },
        include: {
          business: {
            select: {
              name: true,
            },
          },
          appointment: true,
        },
      });

      this.logger.log(`[Payment] ✅ Pago aprobado: ${receiptId}`);

        return {
          receipt,
          needsSecurityCode: false,
          message: `✅ Tu pago fue realizado con éxito. Muchas gracias por elegir ${receipt.business.name}.`,
        };
    } catch (error) {
      this.logger.error(`[Payment] Error al aprobar pago: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Rechaza un pago
   */
  async rejectPayment(receiptId: string, reason?: string) {
    try {
      const receipt = await this.prisma.paymentReceipt.update({
        where: { id: receiptId },
        data: {
          status: PaymentReceiptStatus.REJECTED,
        },
      });

      this.logger.log(`[Payment] ❌ Pago rechazado: ${receiptId}`);
      return receipt;
    } catch (error) {
      this.logger.error(`[Payment] Error al rechazar pago: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica si el monto coincide
   */
  private verifyAmount(amount: number, expectedAmount: number | null): boolean {
    if (!expectedAmount) {
      // Si no hay monto esperado, aceptar cualquier monto positivo
      return amount > 0;
    }

    // Permitir diferencia de hasta 1 sol (por redondeos)
    const difference = Math.abs(amount - expectedAmount);
    return difference <= 1.0;
  }

  /**
   * Detecta el método de pago basado en el texto
   */
  private detectPaymentMethod(text: string): PaymentMethod {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('yape')) {
      return PaymentMethod.YAPE;
    }
    if (lowerText.includes('plin')) {
      return PaymentMethod.PLIN;
    }
    if (lowerText.includes('transferencia') || lowerText.includes('transfer')) {
      return PaymentMethod.TRANSFER;
    }
    if (lowerText.includes('efectivo') || lowerText.includes('cash')) {
      return PaymentMethod.CASH;
    }

    return PaymentMethod.OTHER;
  }

  /**
   * Obtiene comprobantes pendientes de un negocio
   */
  async getPendingReceipts(businessId: string) {
    try {
      const receipts = await this.prisma.paymentReceipt.findMany({
        where: {
          businessId,
          status: PaymentReceiptStatus.PENDING,
        },
        include: {
          receiptFile: true,
          appointment: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return receipts;
    } catch (error) {
      this.logger.error(`[Payment] Error al obtener comprobantes pendientes: ${error.message}`);
      throw error;
    }
  }

  async verifyBusinessAccess(userId: string, businessId: string): Promise<boolean> {
    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: userId,
      },
      select: { id: true },
    });

    return Boolean(business);
  }

  async getInvoices(businessId: string, options: { page?: number; limit?: number; status?: string } = {}) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { businessId },
        include: { invoiceFile: true, paymentReceipt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where: { businessId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getReceipts(businessId: string, options: { page?: number; limit?: number; status?: string } = {}) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
    const where: any = { businessId };
    if (options.status) where.status = options.status;

    const [items, total] = await Promise.all([
      this.prisma.paymentReceipt.findMany({
        where,
        include: { receiptFile: true, appointment: true, invoices: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentReceipt.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createPaymentIntent(dto: any) {
    return {
      status: 'PENDING_GATEWAY_CONFIGURATION',
      amount: dto.amount,
      currency: dto.currency || 'PEN',
      businessId: dto.businessId,
    };
  }

  async getInvoiceById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: { invoiceFile: true, paymentReceipt: true },
    });
  }

  async getReceiptById(id: string) {
    return this.prisma.paymentReceipt.findUnique({
      where: { id },
      include: { receiptFile: true, appointment: true, invoices: true },
    });
  }

  async sendInvoice(id: string) {
    return {
      id,
      sent: false,
      status: 'PENDING_EMAIL_INTEGRATION',
    };
  }

  async getPaymentStats(businessId: string) {
    const [receipts, invoices] = await Promise.all([
      this.prisma.paymentReceipt.count({ where: { businessId } }),
      this.prisma.invoice.count({ where: { businessId } }),
    ]);

    return { receipts, invoices };
  }

  async handleStripeWebhook(payload: any, signature?: string) {
    return { received: true, provider: 'STRIPE', eventType: payload?.type, signaturePresent: Boolean(signature) };
  }

  async getPaymentMethods(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { paymentGateway: true },
    });

    return {
      gateway: business?.paymentGateway || 'NONE',
      methods: ['YAPE', 'PLIN', 'TRANSFER', 'CASH', 'CARD'],
    };
  }

  async validatePayment(businessId: string, data: any) {
    return {
      businessId,
      valid: false,
      status: 'PENDING_VALIDATION_INTEGRATION',
      data,
    };
  }

  async exportPaymentData(businessId: string, options: any = {}) {
    const [receipts, invoices] = await Promise.all([
      this.prisma.paymentReceipt.findMany({ where: { businessId } }),
      this.prisma.invoice.findMany({ where: { businessId } }),
    ]);

    return { businessId, options, receipts, invoices };
  }
}
