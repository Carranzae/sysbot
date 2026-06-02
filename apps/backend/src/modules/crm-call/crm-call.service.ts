import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CrmCallService {
  private readonly logger = new Logger(CrmCallService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una llamada completada o perdida en el CRM con análisis de Escucha Activa.
   */
  async logCall(data: {
    businessId: string;
    contactId: string;
    duration: number;
    status: 'COMPLETED' | 'MISSED' | 'BUSY' | 'FAILED';
    recordingUrl?: string;
    transcription?: string;
    sentiment?: string;
    queryResolved: boolean;
  }): Promise<any> {
    this.logger.log(`[CRM Call] Registrando llamada del contacto ${data.contactId} con duración ${data.duration}s`);

    const callLog = await this.prisma.callLog.create({
      data: {
        businessId: data.businessId,
        contactId: data.contactId,
        duration: data.duration,
        status: data.status,
        recordingUrl: data.recordingUrl,
        transcription: data.transcription,
        sentimentAnalysis: data.sentiment || 'NEUTRAL',
        queryResolved: data.queryResolved,
        crmTaskCreated: false,
      },
    });

    // Si la llamada falló o no se resolvió la consulta, crear una tarea de seguimiento en el CRM automáticamente
    if (!data.queryResolved || data.status !== 'COMPLETED') {
      await this.createFollowUpTask(data.businessId, data.contactId, callLog.id);
      await this.prisma.callLog.update({
        where: { id: callLog.id },
        data: { crmTaskCreated: true },
      });
    }

    return callLog;
  }

  /**
   * Registra el resultado de una encuesta enviada automáticamente por el bot.
   */
  async submitSurveyResponse(callLogId: string, score: number, feedback?: string): Promise<any> {
    if (score < 1 || score > 5) {
      throw new BadRequestException('La calificación de la encuesta debe ser un número entero entre 1 y 5.');
    }

    this.logger.log(`[CRM Survey] Registrando calificación ${score}/5 para la llamada ${callLogId}`);

    return this.prisma.callLog.update({
      where: { id: callLogId },
      data: {
        surveyScore: score,
        surveyFeedback: feedback,
      },
    });
  }

  /**
   * Obtiene estadísticas agregadas de las llamadas y el bot por negocio.
   */
  async getCallAnalytics(businessId: string): Promise<any> {
    const logs = await this.prisma.callLog.findMany({
      where: { businessId },
    });

    const totalCalls = logs.length;
    const completedCalls = logs.filter(l => l.status === 'COMPLETED').length;
    const resolvedCalls = logs.filter(l => l.queryResolved).length;

    // Calcular duración promedio
    const avgDuration = totalCalls > 0 ? Math.round(logs.reduce((acc, curr) => acc + curr.duration, 0) / totalCalls) : 0;

    // Calcular calificación promedio
    const scoredLogs = logs.filter(l => l.surveyScore !== null);
    const avgScore = scoredLogs.length > 0 ? (scoredLogs.reduce((acc, curr) => acc + (curr.surveyScore || 0), 0) / scoredLogs.length).toFixed(1) : '5.0';

    return {
      totalCalls,
      completedCalls,
      resolvedCalls,
      resolutionRate: totalCalls > 0 ? ((resolvedCalls / totalCalls) * 100).toFixed(1) + '%' : '0%',
      avgDurationSeconds: avgDuration,
      avgSurveyScore: avgScore,
    };
  }

  /**
   * Obtiene la lista completa de llamadas del negocio para visualización de Escucha Activa.
   */
  async getCallLogs(businessId: string): Promise<any[]> {
    return this.prisma.callLog.findMany({
      where: { businessId },
      include: {
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Crea una tarea automática de seguimiento CRM
   */
  private async createFollowUpTask(businessId: string, contactId: string, callLogId: string): Promise<void> {
    this.logger.log(`[CRM Call] Generando tarea automática de recuperación de llamada para el contacto ${contactId}`);
    
    // Aquí se conectaría a la tabla Lead o Task del SaaS existente para agendar el pendiente
    await this.prisma.lead.create({
      data: {
        businessId,
        name: `Llamada no resuelta (CallLog: ${callLogId.substring(0,8)})`,
        phone: '', 
        status: 'NEW',
        notes: `El sistema de IA generó esta tarea de seguimiento automático ya que el cliente colgó o no se resolvió su consulta durante la llamada.`,
      },
    });
  }
}
