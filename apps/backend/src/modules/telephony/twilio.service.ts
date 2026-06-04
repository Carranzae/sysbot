import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { AiService } from '../ai/ai.service';
import { CrmCallService } from '../crm-call/crm-call.service';
import { twiml } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private activeCalls = new Map<
    string,
    {
      from: string;
      to: string;
      startTime: number;
      transcripts: string[];
      queryResolved: boolean;
    }
  >();

  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
    private aiService: AiService,
    private crmCallService: CrmCallService,
  ) {}

  async receiveCall(from: string, to: string, callSid: string): Promise<string> {
    this.logger.log(`Incoming call from ${from} to ${to} (SID: ${callSid})`);

    // Buscar negocio asociado al número
    const business = await this.prisma.business.findFirst({
      where: { phone: to },
    });

    if (!business) {
      return this.generateTwiMLResponse('Lo sentimos, este número no está configurado para atención.');
    }

    // Verificar si el plan soporta llamadas
    const subscription = await this.subscriptionService.getSubscription(business.id);
    const planType = subscription?.planType || 'FREE';

    // Guardar el estado inicial de la llamada
    this.activeCalls.set(callSid, {
      from,
      to,
      startTime: Date.now(),
      transcripts: [],
      queryResolved: false,
    });

    // Registrar mensaje inicial de llamada en la BD (para historial conversacional)
    await this.prisma.message.create({
      data: {
        businessId: business.id,
        direction: 'INBOUND',
        content: '[Llamada de voz iniciada]',
        from,
        to,
        platform: 'TELEPHONY',
        status: 'DELIVERED',
      },
    });

    // Desviar a procesamiento de IA
    return this.processCallWithAI(callSid, from, business.id);
  }

  private async processCallWithAI(callSid: string, from: string, businessId: string): Promise<string> {
    const response = new twiml.VoiceResponse();
    const welcomeMsg = 'Hola, bienvenido. ¿En qué te puedo ayudar hoy?';

    // Graba la transcripción de la respuesta inicial del bot
    const callInfo = this.activeCalls.get(callSid);
    if (callInfo) {
      callInfo.transcripts.push(`Bot: ${welcomeMsg}`);
    }

    const gather = response.gather({
      input: ['speech'],
      language: 'es-PE',
      timeout: 4,
      action: `/api/telephony/process-speech/${businessId}/${callSid}`,
    });

    gather.say({ language: 'es-PE' }, welcomeMsg);

    // Fallback si no dicen nada
    response.say({ language: 'es-PE' }, 'No logré escucharte. Gracias por llamar. Adiós.');
    response.hangup();

    return response.toString();
  }

  async processSpeechResult(callSid: string, businessId: string, speechResult: string): Promise<string> {
    try {
      this.logger.log(`[Twilio Call] SpeechResult recibida: "${speechResult}"`);
      const response = new twiml.VoiceResponse();

      const callInfo = this.activeCalls.get(callSid);
      const fromPhone = callInfo?.from || 'unknown';
      const toPhone = callInfo?.to || 'unknown';

      if (!speechResult || speechResult.trim().length === 0) {
        const retryMsg = 'Disculpa, no logré escucharte bien. ¿Me lo podrías repetir?';
        if (callInfo) {
          callInfo.transcripts.push(`Bot: ${retryMsg}`);
        }
        const gather = response.gather({
          input: ['speech'],
          language: 'es-PE',
          timeout: 4,
          action: `/api/telephony/process-speech/${businessId}/${callSid}`,
        });
        gather.say({ language: 'es-PE' }, retryMsg);
        
        response.say({ language: 'es-PE' }, 'Gracias por llamar. Hasta luego.');
        response.hangup();
        return response.toString();
      }

      // Guardar lo que dijo el usuario en transcripts y mensajes
      if (callInfo) {
        callInfo.transcripts.push(`Cliente: ${speechResult}`);
      }

      await this.prisma.message.create({
        data: {
          businessId,
          direction: 'INBOUND',
          content: speechResult,
          from: fromPhone,
          to: toPhone,
          platform: 'TELEPHONY',
          status: 'DELIVERED',
        },
      });

      // Generar respuesta real usando el motor de IA
      const aiResponse = await this.aiService.generateResponse(businessId, speechResult, fromPhone, {
        platform: 'TELEPHONY',
        senderId: fromPhone,
      });

      // Limpiar tags o comandos tridimensionales de la respuesta de voz (ej: [CREATE_APPOINTMENT:...])
      const cleanMessage = aiResponse.message
        .replace(/\[[A-Z0-9_]+:[^\]]+\]/gi, '')
        .replace(/\[[A-Z0-9_]+\]/gi, '')
        .trim();

      // Guardar respuesta del bot en la BD e historial
      if (callInfo) {
        callInfo.transcripts.push(`Bot: ${cleanMessage}`);
        
        // Si el AI registró la cita médica (que contiene confirmación)
        if (aiResponse.message.toLowerCase().includes('cita registrada') || aiResponse.message.toLowerCase().includes('confirmada')) {
          callInfo.queryResolved = true;
        }
      }

      await this.prisma.message.create({
        data: {
          businessId,
          direction: 'OUTBOUND',
          content: cleanMessage,
          from: toPhone,
          to: fromPhone,
          platform: 'TELEPHONY',
          status: 'SENT',
        },
      });

      // Detectar si la respuesta indica el cierre de la llamada
      const lowerResponse = cleanMessage.toLowerCase();
      const isFarewell = lowerResponse.includes('adiós') || 
                         lowerResponse.includes('adios') || 
                         lowerResponse.includes('hasta luego') || 
                         lowerResponse.includes('chao') ||
                         lowerResponse.includes('que tengas un buen día');

      if (isFarewell) {
        if (callInfo) {
          callInfo.queryResolved = true;
        }
        response.say({ language: 'es-PE' }, cleanMessage);
        response.hangup();
        return response.toString();
      }

      // Continuar la conversación
      const gather = response.gather({
        input: ['speech'],
        language: 'es-PE',
        timeout: 4,
        action: `/api/telephony/process-speech/${businessId}/${callSid}`,
      });
      gather.say({ language: 'es-PE' }, cleanMessage);

      response.say({ language: 'es-PE' }, 'Gracias por llamar. Hasta luego.');
      response.hangup();

      return response.toString();

    } catch (error) {
      this.logger.error('Error processing speech in call:', error);
      const response = new twiml.VoiceResponse();
      response.say({ language: 'es-PE' }, 'Lo siento, ha ocurrido un error al procesar tu solicitud. Por favor llama nuevamente.');
      response.hangup();
      return response.toString();
    }
  }

  async handleCallEnded(callSid: string, durationStr?: string, callStatus?: string): Promise<void> {
    const callInfo = this.activeCalls.get(callSid);
    if (!callInfo) {
      return;
    }

    try {
      const duration = durationStr ? parseInt(durationStr) : Math.round((Date.now() - callInfo.startTime) / 1000);
      const status = callStatus === 'completed' || callStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

      const businessId = await this.findBusinessIdByPhone(callInfo.to);
      if (!businessId) return;

      // Buscar contacto
      let contact = await this.prisma.contact.findFirst({
        where: { phone: callInfo.from, businessId }
      });

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            phone: callInfo.from,
            businessId,
            name: `Cliente de Voz ${callInfo.from.slice(-4)}`,
            source: 'CRM',
            autoCreated: true,
          }
        });
      }

      await this.crmCallService.logCall({
        businessId: contact.businessId,
        contactId: contact.id,
        duration,
        status,
        transcription: callInfo.transcripts.join('\n'),
        sentiment: 'NEUTRAL',
        queryResolved: callInfo.queryResolved,
      });
      this.logger.log(`[Twilio Call] Llamada finalizada y guardada en CRM para contacto ${contact.phone}. Duración: ${duration}s`);
    } catch (err: any) {
      this.logger.error(`[Twilio Call] Error al registrar fin de llamada: ${err.message}`);
    } finally {
      this.activeCalls.delete(callSid);
    }
  }

  private async findBusinessIdByPhone(to: string): Promise<string | null> {
    const biz = await this.prisma.business.findFirst({ where: { phone: to } });
    return biz?.id || null;
  }

  private generateTwiMLResponse(message: string): string {
    const response = new twiml.VoiceResponse();
    response.say({ language: 'es-PE' }, message);
    response.hangup();
    return response.toString();
  }
}
