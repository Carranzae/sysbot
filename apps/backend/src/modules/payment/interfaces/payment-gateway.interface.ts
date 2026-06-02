export interface PaymentRequest {
  amount: number;
  currency: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  paymentId: string;
  paymentUrl?: string;
  qrCode?: string;
  clientSecret?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  expiresAt?: Date;
}

export interface PaymentStatus {
  valid: boolean;
  status: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  reason?: string;
  gatewayData?: any;
}

export interface RefundResponse {
  refundId: string;
  amount: number;
  status: 'succeeded' | 'pending' | 'failed';
  reason?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'yape' | 'plin' | 'transfer' | 'cash';
  enabled: boolean;
  fees?: {
    fixed: number;
    percentage: number;
  };
}

export interface PaymentGatewayAdapter {
  /**
   * Crear un nuevo pago
   */
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  
  /**
   * Verificar el estado de un pago
   */
  verifyPayment(paymentId: string): Promise<PaymentStatus>;
  
  /**
   * Reembolsar un pago (parcial o total)
   */
  refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResponse>;
  
  /**
   * Obtener métodos de pago disponibles
   */
  getPaymentMethods(): Promise<PaymentMethod[]>;
  
  /**
   * Verificar firma de webhook
   */
  verifyWebhook(payload: string, signature: string): Promise<boolean>;
  
  /**
   * Conectar con el gateway
   */
  connect(config: any): Promise<boolean>;
  
  /**
   * Desconectar del gateway
   */
  disconnect(): Promise<void>;
  
  /**
   * Verificar si está conectado
   */
  isConnected(): Promise<boolean>;
}
