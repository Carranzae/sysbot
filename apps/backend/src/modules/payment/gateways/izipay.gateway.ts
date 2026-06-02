import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PaymentGatewayAdapter, PaymentRequest, PaymentResponse, PaymentStatus, RefundResponse, PaymentMethod } from '../interfaces/payment-gateway.interface';

@Injectable()
export class IzipayGateway implements PaymentGatewayAdapter {
  private readonly logger = new Logger(IzipayGateway.name);
  private readonly baseUrl = 'https://api.izipay.pe';
  private apiKey: string;
  private apiSecret: string;
  private merchantId: string;
  private axios: AxiosInstance;

  async connect(config: { apiKey: string; apiSecret: string; merchantId: string }): Promise<boolean> {
    try {
      this.apiKey = config.apiKey;
      this.apiSecret = config.apiSecret;
      this.merchantId = config.merchantId;

      this.axios = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Merchant-ID': this.merchantId
        },
        timeout: 30000
      });

      // Probar conexión
      const response = await this.axios.get('/v1/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('[IziPay] Connection failed:', error.message);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.apiKey = null;
    this.apiSecret = null;
    this.merchantId = null;
    this.axios = null;
  }

  async isConnected(): Promise<boolean> {
    return !!(this.apiKey && this.apiSecret && this.merchantId);
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.logger.log(`[IziPay] Creating payment for ${request.customerEmail} - Amount: ${request.amount}`);

      const payload = {
        amount: request.amount,
        currency: request.currency || 'PEN',
        customer: {
          email: request.customerEmail,
          name: request.customerName,
          phone: request.customerPhone
        },
        payment_methods: ['yape', 'plin', 'card', 'transfer'],
        webhook_url: `${process.env.API_URL}/webhooks/izipay`,
        return_url: `${process.env.FRONTEND_URL}/payment/return`,
        description: request.description || 'Pago SYST',
        metadata: request.metadata || {},
        expires_in: 3600 // 1 hora
      };

      const response = await this.axios.post('/v1/payments', payload);

      this.logger.log(`[IziPay] Payment created: ${response.data.payment_id}`);

      return {
        paymentId: response.data.payment_id,
        paymentUrl: response.data.payment_url,
        qrCode: response.data.qr_code,
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600 * 1000)
      };
    } catch (error) {
      this.logger.error('[IziPay] Error creating payment:', error.response?.data || error.message);
      throw new Error(`Failed to create IziPay payment: ${error.message}`);
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentStatus> {
    try {
      this.logger.log(`[IziPay] Verifying payment: ${paymentId}`);

      const response = await this.axios.get(`/v1/payments/${paymentId}`);
      const payment = response.data;

      const isValid = payment.status === 'paid' || payment.status === 'completed';

      return {
        valid: isValid,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency || 'PEN',
        paidAt: payment.paid_at ? new Date(payment.paid_at) : undefined,
        gatewayData: payment
      };
    } catch (error) {
      this.logger.error('[IziPay] Error verifying payment:', error.response?.data || error.message);
      return {
        valid: false,
        status: 'failed',
        amount: 0,
        currency: 'PEN',
        reason: error.message
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResponse> {
    try {
      this.logger.log(`[IziPay] Refunding payment: ${paymentId} - Amount: ${amount}`);

      const payload = {
        payment_id: paymentId,
        amount: amount,
        reason: reason || 'Refund requested by customer'
      };

      const response = await this.axios.post('/v1/refunds', payload);

      return {
        refundId: response.data.refund_id,
        amount: response.data.amount,
        status: response.data.status
      };
    } catch (error) {
      this.logger.error('[IziPay] Error refunding payment:', error.response?.data || error.message);
      throw new Error(`Failed to refund IziPay payment: ${error.message}`);
    }
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const response = await this.axios.get('/v1/payment-methods');
      
      return response.data.methods.map((method: any) => ({
        id: method.id,
        name: method.name,
        type: method.type,
        enabled: method.enabled,
        fees: method.fees
      }));
    } catch (error) {
      this.logger.error('[IziPay] Error getting payment methods:', error.message);
      return [];
    }
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    try {
      // Implementar verificación HMAC-SHA256
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('[IziPay] Error verifying webhook:', error.message);
      return false;
    }
  }
}
