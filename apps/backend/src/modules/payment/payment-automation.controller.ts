import { Controller, Post, Get, Body, Param, Query, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentAutomationService, CreatePaymentDto } from './payment-automation.service';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@syst/database';

@Controller('payments/automation')
@UseGuards(JwtAuthGuard)
export class PaymentAutomationController {
  private readonly logger = new Logger(PaymentAutomationController.name);

  constructor(
    private paymentAutomationService: PaymentAutomationService,
    private prisma: PrismaService
  ) {}

  @Post()
  async createPayment(@Body() dto: CreatePaymentDto) {
    try {
      this.logger.log(`[PaymentAutomation] Creating payment for business ${dto.businessId}`);
      
      const payment = await this.paymentAutomationService.createPayment(dto);
      
      return {
        success: true,
        payment,
        message: 'Payment created successfully'
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error creating payment:', error.message);
      throw new HttpException(
        error.message || 'Failed to create payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('verify/:paymentId')
  async verifyPayment(@Param('paymentId') paymentId: string) {
    try {
      this.logger.log(`[PaymentAutomation] Verifying payment: ${paymentId}`);
      
      const result = await this.paymentAutomationService.verifyPayment(paymentId);
      
      return {
        success: true,
        result,
        message: 'Payment verified successfully'
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error verifying payment:', error.message);
      throw new HttpException(
        error.message || 'Failed to verify payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('business/:businessId/pending')
  async getPendingPayments(
    @Param('businessId') businessId: string,
    @Query('limit') limit?: number
  ) {
    try {
      this.logger.log(`[PaymentAutomation] Getting pending payments for business ${businessId}`);
      
      const payments = await this.paymentAutomationService.getPendingPayments(
        businessId,
        limit ? parseInt(limit.toString()) : 50
      );
      
      return {
        success: true,
        payments,
        count: payments.length
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error getting pending payments:', error.message);
      throw new HttpException(
        error.message || 'Failed to get pending payments',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('business/:businessId/stats')
  async getPaymentStats(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      this.logger.log(`[PaymentAutomation] Getting payment stats for business ${businessId}`);
      
      const stats = await this.paymentAutomationService.getPaymentStats(
        businessId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error getting payment stats:', error.message);
      throw new HttpException(
        error.message || 'Failed to get payment stats',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('cancel-expired')
  async cancelExpiredPayments() {
    try {
      this.logger.log('[PaymentAutomation] Cancelling expired payments');
      
      const cancelledCount = await this.paymentAutomationService.cancelExpiredPayments();
      
      return {
        success: true,
        cancelledCount,
        message: `Cancelled ${cancelledCount} expired payments`
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error cancelling expired payments:', error.message);
      throw new HttpException(
        error.message || 'Failed to cancel expired payments',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('business/:businessId/details')
  async getBusinessPaymentDetails(@Param('businessId') businessId: string) {
    try {
      this.logger.log(`[PaymentAutomation] Getting payment details for business ${businessId}`);
      
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          paymentGateway: true,
          stripeAccountId: true,
          izipayMerchantId: true,
        }
      });

      if (!business) {
        throw new HttpException('Business not found', HttpStatus.NOT_FOUND);
      }

      const pendingPaymentsCount = await this.prisma.automatedPayment.count({
        where: {
          businessId,
          status: 'PENDING',
        },
      });

      return {
        success: true,
        business: {
          ...business,
          pendingPaymentsCount,
        }
      };
    } catch (error) {
      this.logger.error('[PaymentAutomation] Error getting business payment details:', error.message);
      throw new HttpException(
        error.message || 'Failed to get business payment details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
