import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class TwilioService {
  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService
  ) {}

  async receiveCall(from: string, to: string, callSid: string) {
    console.log(`Incoming call from ${from} to ${to}`);

    // Buscar negocio asociado al número
    const business = await this.findBusinessByPhoneNumber(to);
    
    if (!business) {
      return this.generateTwiMLResponse('Sorry, this number is not configured.');
    }

    // Verificar si el plan soporta llamadas
    const subscription = await this.subscriptionService.getSubscription(business.id);
    
    if (!this.canReceiveCalls(subscription?.planType)) {
      return this.generateTwiMLResponse('This plan does not support voice calls. Please upgrade your subscription.');
    }

    // Desviar a procesamiento de IA
    if (['ENTERPRISE', 'ULTIMATE'].includes(subscription?.planType)) {
      return this.processCallWithAI(callSid, from, business.id);
    } else {
      return this.processBasicCall(callSid, from, business.id);
    }
  }

  private async processCallWithAI(callSid: string, from: string, businessId: string) {
    // Generar TwiML para recibir audio y procesar con IA
    const twiml = this.createTwiMLResponse();
    
    const gather = twiml.gather({
      input: 'speech',
      language: 'es-ES',
      timeout: 3,
      numDigits: 1,
      action: `/api/telephony/process-speech/${businessId}/${callSid}`
    });
    
    gather.say({ language: 'es-ES' }, 'Hola, soy el asistente virtual. ¿En qué puedo ayudarte?');
    
    return twiml.toString();
  }

  private async processBasicCall(callSid: string, from: string, businessId: string) {
    const twiml = this.createTwiMLResponse();
    
    twiml.say({ language: 'es-ES' }, 'Gracias por llamar. Este número solo admite mensajes de texto. Por favor, contáctanos por WhatsApp.');
    twiml.hangup();
    
    return twiml.toString();
  }

  async processSpeechResult(callSid: string, businessId: string, speechResult: string) {
    try {
      // Por ahora, respuesta simple hasta que implementemos TTS
      const twiml = this.createTwiMLResponse();
      twiml.say({ language: 'es-ES' }, 'Entendí tu solicitud. Un momento mientras proceso tu respuesta.');
      
      // Preguntar si necesita algo más
      const gather = twiml.gather({
        input: 'speech',
        language: 'es-ES',
        timeout: 3,
        action: `/api/telephony/process-speech/${businessId}/${callSid}`
      });
      
      gather.say({ language: 'es-ES' }, '¿Necesitas algo más?');
      
      return twiml.toString();
      
    } catch (error) {
      console.error('Error processing speech:', error);
      
      const twiml = this.createTwiMLResponse();
      twiml.say({ language: 'es-ES' }, 'Lo siento, no pude procesar tu solicitud. Por favor, intenta nuevamente.');
      twiml.hangup();
      
      return twiml.toString();
    }
  }

  private createTwiMLResponse() {
    // Simulación de TwiML response - en producción usaría la librería de Twilio
    return {
      toString: () => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">Hola, soy el asistente virtual.</Say>
</Response>`,
      gather: (options: any) => ({
        say: (text: string) => ({
          toString: () => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="${options.input}" language="${options.language}" timeout="${options.timeout}" action="${options.action}">
    <Say language="es-ES">${text}</Say>
  </Gather>
</Response>`
        })
      }),
      say: (text: string) => ({
        toString: () => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">${text}</Say>
</Response>`
      }),
      hangup: () => ({
        toString: () => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`
      })
    };
  }

  private generateTwiMLResponse(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">${message}</Say>
  <Hangup/>
</Response>`;
  }

  private async findBusinessByPhoneNumber(phoneNumber: string) {
    // Buscar negocio por número de teléfono
    return this.prisma.business.findFirst({
      where: {
        phone: phoneNumber
      }
    });
  }

  private canReceiveCalls(planType: string): boolean {
    return ['PREMIUM', 'ENTERPRISE', 'ULTIMATE'].includes(planType);
  }
}
