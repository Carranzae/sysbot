import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentAutomationService } from '../payment/payment-automation.service';
import { PaymentValidationService } from '../payment/payment-validation.service';

export interface PaymentIntentRequest {
  businessId: string;
  customerMessage: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  context?: any;
}

export interface PaymentIntentResponse {
  isPaymentIntent: boolean;
  confidence: number;
  amount?: number;
  currency?: string;
  description?: string;
  paymentResponse?: any;
  message: string;
  nextAction?: string;
}

@Injectable()
export class AIPaymentIntegrationService {
  private readonly logger = new Logger(AIPaymentIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private paymentAutomationService: PaymentAutomationService,
    private paymentValidationService: PaymentValidationService
  ) {}

  /**
   * Detecta intención de pago en el mensaje del cliente
   */
  async detectPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    try {
      this.logger.log(`[AIPayment] Detecting payment intent for business ${request.businessId}`);

      // 1. Analizar el mensaje para detectar intención de pago
      const paymentAnalysis = this.analyzePaymentMessage(request.customerMessage);
      
      if (!paymentAnalysis.isPaymentIntent) {
        return {
          isPaymentIntent: false,
          confidence: 0.1,
          message: 'No se detectó intención de pago en el mensaje'
        };
      }

      // 2. Obtener configuración del negocio
      const business = await this.prisma.business.findUnique({
        where: { id: request.businessId },
        select: {
          paymentGateway: true,
          name: true
        }
      });

      if (!business || business.paymentGateway === 'NONE') {
        return {
          isPaymentIntent: true,
          confidence: paymentAnalysis.confidence,
          message: 'El negocio no tiene configurado un método de pago. Contacta con el administrador.',
          nextAction: 'CONFIGURE_PAYMENT'
        };
      }

      // 3. Extraer información del pago
      const amount = paymentAnalysis.amount || await this.extractAmountFromContext(request.context);
      
      if (!amount || amount <= 0) {
        return {
          isPaymentIntent: true,
          confidence: paymentAnalysis.confidence,
          message: 'No se pudo determinar el monto del pago. ¿Podrías indicar cuánto deseas pagar?',
          nextAction: 'REQUEST_AMOUNT'
        };
      }

      // 4. Crear pago automáticamente
      const paymentResponse = await this.createAutomaticPayment({
        businessId: request.businessId,
        customerEmail: request.customerEmail || `${request.customerPhone}@syst.bot`,
        customerPhone: request.customerPhone,
        customerName: request.customerName || 'Cliente',
        amount: amount,
        description: paymentAnalysis.description || 'Pago generado automáticamente'
      });

      this.logger.log(`[AIPayment] Payment created automatically: ${paymentResponse.paymentId}`);

      return {
        isPaymentIntent: true,
        confidence: paymentAnalysis.confidence,
        amount,
        currency: 'PEN',
        description: paymentAnalysis.description,
        paymentResponse,
        message: `He generado tu pago automáticamente. Puedes completarlo aquí: ${paymentResponse.paymentUrl || paymentResponse.qrCode ? `escanea el código QR` : ``}`,
        nextAction: 'COMPLETE_PAYMENT'
      };

    } catch (error) {
      this.logger.error(`[AIPayment] Error detecting payment intent: ${error.message}`, error.stack);
      
      return {
        isPaymentIntent: false,
        confidence: 0.0,
        message: 'Ocurrió un error al procesar tu solicitud de pago. Por favor, intenta más tarde.'
      };
    }
  }

  /**
   * Analiza el mensaje para detectar intención de pago
   */
  private analyzePaymentMessage(message: string): { isPaymentIntent: boolean; confidence: number; amount?: number; description?: string } {
    const lowerMessage = message.toLowerCase();
    
    // Palabras clave de pago
    const paymentKeywords = [
      'pago', 'pagar', 'pagaría', 'pague', 'cuanto', 'cuánto', 'costo', 'costa',
      'precio', 'precios', 'valor', 'valores', 'dinero', 'abonar', 'abono',
      'transferencia', 'yape', 'plin', 'tarjeta', 'visa', 'mastercard',
      'comprar', 'compra', 'adquirir', 'adquisición'
    ];

    // Expresiones de intención de pago
    const paymentIntents = [
      'quiero pagar', 'voy a pagar', 'deseo pagar', 'necesito pagar',
      'cómo pago', 'cómo hago para pagar', 'dónde pago', 'métodos de pago',
      'aceptan tarjetas', 'aceptan yape', 'aceptan plin', 'formas de pago'
    ];

    // Verificar si hay palabras clave
    const hasKeywords = paymentKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasIntents = paymentIntents.some(intent => lowerMessage.includes(intent));

    if (!hasKeywords && !hasIntents) {
      return { isPaymentIntent: false, confidence: 0.1 };
    }

    // Calcular confianza
    let confidence = 0.5;
    if (hasIntents) confidence += 0.3;
    if (hasKeywords) confidence += 0.2;

    // Extraer monto
    const amount = this.extractAmount(message);
    if (amount) confidence += 0.2;

    // Limitar confianza máxima
    confidence = Math.min(confidence, 0.95);

    return {
      isPaymentIntent: confidence > 0.6,
      confidence,
      amount,
      description: this.extractPaymentDescription(message)
    };
  }

  /**
   * Extrae el monto de un mensaje
   */
  private extractAmount(message: string): number | null {
    // Patrones para extraer montos
    const patterns = [
      /\b(\d+(?:\.\d+)?)\s*(?:soles|sol|s\/|pen|nuevos soles|bs|bolivianos|dólares|usd|\$)\b/gi,
      /\b(?:s\/|pen|\$|soles|sol)\s*(\d+(?:\.\d+)?)\b/gi,
      /\b(\d+(?:\.\d+)?)\s*(?:pesos|mxn|ars|clp)\b/gi,
      /\b(?:costo|precio|valor|pago|abono)\s*(?:de|es)?\s*(\d+(?:\.\d+)?)\b/gi
    ];

    for (const pattern of patterns) {
      const matches = message.match(pattern);
      if (matches && matches.length > 0) {
        // Extraer el número del match
        const numberMatch = matches[0].match(/(\d+(?:\.\d+)?)/);
        if (numberMatch) {
          const amount = parseFloat(numberMatch[1]);
          if (amount > 0 && amount < 100000) { // Validar rango razonable
            return amount;
          }
        }
      }
    }

    return null;
  }

  /**
   * Extrae descripción del pago del mensaje
   */
  private extractPaymentDescription(message: string): string {
    // Buscar menciones de productos o servicios
    const productPatterns = [
      /(?:cita|consultation|consulta|sesión)/gi,
      /(?:producto|servicio|paquete|plan)/gi,
      /(?:mes|membresía|suscripción)/gi,
      /(?:tratamiento|procedimiento|análisis)/gi
    ];

    for (const pattern of productPatterns) {
      const match = message.match(pattern);
      if (match) {
        return `Pago por ${match[0]}`;
      }
    }

    return 'Pago generado automáticamente';
  }

  /**
   * Extrae monto del contexto (citas anteriores, productos, etc.)
   */
  private async extractAmountFromContext(context?: any): Promise<number | null> {
    if (!context) return null;

    try {
      // Buscar en citas pendientes
      if (context.appointmentId) {
        const appointment = await this.prisma.appointment.findUnique({
          where: { id: context.appointmentId },
          select: { price: true }
        });
        
        if (appointment?.price) {
          return Number(appointment.price);
        }
      }

      // Buscar en productos o servicios mencionados
      if (context.productId) {
        // Aquí se podría buscar en una tabla de productos
        // Por ahora, retornamos null
        return null;
      }

      return null;
    } catch (error) {
      this.logger.error(`[AIPayment] Error extracting amount from context: ${error.message}`);
      return null;
    }
  }

  /**
   * Crea un pago automáticamente
   */
  private async createAutomaticPayment(paymentData: {
    businessId: string;
    customerEmail: string;
    customerPhone: string;
    customerName: string;
    amount: number;
    description: string;
  }) {
    try {
      return await this.paymentAutomationService.createPayment({
        businessId: paymentData.businessId,
        customerEmail: paymentData.customerEmail,
        customerPhone: paymentData.customerPhone,
        customerName: paymentData.customerName,
        amount: paymentData.amount,
        description: paymentData.description,
        metadata: {
          source: 'AI_AUTOMATIC',
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error(`[AIPayment] Error creating automatic payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Procesa mensajes relacionados con pagos
   */
  async processPaymentMessage(request: PaymentIntentRequest): Promise<string> {
    try {
      const paymentIntent = await this.detectPaymentIntent(request);

      if (!paymentIntent.isPaymentIntent) {
        return 'No detecté que quieras realizar un pago. Si deseas pagar por algún servicio, por favor indícamelo claramente.';
      }

      if (paymentIntent.nextAction === 'CONFIGURE_PAYMENT') {
        return paymentIntent.message;
      }

      if (paymentIntent.nextAction === 'REQUEST_AMOUNT') {
        return paymentIntent.message;
      }

      if (paymentIntent.nextAction === 'COMPLETE_PAYMENT') {
        let response = paymentIntent.message;

        // Agregar instrucciones específicas según el método de pago
        if (paymentIntent.paymentResponse?.qrCode) {
          response += '\n\nEscanea este código QR con Yape o Plin:';
          response += `\n\n${paymentIntent.paymentResponse.qrCode}`;
        }

        if (paymentIntent.paymentResponse?.paymentUrl) {
          response += `\n\nO haz clic aquí: ${paymentIntent.paymentResponse.paymentUrl}`;
        }

        response += '\n\nUna vez completado el pago, te enviaré la confirmación automáticamente.';

        return response;
      }

      return paymentIntent.message;
    } catch (error) {
      this.logger.error(`[AIPayment] Error processing payment message: ${error.message}`);
      return 'Ocurrió un error al procesar tu solicitud de pago. Por favor, intenta más tarde.';
    }
  }

  /**
   * Valida si un mensaje es una consulta sobre métodos de pago
   */
  isPaymentMethodsQuery(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    const paymentMethodsQueries = [
      'qué métodos de pago aceptan',
      'cómo puedo pagar',
      'formas de pago',
      'métodos de pago',
      'aceptan tarjetas',
      'aceptan yape',
      'aceptan plin',
      'puedo pagar con',
      'opciones de pago'
    ];

    return paymentMethodsQueries.some(query => lowerMessage.includes(query));
  }

  /**
   * Genera respuesta sobre métodos de pago disponibles
   */
  async getPaymentMethodsInfo(businessId: string): Promise<string> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { paymentGateway: true, name: true }
      });

      if (!business || business.paymentGateway === 'NONE') {
        return 'Actualmente no tenemos configurados métodos de pago automáticos. Por favor, contacta directamente para coordinar el pago.';
      }

      let response = `Gracias por tu interés en pagar con ${business.name}.\n\nMétodos de pago disponibles:\n`;

      switch (business.paymentGateway) {
        case 'IZIPAY':
          response += '1. Yape (escanea código QR)\n2. Plin (escanea código QR)\n3. Transferencia bancaria\n4. Tarjeta de crédito/débito\n5. Cuotas hasta 12 meses';
          break;
        case 'STRIPE':
          response += '1. Tarjeta de crédito/débito\n2. Yape\n3. Plin\n4. Transferencia bancaria\n5. Apple Pay / Google Pay';
          break;
        default:
          response += '1. Transferencia bancaria\n2. Yape\n3. Plin\n4. Efectivo (en persona)';
      }

      response += '\n\n¿Cuánto deseas pagar y por qué concepto?';

      return response;
    } catch (error) {
      this.logger.error(`[AIPayment] Error getting payment methods: ${error.message}`);
      return 'Ocurrió un error al obtener los métodos de pago. Por favor, contacta directamente.';
    }
  }
}
