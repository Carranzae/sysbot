import { Controller, Post, Get, Body, Param, Query, UseGuards, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentValidationService, PaymentValidationRequest } from './payment-validation.service';

@Controller('payments/validation')
@UseGuards(JwtAuthGuard)
export class PaymentValidationController {
  private readonly logger = new Logger(PaymentValidationController.name);

  constructor(private readonly paymentValidationService: PaymentValidationService) {}

  @Post()
  async validatePayment(@Body() request: PaymentValidationRequest) {
    try {
      this.logger.log(`[PaymentValidation] Validating payment: ${request.paymentId}`);
      
      const result = await this.paymentValidationService.validateAndSyncPayment(request);
      
      return {
        success: true,
        result,
        message: result.success ? 'Payment validated successfully' : 'Payment validation failed'
      };
    } catch (error) {
      this.logger.error('[PaymentValidation] Error validating payment:', error.message);
      throw new HttpException(
        error.message || 'Failed to validate payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('process-pending')
  async processPendingPayments(@Body() body: { businessId?: string }) {
    try {
      this.logger.log(`[PaymentValidation] Processing pending payments${body.businessId ? ` for business ${body.businessId}` : ''}`);
      
      const result = await this.paymentValidationService.processPendingPayments(body.businessId);
      
      return {
        success: true,
        result,
        message: `Processed ${result.processed} payments, ${result.errors} errors`
      };
    } catch (error) {
      this.logger.error('[PaymentValidation] Error processing pending payments:', error.message);
      throw new HttpException(
        error.message || 'Failed to process pending payments',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats/:businessId')
  async getValidationStats(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      this.logger.log(`[PaymentValidation] Getting validation stats for business ${businessId}`);
      
      const stats = await this.paymentValidationService.getValidationStats(
        businessId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      this.logger.error('[PaymentValidation] Error getting validation stats:', error.message);
      throw new HttpException(
        error.message || 'Failed to get validation stats',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  async getValidationStatus() {
    return {
      success: true,
      message: 'Payment Validation Service is running',
      timestamp: new Date().toISOString(),
      endpoints: [
        'POST /payments/validation - Validate and sync a payment',
        'POST /payments/validation/process-pending - Process pending payments',
        'GET /payments/validation/stats/:businessId - Get validation statistics'
      ]
    };
  }
}
