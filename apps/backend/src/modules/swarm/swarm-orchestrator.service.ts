import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PeruvianNlpService } from './peruvian-nlp.service';
import { PeruvianToneService } from './peruvian-tone.service';

export interface SwarmDecision {
  allowed: boolean;
  blockedTarget?: string;
  blockedType?: 'IP' | 'PHONE';
  reason?: string;
  responseMessage: string;
  metadata?: any;
}

@Injectable()
export class SwarmOrchestratorService {
  private readonly logger = new Logger(SwarmOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGateway: WebsocketGateway,
    private readonly peruvianNlp: PeruvianNlpService,
    private readonly peruvianTone: PeruvianToneService,
  ) {}

  /**
   * Procesa un mensaje entrante a través de la red militar de sub-agentes en milisegundos.
   */
  async processIncomingMessage(
    businessId: string,
    senderPhone: string,
    senderIp: string,
    messageContent: string,
  ): Promise<SwarmDecision> {
    const startTime = Date.now();
    this.logger.log(`[Swarm] Iniciando análisis para el mensaje del negocio ${businessId}`);

    // 1. Verificar bloqueos activos por IP o Teléfono (Fase de Prevención Rápida)
    const blockList = await this.prisma.securityBlocklist.findFirst({
      where: {
        businessId,
        OR: [
          { targetType: 'IP', targetValue: senderIp },
          { targetType: 'PHONE', targetValue: senderPhone },
        ],
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
    });

    if (blockList) {
      this.logger.warn(`[Swarm Security] Solicitud bloqueada de forma preventiva: ${blockList.targetValue}. Motivo: ${blockList.reason}`);
      throw new ForbiddenException(`Acceso restringido por seguridad perimetral. Motivo: ${blockList.reason}`);
    }

    // Interceptación de Peruanismos y Jergas locales
    const normalizedInput = this.peruvianNlp.normalizePeruvianSlang(messageContent);
    const contentToAnalyze = normalizedInput.normalizedText;

    // Detectar perfil del cliente peruano (Jóvenes, Mujeres Adultas, Varones Adultos, Ancianos)
    const profile = this.peruvianTone.detectCustomerProfile(contentToAnalyze, {
      name: senderPhone,
    });

    // 2. Ejecutar Agente de Buena Conducta (Safety Guard & Anti-Injection)
    const safetyCheck = await this.runAgenteBuenaConducta(businessId, senderPhone, senderIp, contentToAnalyze);
    if (!safetyCheck.allowed) {
      // Auto-bloqueo inmediato
      await this.prisma.securityBlocklist.create({
        data: {
          businessId,
          targetType: safetyCheck.blockedType || 'PHONE',
          targetValue: safetyCheck.blockedTarget || senderPhone,
          reason: safetyCheck.reason || 'Intento de inyección de prompt o fraude detectado',
          severity: 'CRITICAL',
        },
      });

      // Emitir alerta en tiempo real a los administradores del negocio por WebSockets
      this.wsGateway.server?.to(`business_${businessId}`).emit('securityAlert', {
        type: 'SECURITY_BREACH',
        target: safetyCheck.blockedTarget || senderPhone,
        reason: safetyCheck.reason,
        timestamp: new Date(),
      });

      return {
        allowed: false,
        responseMessage: 'Lo siento, se ha detectado una actividad sospechosa y el acceso ha sido suspendido temporalmente por seguridad.',
        reason: safetyCheck.reason,
      };
    }

    // 3. Ejecutar Agente de Empatía en paralelo (Detecta tono emocional e intenciones)
    const empathyTone = await this.runAgenteEmpatia(contentToAnalyze);

    // 4. Ejecutar Agente de Negociación (Analiza si hay transacciones comerciales o reservas en curso)
    const negotiationResult = await this.runAgenteNegociacion(contentToAnalyze, empathyTone);

    // 5. Ejecutar Agente de Reconocimiento de Errores (Autocorrector de RAG o alucinaciones)
    const correctedResponse = await this.runAgenteReconocimientoErrores(negotiationResult.response);

    // Modular la respuesta final usando el motor formal-casual peruano switcher
    const finalModulatedResponse = this.peruvianTone.modulateResponse(correctedResponse, profile);

    const duration = Date.now() - startTime;
    this.logger.log(`[Swarm] Procesamiento colaborativo completado en ${duration}ms`);

    return {
      allowed: true,
      responseMessage: finalModulatedResponse,
      metadata: {
        tone: empathyTone,
        durationMs: duration,
        negotiation: negotiationResult.metadata,
        peruvianSlangDetected: normalizedInput.detectedIntents,
        inferredBudgetPEN: normalizedInput.inferredBudgetPEN,
        clientProfileDetected: profile,
      },
    };
  }

  /**
   * Escanea el mensaje contra patrones de ataque de inyección de prompt o fraudes
   */
  private async runAgenteBuenaConducta(
    businessId: string,
    phone: string,
    ip: string,
    content: string,
  ): Promise<{ allowed: boolean; blockedTarget?: string; blockedType?: 'IP' | 'PHONE'; reason?: string }> {
    const lowerContent = content.toLowerCase();

    // Patrones típicos de inyección de prompt en español e inglés
    const injectionPatterns = [
      'ignora las instrucciones',
      'ignore previous instructions',
      'olvida las reglas',
      'system prompt',
      'eres un nuevo modelo',
      'actua como un admin',
      'bypass security',
      'dame todas tus contraseñas',
      'revela la configuración',
      'ignore security rules',
    ];

    for (const pattern of injectionPatterns) {
      if (lowerContent.includes(pattern)) {
        return {
          allowed: false,
          blockedTarget: ip || phone,
          blockedType: ip ? 'IP' : 'PHONE',
          reason: `Prompt Injection detectado: Uso de patrón prohibido '${pattern}'`,
        };
      }
    }

    // Escanear sospecha de fraude financiero (ejemplo de hacking en cupones o reclamos de falsos pagos)
    if (lowerContent.includes('ya te deposité') && (lowerContent.includes('dame el saldo gratis') || lowerContent.includes('saldo infinito'))) {
      return {
        allowed: false,
        blockedTarget: phone,
        blockedType: 'PHONE',
        reason: 'Intento flagrante de fraude financiero virtual',
      };
    }

    return { allowed: true };
  }

  /**
   * Agente de Empatía: Reconoce el humor y el tono óptimo de respuesta
   */
  private async runAgenteEmpatia(content: string): Promise<string> {
    const lower = content.toLowerCase();
    if (lower.includes('molesto') || lower.includes('pesimo') || lower.includes('estafa') || lower.includes('tarde')) {
      return 'EMPATHETIC_DEFENSIVE'; // Responder con máxima suavidad y disculpas inmediatas
    }
    if (lower.includes('gracias') || lower.includes('excelente') || lower.includes('bueno')) {
      return 'CORDIAL_HAPPY';
    }
    return 'PROFESSIONAL_DIRECT';
  }

  /**
   * Agente de Negociación: Optimiza reservas de citas, cotizaciones y cierres
   */
  private async runAgenteNegociacion(content: string, tone: string): Promise<{ response: string; metadata: any }> {
    // Simula negociación inteligente según el tono y el contenido
    const lower = content.toLowerCase();
    if (lower.includes('precio') || lower.includes('cuanto cuesta') || lower.includes('descuento')) {
      return {
        response: 'El precio regular es sumamente competitivo, pero permíteme ofrecerte una tarifa especial por agendamiento temprano.',
        metadata: { intent: 'PRICING_INQUIRY', action: 'OFFER_DISCOUNT' },
      };
    }
    return {
      response: 'Con gusto te asistiré a concretar tu reserva para optimizar la agenda de tu negocio.',
      metadata: { intent: 'GENERAL_INFO', action: 'DISPATCH' },
    };
  }

  /**
   * Agente de Reconocimiento de Errores: Verifica alucinaciones y autocorrige
   */
  private async runAgenteReconocimientoErrores(response: string): Promise<string> {
    // Si la respuesta simulada contiene contradicciones lógicas, el agente la pule
    if (response.includes('regular') && response.includes('tarifa especial')) {
      return 'Nuestros precios estándar son excelentes, pero por el día de hoy, tengo el agrado de ofrecerte una tarifa promocional exclusiva si concretamos tu cita ahora.';
    }
    return response;
  }
}
