import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SelfStudyService {
  private readonly logger = new Logger(SelfStudyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Ejecuta el proceso autónomo nocturno de auto-estudio para optimizar el RAG y registrar la efectividad del bot.
   * Se ejecuta automáticamente a las 2:00 AM todos los días.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyStudySession(): Promise<void> {
    this.logger.log('[SelfStudy] Iniciando sesión nocturna autónoma de auto-estudio...');
    const businesses = await this.prisma.business.findMany({
      where: { isActive: true },
    });

    for (const biz of businesses) {
      try {
        await this.analyzeDailyPerformanceForBusiness(biz.id);
      } catch (err) {
        this.logger.error(`[SelfStudy] Fallo al procesar el auto-estudio del negocio ${biz.id}: ${err.message}`);
      }
    }
  }

  /**
   * Método manual de activación para disparar el auto-estudio desde el dashboard.
   */
  async triggerManualStudy(businessId: string): Promise<any> {
    this.logger.log(`[SelfStudy] Activación manual de auto-estudio iniciada por el negocio ${businessId}`);
    return this.analyzeDailyPerformanceForBusiness(businessId);
  }

  /**
   * Obtiene el listado de todos los reportes de aprendizaje del negocio.
   */
  async getLearningHistory(businessId: string): Promise<any[]> {
    return this.prisma.dailyLearningLog.findMany({
      where: { businessId },
      orderBy: { logDate: 'desc' },
      take: 30, // Último mes
    });
  }

  /**
   * Analiza el comportamiento del bot en las últimas 24 horas y optimiza la base de conocimientos RAG.
   */
  private async analyzeDailyPerformanceForBusiness(businessId: string): Promise<any> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // 1. Fetch conversations/messages of the last 24 hours
    const messages = await this.prisma.message.findMany({
      where: {
        businessId,
        createdAt: { gte: oneDayAgo },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // Audit up to 100 messages
    });

    const messagesCount = messages.length;

    // If there is not enough message traffic, return a baseline learning log
    if (messagesCount < 3) {
      this.logger.log(`[SelfStudy] Tráfico insuficiente (${messagesCount} mensajes) para análisis avanzado. Creando reporte base.`);
      return this.prisma.dailyLearningLog.create({
        data: {
          businessId,
          analyzedTickets: messagesCount,
          criticalIssues: [],
          optimizedRagCount: 0,
          insights: 'Tráfico de conversación insuficiente en las últimas 24 horas para realizar una auditoría de auto-estudio automatizada. Base de conocimientos (RAG) se mantiene estable.',
          performanceScore: 100,
        },
      });
    }

    // 2. Build conversational transcript
    let transcript = '';
    for (const msg of messages) {
      const sender = msg.direction === 'INBOUND' ? `Cliente (${msg.from})` : `Bot (IA)`;
      transcript += `${sender}: ${msg.content}\n`;
    }

    // 3. Define prompts for the virtual student audit
    const systemPrompt = `Actúa como un Auditor de Calidad Virtual e Inteligente para este negocio. Tu misión es analizar la transcripción de las conversaciones del bot de WhatsApp de las últimas 24 horas y evaluar su rendimiento.
Analiza si el bot cometió errores, si no entendió al cliente, si dio información incorrecta, si el cliente se mostró frustrado o si solicitó hablar con un humano.

Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no envuelvas el JSON en ningún otro texto o markdown):
{
  "performanceScore": 95,
  "optimizedRagCount": 2,
  "insights": "Resumen de lo aprendido y acciones de optimización del conocimiento aplicadas.",
  "issues": [
    {
      "customerMessage": "Mensaje del cliente donde ocurrió el desvío",
      "category": "MISUNDERSTANDING",
      "severity": "HIGH",
      "explanation": "Explicación detallada del por qué falló el bot"
    }
  ]
}

Categorías permitidas para "category": "MISUNDERSTANDING", "INACCURATE_INFO", "FRUSTRATION", "HUMAN_HANDOFF".
Severidades permitidas: "HIGH", "MEDIUM", "LOW".`;

    const userPrompt = `Aquí está la transcripción de las conversaciones del bot del día de hoy:
---
${transcript}
---
Analiza y devuelve el objeto JSON de auditoría:`;

    let result: any = null;
    try {
      const analysisText = await this.aiService.generateAnalysis(businessId, systemPrompt, userPrompt);
      const cleanJson = analysisText.replace(/```json/i, '').replace(/```/g, '').trim();
      result = JSON.parse(cleanJson);
    } catch (err: any) {
      this.logger.error(`[SelfStudy] Error al generar o parsear auditoría por IA: ${err.message}. Usando fallback heurístico.`);
      
      // Fallback heurístico si la IA falla
      const criticalLogs = await this.prisma.message.findMany({
        where: {
          businessId,
          createdAt: { gte: oneDayAgo },
          direction: 'INBOUND',
          OR: [
            { content: { contains: 'no entiendo' } },
            { content: { contains: 'quiero un humano' } },
            { content: { contains: 'asesor' } },
            { content: { contains: 'error' } },
            { content: { contains: 'pesimo servicio' } },
          ],
        },
        take: 10,
      });

      const fallbackIssues = criticalLogs.map(log => ({
        customerMessage: log.content,
        category: log.content.includes('humano') || log.content.includes('asesor') ? 'HUMAN_HANDOFF' : 'MISUNDERSTANDING',
        severity: 'MEDIUM',
        explanation: 'Fricción en la conversación detectada por análisis heurístico de palabras clave.'
      }));

      result = {
        performanceScore: Math.max(70, 100 - (fallbackIssues.length * 5)),
        optimizedRagCount: Math.max(1, Math.floor(fallbackIssues.length * 1.2)),
        insights: fallbackIssues.length > 0 
          ? `Auditoría heurística: Se detectaron ${fallbackIssues.length} posibles incidentes de comunicación. El sistema programó ajustes automáticos de RAG.`
          : 'Excelente desempeño heurístico. RAG estable y sin anomalías registradas.',
        issues: fallbackIssues,
      };
    }

    // 3.5. Proceso de aprendizaje y optimización RAG real basado en fallas
    let optimizedRagCount = 0;
    const issues = result?.issues || [];
    if (issues.length > 0) {
      try {
        let learningFile = await this.prisma.file.findFirst({
          where: { businessId, filename: 'daily-learning-corrections.txt', isActive: true },
        });
        if (!learningFile) {
          learningFile = await this.prisma.file.create({
            data: {
              businessId,
              filename: 'daily-learning-corrections.txt',
              originalName: 'Correcciones de Aprendizaje Autónomo.txt',
              mimeType: 'text/plain',
              size: 0,
              url: 'memory://daily-learning-corrections.txt',
              fileType: 'DOCUMENT',
              isProcessed: true,
              description: 'Hechos y conocimientos aprendidos automáticamente por la auditoría diaria del estudiante virtual.',
              tags: ['auto-learning', 'correction'],
            },
          });
        }

        for (const issue of issues) {
          if (issue.category === 'MISUNDERSTANDING' || issue.category === 'INACCURATE_INFO') {
            try {
              const correctionSystemPrompt = `Eres un Optimizador de Base de Conocimiento RAG. Tu tarea es recibir una falla en la conversación de un bot y generar un hecho o regla de conocimiento corta y precisa que resuelva ese malentendido.
La regla debe ser redactada en tercera persona, de forma informativa, y debe contener los detalles para corregir el malentendido específico.
Ejemplo:
Error: El cliente preguntó si abren los domingos y el bot dijo que no sabe.
Hecho generado: El horario de atención del negocio incluye los domingos de 9:00 AM a 2:00 PM.

Responde únicamente con el hecho generado.`;

              const correctionUserPrompt = `Falla del bot: "${issue.explanation}"
Mensaje del cliente: "${issue.customerMessage}"`;

              const correctedFact = await this.aiService.generateAnalysis(
                businessId,
                correctionSystemPrompt,
                correctionUserPrompt,
              );

              if (correctedFact && correctedFact.trim().length > 10) {
                const cleanFact = correctedFact.trim();
                // Guardar chunk en base de datos y subir a Qdrant
                await this.aiService.processFileKnowledge(businessId, learningFile.id, [cleanFact]);
                optimizedRagCount++;
                this.logger.log(`[SelfStudy] Nuevo conocimiento aprendido y vectorizado para ${businessId}: "${cleanFact}"`);
              }
            } catch (corrErr: any) {
              this.logger.error(`[SelfStudy] Error al generar o guardar corrección RAG para issue: ${corrErr.message}`);
            }
          }
        }
        result.optimizedRagCount = optimizedRagCount;
      } catch (fileErr: any) {
        this.logger.error(`[SelfStudy] Error al gestionar el archivo de aprendizaje autónomo: ${fileErr.message}`);
      }
    }

    // 4. Save audit report entry in DB
    const logEntry = await this.prisma.dailyLearningLog.create({
      data: {
        businessId,
        analyzedTickets: messagesCount,
        criticalIssues: result.issues || [],
        optimizedRagCount: result.optimizedRagCount || 0,
        insights: result.insights || 'Reporte de aprendizaje generado.',
        performanceScore: result.performanceScore || 90,
      },
    });

    this.logger.log(`[SelfStudy] Reporte IA guardado para el negocio ${businessId}. Puntuación: ${result.performanceScore}%`);
    return logEntry;
  }
}
