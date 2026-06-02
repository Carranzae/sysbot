import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ConsentResult {
  accepted: boolean;
  acceptedAt: Date;
  ipAddress: string;
}

@Injectable()
export class VoiceCloningService {
  private readonly logger = new Logger(VoiceCloningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el texto legal de Términos y Condiciones obligatorios para clonar voces.
   */
  getLegalTerms(): string {
    return `TÉRMINOS Y CONDICIONES DE CLONACIÓN DE VOZ - SYSBOT SAAS
    
1. PROPIEDAD Y USO DE LA VOZ: El Cliente garantiza y declara ser el propietario exclusivo del registro de voz cargado al sistema. El sistema SYSBOT utilizará la voz clonada ÚNICAMENTE para dar respuestas automáticas e interacciones de llamadas dentro de la instancia de la cuenta de este negocio específico.
2. NO DIVULGACIÓN NI COMPARTICIÓN: SYSBOT garantiza con total confidencialidad técnica que los datos biométricos de la voz cargada no serán compartidos con terceros, ni utilizados en modelos de lenguaje generales, ni transferidos fuera de su microservicio exclusivo.
3. REVOCACIÓN DEL CONSENTIMIENTO: El Cliente puede desactivar y borrar de forma permanente sus muestras de voz del servidor en cualquier momento desde esta interfaz.
4. RESPONSABILIDAD LEGAL: El Cliente asume toda la responsabilidad civil y penal derivada de cargar grabaciones de voz de terceros sin su consentimiento explícito y por escrito.`;
  }

  /**
   * Registra la firma y aceptación digital de los términos legales.
   */
  async acceptTermsAndConditions(businessId: string, ipAddress: string): Promise<any> {
    this.logger.log(`[Voice Cloning] Registrando aceptación legal para el negocio ${businessId} desde IP ${ipAddress}`);

    return this.prisma.voiceCloningConfig.upsert({
      where: { businessId },
      update: {
        termsAccepted: true,
        acceptedAt: new Date(),
        ipAddress: ipAddress,
      },
      create: {
        businessId,
        termsAccepted: true,
        acceptedAt: new Date(),
        ipAddress: ipAddress,
      },
    });
  }

  /**
   * Registra el ID de modelo de voz clonado en ElevenLabs/PlayHT/etc.
   */
  async saveVoiceModel(businessId: string, voiceModelId: string, sampleUrl?: string): Promise<any> {
    // Verificar si ha aceptado los términos primero
    const config = await this.prisma.voiceCloningConfig.findUnique({
      where: { businessId },
    });

    if (!config || !config.termsAccepted) {
      throw new BadRequestException('Debe aceptar primero los Términos y Condiciones legales para habilitar la clonación de voz.');
    }

    return this.prisma.voiceCloningConfig.update({
      where: { businessId },
      data: {
        voiceModelId,
        sampleAudioUrl: sampleUrl,
      },
    });
  }

  /**
   * Devuelve la configuración de clonación de voz de un negocio.
   */
  async getVoiceConfig(businessId: string): Promise<any> {
    return this.prisma.voiceCloningConfig.findUnique({
      where: { businessId },
    });
  }

  /**
   * Genera una respuesta simulada o invoca una API real para convertir texto en audio clonado.
   */
  async generateSpeechFromText(businessId: string, text: string): Promise<{ audioUrl: string; duration: number }> {
    const config = await this.prisma.voiceCloningConfig.findUnique({
      where: { businessId },
    });

    if (!config || !config.termsAccepted || !config.voiceModelId) {
      throw new BadRequestException('La clonación de voz no está totalmente configurada o falta la firma del acuerdo legal.');
    }

    this.logger.log(`[Voice Cloning] Sintetizando audio para el negocio ${businessId} usando modelo ${config.voiceModelId}`);
    
    // Aquí se invocaría el API de ElevenLabs con voiceModelId, simulando el resultado para propósitos del demo
    const simulatedDuration = Math.ceil(text.length * 0.08); // Segundos simulados
    
    return {
      audioUrl: `https://storage.googleapis.com/sysbot-voices/generated_${businessId}.mp3`,
      duration: simulatedDuration,
    };
  }
}
