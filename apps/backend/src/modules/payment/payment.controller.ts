import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  Logger,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { ProcessReceiptDto } from './dto/process-receipt.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('process-receipt')
  async processReceipt(
    @Body() processReceiptDto: ProcessReceiptDto,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(
        userId,
        processReceiptDto.businessId,
      );
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const processedReceipt = await this.paymentService.processReceipt(processReceiptDto);
      
      return {
        success: true,
        data: processedReceipt,
        message: 'Payment receipt processed successfully'
      };
    } catch (error) {
      this.logger.error('Error processing payment receipt:', error);
      throw error;
    }
  }

  @Get('invoices')
  async getInvoices(
    @Request() req,
    @Query('businessId') businessId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const invoices = await this.paymentService.getInvoices(businessId, {
        page,
        limit,
        status,
      });
      
      return {
        success: true,
        data: invoices,
        message: 'Invoices retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting invoices:', error);
      throw error;
    }
  }

  @Get('receipts')
  async getReceipts(
    @Request() req,
    @Query('businessId') businessId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const receipts = await this.paymentService.getReceipts(businessId, {
        page,
        limit,
        status,
      });
      
      return {
        success: true,
        data: receipts,
        message: 'Payment receipts retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting payment receipts:', error);
      throw error;
    }
  }

  @Post('create-intent')
  async createPaymentIntent(
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(
        userId,
        createPaymentIntentDto.businessId,
      );
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const paymentIntent = await this.paymentService.createPaymentIntent(createPaymentIntentDto);
      
      return {
        success: true,
        data: paymentIntent,
        message: 'Payment intent created successfully'
      };
    } catch (error) {
      this.logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  @Get('invoices/:id')
  async getInvoiceById(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const invoice = await this.paymentService.getInvoiceById(id);
      
      // Verify user has access to this invoice's business
      const hasAccess = await this.paymentService.verifyBusinessAccess(
        userId,
        invoice.businessId,
      );
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this invoice');
      }
      
      return {
        success: true,
        data: invoice,
        message: 'Invoice retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting invoice by ID:', error);
      throw error;
    }
  }

  @Get('receipts/:id')
  async getReceiptById(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const receipt = await this.paymentService.getReceiptById(id);
      
      // Verify user has access to this receipt's business
      const hasAccess = await this.paymentService.verifyBusinessAccess(
        userId,
        receipt.businessId,
      );
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this receipt');
      }
      
      return {
        success: true,
        data: receipt,
        message: 'Payment receipt retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting receipt by ID:', error);
      throw error;
    }
  }

  @Post('invoices/:id/send')
  async sendInvoice(@Param('id') id: string, @Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      const invoice = await this.paymentService.getInvoiceById(id);
      
      // Verify user has access to this invoice's business
      const hasAccess = await this.paymentService.verifyBusinessAccess(
        userId,
        invoice.businessId,
      );
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this invoice');
      }

      const result = await this.paymentService.sendInvoice(id);
      
      return {
        success: true,
        data: result,
        message: 'Invoice sent successfully'
      };
    } catch (error) {
      this.logger.error('Error sending invoice:', error);
      throw error;
    }
  }

  @Get('stats/:businessId')
  async getPaymentStats(@Param('businessId') businessId: string, @Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const stats = await this.paymentService.getPaymentStats(businessId);
      
      return {
        success: true,
        data: stats,
        message: 'Payment statistics retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting payment stats:', error);
      throw error;
    }
  }

  @Post('webhook/stripe')
  async handleStripeWebhook(@Body() webhookData: any, @Request() req) {
    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        throw new BadRequestException('Stripe signature is required');
      }

      const result = await this.paymentService.handleStripeWebhook(webhookData, signature);
      
      return {
        success: true,
        data: result,
        message: 'Stripe webhook processed successfully'
      };
    } catch (error) {
      this.logger.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }

  @Get('methods/:businessId')
  async getPaymentMethods(@Param('businessId') businessId: string, @Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const paymentMethods = await this.paymentService.getPaymentMethods(businessId);
      
      return {
        success: true,
        data: paymentMethods,
        message: 'Payment methods retrieved successfully'
      };
    } catch (error) {
      this.logger.error('Error getting payment methods:', error);
      throw error;
    }
  }

  @Post('validate/:businessId')
  async validatePayment(
    @Param('businessId') businessId: string,
    @Body() validationData: any,
    @Request() req,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const validationResult = await this.paymentService.validatePayment(businessId, validationData);
      
      return {
        success: true,
        data: validationResult,
        message: 'Payment validated successfully'
      };
    } catch (error) {
      this.logger.error('Error validating payment:', error);
      throw error;
    }
  }

  @Get('export/:businessId')
  async exportPaymentData(
    @Request() req,
    @Param('businessId') businessId: string,
    @Query('format') format: string = 'csv',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID not found in token');
      }

      // Verify user has access to this business
      const hasAccess = await this.paymentService.verifyBusinessAccess(userId, businessId);
      if (!hasAccess) {
        throw new BadRequestException('Access denied to this business');
      }

      const exportData = await this.paymentService.exportPaymentData(businessId, {
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      
      return {
        success: true,
        data: exportData,
        message: 'Payment data exported successfully'
      };
    } catch (error) {
      this.logger.error('Error exporting payment data:', error);
      throw error;
    }
  }
}
