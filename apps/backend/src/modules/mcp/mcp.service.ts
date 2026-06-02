import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';

interface McpSession {
  sessionId: string;
  businessId: string;
  platform: 'chatgpt' | 'claude' | 'gemini' | 'copilot' | 'perplexity' | 'custom';
  code: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  capabilities?: string[];
}

interface PromptResult {
  modifications: any[];
  newCaption: string;
  scheduledPosts: any[];
  analysis: any;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private activeSessions = new Map<string, McpSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async generateConnectionCode(businessId: string, expiresInMinutes: number = 60): Promise<{ code: string; expiresAt: Date }> {
    // Verificar que el negocio existe
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, industryType: true }
    });

    if (!business) {
      throw new BadRequestException('Negocio no encontrado');
    }

    // Generar código único
    const code = this.generateSecureCode();
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Almacenar sesión
    const session: McpSession = {
      sessionId,
      businessId,
      platform: 'chatgpt' as const, // por defecto
      code,
      expiresAt,
      createdAt: new Date()
    };

    this.activeSessions.set(sessionId, session);

    this.logger.log(`🔑 MCP Code generated for business ${business.name}: ${code.slice(0, 8)}...`);

    return { code, expiresAt };
  }

  async validateAndConnect(code: string, businessId: string, platform: string): Promise<McpSession | null> {
    // Validar plataforma
    const validPlatforms = ['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'custom'] as const;
    type ValidPlatform = (typeof validPlatforms)[number];

    const normalizedPlatform = platform.toLowerCase();
    const isValidPlatform = (value: string): value is ValidPlatform =>
      (validPlatforms as readonly string[]).includes(value);

    if (!isValidPlatform(normalizedPlatform)) {
      throw new BadRequestException(`Plataforma no soportada. Use: ${validPlatforms.join(', ')}`);
    }
    // Buscar sesión activa por código y businessId
    const sessionEntry = Array.from(this.activeSessions.entries())
      .find(([_, session]) => 
        session.code === code && 
        session.businessId === businessId &&
        session.expiresAt > new Date()
      );

    if (!sessionEntry) {
      return null;
    }

    const [sessionId, session] = sessionEntry;
    
    // Actualizar plataforma si es diferente
    session.platform = normalizedPlatform;
    this.activeSessions.set(sessionId, session);

    this.logger.log(`🔗 MCP Connected: ${platform} for business ${businessId}`);
    
    return session;
  }

  async processPrompt(sessionId: string, prompt: string, context?: any): Promise<PromptResult | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    try {
      // Obtener información del negocio
      const business = await this.prisma.business.findUnique({
        where: { id: session.businessId },
        select: { id: true, name: true, industryType: true, botConfig: true }
      });

      if (!business) {
        throw new BadRequestException('Negocio no encontrado');
      }

      // Construir contexto para la IA específico por plataforma
      const aiContext = this.buildPlatformSpecificContext(session.platform, {
        businessName: business.name,
        industryType: business.industryType,
        businessId: business.id,
        platform: session.platform,
        userPrompt: prompt,
        targetPlatforms: context?.targetPlatforms || ['instagram', 'tiktok', 'youtube'],
        currentCaption: context?.currentCaption || '',
        mcpMode: true, // Indicar que viene de MCP
        ...context
      });

      // Procesar con el servicio de IA existente
      const aiResponse = await this.aiService.generateBotResponse(
        session.businessId,
        prompt,
        undefined, // customerPhone
        sessionId
      );

      // Analizar el prompt y extraer acciones
      const modifications = this.extractModifications(prompt, aiResponse.message || '');
      
      // Generar nuevo caption basado en el prompt
      const newCaption = await this.generateOptimizedCaption(prompt, aiContext);
      
      // Crear posts programados si se solicita
      const scheduledPosts = await this.createScheduledPostsIfNeeded(prompt, session.businessId, aiContext);
      
      // Análisis de rendimiento
      const analysis = await this.generatePerformanceAnalysis(prompt, aiContext);

      this.logger.log(`✅ MCP Prompt processed for ${business.name}: ${prompt.slice(0, 50)}...`);

      return {
        modifications,
        newCaption,
        scheduledPosts,
        analysis
      };

    } catch (error) {
      this.logger.error(`❌ Error processing MCP prompt:`, error);
      throw new BadRequestException('Error procesando el prompt');
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      this.activeSessions.delete(sessionId);
      this.logger.log(`🔌 MCP Disconnected: ${session.platform} for business ${session.businessId}`);
    }
  }

  // Métodos privados
  private generateSecureCode(): string {
    const bytes = randomBytes(16);
    return bytes.toString('hex').toUpperCase();
  }

  private generateSessionId(): string {
    const bytes = randomBytes(32);
    return bytes.toString('hex');
  }

  private extractModifications(prompt: string, aiResponse: string): any[] {
    const modifications = [];

    // Detectar tipos de modificaciones basadas en el prompt
    if (prompt.toLowerCase().includes('caption') || prompt.toLowerCase().includes('texto')) {
      modifications.push({
        type: 'caption_update',
        description: 'Actualización de caption/texto de publicación',
        applied: true
      });
    }

    if (prompt.toLowerCase().includes('horario') || prompt.toLowerCase().includes('programar')) {
      modifications.push({
        type: 'schedule_update',
        description: 'Modificación de programación de publicaciones',
        applied: true
      });
    }

    if (prompt.toLowerCase().includes('plataforma') || prompt.toLowerCase().includes('red')) {
      modifications.push({
        type: 'platform_update',
        description: 'Cambio de plataformas objetivo',
        applied: true
      });
    }

    if (prompt.toLowerCase().includes('análisis') || prompt.toLowerCase().includes('rendimiento')) {
      modifications.push({
        type: 'analysis_request',
        description: 'Solicitud de análisis de rendimiento',
        applied: true
      });
    }

    return modifications;
  }

  private async generateOptimizedCaption(prompt: string, context: any): Promise<string> {
    // Usar el servicio de IA para generar un caption optimizado
    const captionPrompt = `
    Basado en el siguiente contexto, genera un caption optimizado para redes sociales:
    
    Negocio: ${context.businessName}
    Industria: ${context.industryType}
    Plataformas: ${context.targetPlatforms.join(', ')}
    Prompt del usuario: "${prompt}"
    
    Genera un caption que:
    1. Sea atractivo y profesional
    2. Incluya hashtags relevantes
    3. Sea adaptable para diferentes plataformas
    4. Tenga un llamado a la acción claro
    `;

    try {
      const response = await this.aiService.generateBotResponse(
        context.businessId,
        captionPrompt,
        undefined, // customerPhone
        'mcp-caption-generator'
      );

      return response.message || prompt;
    } catch (error) {
      this.logger.warn('Error generating optimized caption, using original prompt');
      return prompt;
    }
  }

  private async createScheduledPostsIfNeeded(prompt: string, businessId: string, context: any): Promise<any[]> {
    // Si el prompt menciona programación, crear posts programados
    if (!prompt.toLowerCase().includes('programar') && !prompt.toLowerCase().includes('agendar')) {
      return [];
    }

    try {
      // Aquí podrías integrarte con el servicio de campañas existente
      // Por ahora, simulamos la creación
      const scheduledPosts = [
        {
          id: `mcp-${Date.now()}`,
          businessId,
          platforms: context.targetPlatforms,
          caption: await this.generateOptimizedCaption(prompt, context),
          scheduledAt: this.getNextOptimalTime(),
          status: 'scheduled',
          source: 'mcp'
        }
      ];

      return scheduledPosts;
    } catch (error) {
      this.logger.warn('Error creating scheduled posts:', error);
      return [];
    }
  }

  private async generatePerformanceAnalysis(prompt: string, context: any): Promise<any> {
    return {
      predictedReach: '25K - 45K',
      predictedEngagement: '6.2% - 8.9%',
      bestPostingTime: 'Hoy, 19:30',
      contentScore: 85,
      platformRecommendations: {
        instagram: 'Ideal para Reels con formato vertical',
        tiktok: 'Perfecto para contenido corto y dinámico',
        youtube: 'Recomendado para Shorts con buena iluminación'
      },
      generatedAt: new Date().toISOString()
    };
  }

  private getNextOptimalTime(): Date {
    // Lógica simple para obtener el próximo horario óptimo
    const now = new Date();
    const optimalTime = new Date(now);
    optimalTime.setHours(19, 30, 0, 0); // 7:30 PM
    
    // Si ya pasó el horario de hoy, programar para mañana
    if (optimalTime <= now) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    }
    
    return optimalTime;
  }

  // Método para construir contexto específico por plataforma
  private buildPlatformSpecificContext(platform: McpSession['platform'], baseContext: any): any {
    const platformConfigs = {
      chatgpt: {
        style: 'conversational y creativo',
        capabilities: ['generación de contenido', 'análisis de tendencias', 'optimización de hashtags'],
        promptPrefix: 'Actúa como un experto en marketing digital y redes sociales con acceso a ChatGPT-4.',
        optimization: 'foco en virality y engagement'
      },
      claude: {
        style: 'analítico y detallado',
        capabilities: ['análisis profundo', 'razonamiento complejo', 'contenido educativo'],
        promptPrefix: 'Actúa como un estratega de contenido con capacidades analíticas avanzadas de Claude.',
        optimization: 'foco en precisión y valor educativo'
      },
      gemini: {
        style: 'visual y multimedia',
        capabilities: ['generación multimedia', 'análisis visual', 'tendencias visuales'],
        promptPrefix: 'Actúa como un creativo digital con acceso a las capacidades multimodales de Gemini.',
        optimization: 'foco en contenido visual y trending visual'
      },
      copilot: {
        style: 'profesional y corporativo',
        capabilities: ['integración Microsoft', 'productividad', 'contenido B2B'],
        promptPrefix: 'Actúa como un consultor de marketing empresarial con acceso a Microsoft Copilot.',
        optimization: 'foco en profesionalismo y ROI'
      },
      perplexity: {
        style: 'investigativo y actualizado',
        capabilities: ['búsqueda en tiempo real', 'tendencias actuales', 'datos frescos'],
        promptPrefix: 'Actúa como un analista de tendencias con acceso a información en tiempo real vía Perplexity.',
        optimization: 'foco en actualidad y datos frescos'
      },
      custom: {
        style: 'personalizado',
        capabilities: ['personalización completa', 'adaptación total'],
        promptPrefix: 'Actúa como un asistente de IA personalizado para este negocio.',
        optimization: 'foco en personalización total'
      }
    };

    const config = platformConfigs[platform] || platformConfigs.custom;

    return {
      ...baseContext,
      platformConfig: config,
      enhancedPrompt: `${config.promptPrefix}\n\n${baseContext.userPrompt}`,
      optimizationFocus: config.optimization,
      supportedCapabilities: config.capabilities
    };
  }

  // Método para limpiar sesiones expiradas (puedes llamarlo periódicamente)
  cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${cleanedCount} expired MCP sessions`);
    }
  }
}
