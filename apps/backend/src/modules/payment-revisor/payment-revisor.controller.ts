import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PaymentRevisorService } from './payment-revisor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment-revisor')
@UseGuards(JwtAuthGuard)
export class PaymentRevisorController {
  constructor(private readonly revisorService: PaymentRevisorService) {}

  /**
   * Obtiene la lista de todos los recibos y facturas generadas por el revisor de pagos.
   */
  @Get('receipts')
  async getReceipts(@Request() req) {
    const businessId = req.user.businessId;
    return this.revisorService.getReceipts(businessId);
  }

  /**
   * Simula la carga de un comprobante de pago enviando los metadatos de archivo de la captura de pantalla.
   */
  @Post('verify')
  async verifyReceipt(
    @Request() req,
    @Body()
    body: {
      phone: string;
      fileUrl: string;
      fileId: string;
      expectedAmount?: number;
    },
  ) {
    const businessId = req.user.businessId;
    return this.revisorService.processReceiptOCR(
      businessId,
      body.phone,
      body.fileUrl,
      body.fileId,
      body.expectedAmount,
    );
  }
}
