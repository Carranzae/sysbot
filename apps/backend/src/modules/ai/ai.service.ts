import { Injectable, Logger, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { OpenAIService, VectorService, RAGService, HuggingFaceEmbeddingService, OpenAIEmbeddingService, EmbeddingServiceFactory, LocalEmbeddingService } from '@syst/ai-engine';
import { AIResponse, INDUSTRY_PROMPTS } from '@syst/shared';

const INDUSTRY_UPSELL_OFFERS: Record<string, string> = {
  HEALTHCARE: "Ofrece un 'Chequeo Integral Preventivo' o la 'Membresía de Salud Familiar' para descuentos permanentes.",
  REAL_ESTATE: "Sugiere una 'Asesoría Legal Premium' o un 'Tour VIP de Propiedades' para clientes con alta intención.",
  RETAIL: "Aplica 'Lleva 3 paga 2' en productos relacionados o sugiere el 'Envío Express prioritario'.",
  BEAUTY: "Propón el 'Pack de Transformación Completa' (4 sesiones) con un 15% de ahorro frente a sesiones individuales.",
  EDUCATION: "Sugiere el 'Bundle de Cursos' o la 'Mentoría 1-a-1 Personalizada' para acelerar el aprendizaje.",
  AUTOMOTIVE: "Ofrece el 'Mantenimiento Preventivo de 10k km' o el 'Servicio de Detallado Cerámico'.",
  OTHER: "Sugiere subir al 'Plan Premium' o adquirir el 'Soporte Prioritario 24/7' para una mejor experiencia."
};
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { AIProvider, FileAttachment, AIProviderResponse } from './providers/ai-provider.interface';
import { AppointmentsService } from '../appointments/appointments.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BotRulesService } from '../bot-rules/bot-rules.service';

@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private openaiService?: OpenAIService;
  private vectorService?: VectorService;
  private ragService?: RAGService;
  private embeddingService?: any; // EmbeddingService (HuggingFace o OpenAI)
  private isEnabled = false;
  private providerFactory: AIProviderFactory;
  private systemOpenAiKey?: string;
  private unsubscribeFromSettings?: () => void;
  private isReloadingConfigs = false;
  private pendingReload = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private providerFactoryService: AIProviderFactory,
    @Inject(forwardRef(() => AppointmentsService))
    private appointmentsService: AppointmentsService,
    @Inject(forwardRef(() => MonitoringService))
    private monitoringService: MonitoringService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly botRulesService: BotRulesService,
  ) {
    this.providerFactory = providerFactoryService;
  }

  private calculateEstimatedCost(provider: string, model: string, usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }): number {
    const prompt = usage.promptTokens || 0;
    const completion = usage.completionTokens || 0;
    const total = usage.totalTokens || (prompt + completion);

    const m = model.toLowerCase();
    const p = provider.toLowerCase();

    // Default rates per 1k tokens
    let inputRate = 0.0015;
    let outputRate = 0.002;

    if (p.includes('openai') || m.includes('gpt')) {
      if (m.includes('gpt-4o-mini')) {
        inputRate = 0.00015;
        outputRate = 0.0006;
      } else if (m.includes('gpt-4o')) {
        inputRate = 0.00250;
        outputRate = 0.01000;
      } else if (m.includes('gpt-4') || m.includes('gpt4')) {
        inputRate = 0.03;
        outputRate = 0.06;
      }
    } else if (p.includes('anthropic') || m.includes('claude')) {
      if (m.includes('haiku')) {
        inputRate = 0.00025;
        outputRate = 0.00125;
      } else if (m.includes('sonnet')) {
        inputRate = 0.003;
        outputRate = 0.015;
      } else {
        inputRate = 0.015;
        outputRate = 0.075;
      }
    } else if (p.includes('groq') || m.includes('llama') || m.includes('mixtral')) {
      inputRate = 0.0001;
      outputRate = 0.0002;
    } else if (p.includes('gemini')) {
      if (m.includes('flash')) {
        inputRate = 0.000075;
        outputRate = 0.0003;
      } else {
        inputRate = 0.00125;
        outputRate = 0.00375;
      }
    }

    const inputCost = (prompt / 1000) * inputRate;
    const outputCost = (completion / 1000) * outputRate;
    const totalCost = inputCost + outputCost;

    if (totalCost === 0 && total > 0) {
      return (total / 1000) * ((inputRate + outputRate) / 2);
    }

    return totalCost;
  }

  /**
   * Ejecuta una solicitud al proveedor de IA centralizando monitoreo y costos
   */
  private async executeProviderRequest(
    businessId: string,
    provider: AIProvider,
    prompt: string,
    options: any,
    platform: string = 'API'
  ): Promise<AIProviderResponse> {
    const providerName = provider.constructor.name.toLowerCase().replace('provider', '');
    const serviceName = `ai-${providerName}`;

    // Check circuit breaker
    const canProceed = await this.monitoringService.checkCircuitBreaker(serviceName);
    if (!canProceed) {
      throw new Error(`AI provider ${providerName} is currently unavailable (circuit breaker open)`);
    }

    try {
      const response = await provider.generateResponse(prompt, undefined, options);
      
      // Record success
      await this.monitoringService.recordCircuitBreakerResult(serviceName, true);

      // Record API cost if usage is available
      if (response.usage) {
        const cost = this.calculateEstimatedCost(response.provider || providerName, response.model || options.model || 'gpt-4o', response.usage);
        await this.monitoringService.recordAPICost(
          businessId,
          response.provider || providerName,
          response.usage.totalTokens,
          cost,
          platform,
          response.model || options.model || 'gpt-4o'
        );
      }

      return response;
    } catch (error) {
      // Record failure
      await this.monitoringService.recordCircuitBreakerResult(serviceName, false);
      throw error;
    }
  }

  /**
   * Ejecuta una solicitud al proveedor de IA con archivos centralizando monitoreo y costos
   */
  public async executeProviderRequestWithFiles(
    businessId: string,
    provider: AIProvider,
    prompt: string,
    files: FileAttachment[],
    options: any,
    platform: string = 'API'
  ): Promise<AIProviderResponse> {
    const providerName = provider.constructor.name.toLowerCase().replace('provider', '');
    const serviceName = `ai-${providerName}`;

    if (!provider.generateResponseWithFiles) {
      throw new Error(`AI provider ${providerName} does not support vision/file processing`);
    }

    const canProceed = await this.monitoringService.checkCircuitBreaker(serviceName);
    if (!canProceed) {
      throw new Error(`AI provider ${providerName} is currently unavailable (circuit breaker open)`);
    }

    try {
      const response = await provider.generateResponseWithFiles(prompt, files, undefined, options);
      
      await this.monitoringService.recordCircuitBreakerResult(serviceName, true);

      if (response.usage) {
        const cost = this.calculateEstimatedCost(response.provider || providerName, response.model || options.model || 'gpt-4o', response.usage);
        await this.monitoringService.recordAPICost(
          businessId,
          response.provider || providerName,
          response.usage.totalTokens,
          cost,
          platform,
          response.model || options.model || 'gpt-4o'
        );
      }

      return response;
    } catch (error) {
      await this.monitoringService.recordCircuitBreakerResult(serviceName, false);
      throw error;
    }
  }

  private async executeRequest(
    businessId: string,
    provider: AIProvider,
    prompt: string,
    options: any,
    context?: { platform?: string; files?: FileAttachment[] }
  ): Promise<AIProviderResponse> {
    if (context?.files && context.files.length > 0 && provider.generateResponseWithFiles) {
      return this.executeProviderRequestWithFiles(
        businessId,
        provider,
        prompt,
        context.files,
        options,
        context.platform || 'API'
      );
    }
    return this.executeProviderRequest(
      businessId,
      provider,
      prompt,
      options,
      context?.platform
    );
  }

  async onModuleInit() {
    await this.reloadSystemSettings();

    this.unsubscribeFromSettings = this.settingsService.onConfigChange((event) => {
      if (!['OPENAI_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY'].includes(event.key)) {
        return;
      }
      void this.reloadSystemSettings();
    });
  }

  async onModuleDestroy() {
    this.unsubscribeFromSettings?.();
  }

  private async upgradeEmbeddingService(openaiApiKey?: string): Promise<void> {
    try {
      this.logger.log('🔍 Checking for better embedding services...');
      const betterService = await EmbeddingServiceFactory.createService(openaiApiKey);

      if (betterService.constructor.name !== 'LocalEmbeddingService') {
        this.logger.log(`✅ Upgrading to ${betterService.constructor.name} embeddings`);
        this.embeddingService = betterService;

        if (betterService.constructor.name === 'OpenAIEmbeddingService') {
          this.openaiService = new OpenAIService(openaiApiKey);
        } else {
          this.openaiService = undefined;
        }

        this.ragService = new RAGService(this.embeddingService, this.vectorService, this.openaiService);
        this.logger.log('✅ RAG service upgraded successfully');
      } else {
        this.logger.log('ℹ️ Keeping local embeddings (no better services available)');
      }
    } catch (error) {
      this.logger.warn('⚠️ Could not upgrade embedding service, keeping local:', error instanceof Error ? error.message : String(error));
    }
  }

  private async getSystemSetting(key: string): Promise<string | null> {
    const envValue = this.configService.get<string | null>(key) ?? null;
    if (envValue) {
      let val = envValue;
      if (key === 'QDRANT_URL' && val.endsWith('/')) {
        val = val.slice(0, -1);
      }
      return val;
    }
    const dbValue = await this.settingsService.getValue(key, { defaultValue: null });
    if (dbValue) {
      let val = dbValue;
      if (key === 'QDRANT_URL' && val.endsWith('/')) {
        val = val.slice(0, -1);
      }
      return val;
    }
    return null;
  }

  private async configureRagServices(): Promise<void> {
    const openaiApiKey = await this.getSystemSetting('OPENAI_API_KEY');
    this.systemOpenAiKey = openaiApiKey || undefined;

    const qdrantUrl = await this.getSystemSetting('QDRANT_URL');
    const qdrantApiKey = await this.getSystemSetting('QDRANT_API_KEY');

    if (qdrantUrl) {
      this.vectorService = new VectorService({
        url: qdrantUrl,
        apiKey: qdrantApiKey || undefined,
      });

      this.logger.log('🚀 Initializing RAG service with local embeddings (will upgrade automatically if APIs available)...');
      this.logger.log('🎯 Inicializando balanceador inteligente de APIs RAG...');

      try {
        this.embeddingService = await EmbeddingServiceFactory.createBalancedService(this.systemOpenAiKey);
        this.logger.log('✅ Balanceador de embeddings inicializado correctamente');
      } catch (error) {
        this.logger.warn('⚠️ Balanceador falló, usando sistema tradicional:', error instanceof Error ? error.message : String(error));
        this.embeddingService = new LocalEmbeddingService();
      }

      this.ragService = new RAGService(this.embeddingService, this.vectorService);
      this.isEnabled = true;
      this.logger.log('🏠 RAG initialized with local embeddings (will upgrade automatically if better services available)');

      await this.upgradeEmbeddingService(this.systemOpenAiKey);
    } else {
      if (this.isEnabled) {
        this.logger.warn(
          'RAG service disabled: missing QDRANT_URL. Knowledge generation will be skipped, but direct AI responses will still work.',
        );
      }

      this.vectorService = undefined;
      this.ragService = undefined;
      this.embeddingService = undefined;
      this.openaiService = undefined;
      this.isEnabled = false;
    }
  }

  private async reloadSystemSettings(): Promise<void> {
    if (this.isReloadingConfigs) {
      this.pendingReload = true;
      return;
    }

    this.isReloadingConfigs = true;
    try {
      do {
        this.pendingReload = false;
        await this.configureRagServices();
      } while (this.pendingReload);
    } catch (error) {
      this.logger.error('Failed to reload system settings', error instanceof Error ? error.message : error);
    } finally {
      this.isReloadingConfigs = false;
    }
  }

  private async getProviderForBusiness(businessId: string): Promise<AIProvider> {
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: {
        aiProvider: true,
        aiApiKey: true,
        aiModel: true,
        aiBaseUrl: true,
        temperature: true,
        maxTokens: true,
      },
    });

    // 1. Determinar el Proveedor (Prioridad: Negocio > Global > Default)
    let providerName = config?.aiProvider;
    if (!providerName) {
      providerName = await this.settingsService.getValue('SYSTEM_DEFAULT_AI_PROVIDER', { defaultValue: 'GROQ' });
    }

    // 2. Determinar la API Key (Prioridad: Negocio > Global por Proveedor > Global Genérica > Env)
    let apiKey = config?.aiApiKey;
    
    if (!apiKey) {
      // Buscar llave global específica para este proveedor (ej: SYSTEM_GROQ_API_KEY)
      const globalKeyName = `SYSTEM_${providerName}_API_KEY`;
      apiKey = await this.settingsService.getValue(globalKeyName, { defaultValue: '' });
      
      // Si no hay específica, buscar genérica
      if (!apiKey) {
        apiKey = await this.settingsService.getValue('SYSTEM_AI_API_KEY', { defaultValue: '' });
      }

      // Si no hay en DB, buscar en Env como último recurso
      if (!apiKey) {
        apiKey = this.configService.get<string>(globalKeyName) || 
                 this.configService.get<string>('SYSTEM_AI_API_KEY') || 
                 this.systemOpenAiKey;
      }
    }

    if (!apiKey && providerName !== 'OLLAMA') {
      throw new Error(`Configuración de IA no encontrada: Faltan llaves para ${providerName}`);
    }

    // 3. Determinar el Modelo (Prioridad: Negocio > Global por Proveedor > Default)
    let model = config?.aiModel;
    if (!model) {
      model = await this.settingsService.getValue(`SYSTEM_${providerName}_MODEL`, { defaultValue: '' });
    }

    // 4. Determinar Base URL (Especialmente para Ollama o Custom)
    let baseUrl = config?.aiBaseUrl;
    if (!baseUrl) {
      baseUrl = await this.settingsService.getValue(`SYSTEM_${providerName}_BASE_URL`, { defaultValue: '' });
    }

    return this.providerFactory.createProvider({
      provider: providerName || 'GROQ',
      apiKey: apiKey || '',
      model: model || undefined,
      baseUrl: baseUrl || undefined,
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 500,
    });
  }

  async detectObjectsInImage(
    businessId: string,
    file: FileAttachment,
  ): Promise<{ objects: Array<{ id: string; label: string; confidence: number; bbox: { x: number; y: number; width: number; height: number } }> }> {
    const provider = await this.getProviderForBusiness(businessId);

    if (!provider.generateResponseWithFiles) {
      throw new Error('AI provider does not support vision/file processing');
    }

    const prompt =
      'Analiza la imagen y detecta objetos principales. Devuelve SOLO JSON válido sin texto extra.\n' +
      'Formato EXACTO:\n' +
      '{"objects":[{"label":"string","confidence":0.0,"bbox":{"x":0.0,"y":0.0,"width":0.0,"height":0.0}}]}\n' +
      'Donde bbox está NORMALIZADO (0 a 1) relativo a ANCHO/ALTO de la imagen.\n' +
      'Reglas: confidence entre 0 y 1; x/y/width/height entre 0 y 1; max 25 objetos.';

    const response = await this.executeProviderRequestWithFiles(
      businessId,
      provider,
      prompt,
      [file],
      {
        temperature: 0.2,
        maxTokens: 1200,
      }
    );
    const raw = response.content;

    const jsonText = (() => {
      const trimmed = raw.trim();
      const fenceStart = trimmed.indexOf('```');
      if (fenceStart === -1) return trimmed;
      const fenceEnd = trimmed.lastIndexOf('```');
      if (fenceEnd === -1 || fenceEnd === fenceStart) return trimmed;
      const inner = trimmed.slice(fenceStart + 3, fenceEnd).trim();
      return inner.replace(/^json\s*/i, '').trim();
    })();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      this.logger.warn(`[VisionDetect] Failed to parse JSON. Raw length=${raw.length}`);
      return { objects: [] };
    }

    const objects = Array.isArray(parsed?.objects) ? parsed.objects : [];
    const cleaned = objects
      .slice(0, 25)
      .map((o: any) => {
        const bbox = o?.bbox || {};
        const x = Number(bbox.x);
        const y = Number(bbox.y);
        const width = Number(bbox.width);
        const height = Number(bbox.height);
        const confidence = Number(o?.confidence);
        const label = typeof o?.label === 'string' ? o.label : 'Objeto';

        const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

        return {
          id: randomUUID(),
          label,
          confidence: clamp01(confidence),
          bbox: {
            x: clamp01(x),
            y: clamp01(y),
            width: clamp01(width),
            height: clamp01(height),
          },
        };
      })
      .filter((o: any) => o.bbox.width > 0 && o.bbox.height > 0);

    return { objects: cleaned };
  }

  async generateAnalysis(
    businessId: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    this.logger.log(`[AiService] Iniciando análisis/auditoría genérica para el negocio: ${businessId}`);
    try {
      const provider = await this.getProviderForBusiness(businessId);
      const response = await this.executeProviderRequest(
        businessId,
        provider,
        userPrompt,
        {
          systemPrompt,
          temperature: 0.2,
          maxTokens: 1500,
        },
        'SELF_STUDY',
      );
      return response.text;
    } catch (error: any) {
      this.logger.error(`[AiService] Error al generar análisis para el negocio: ${error.message}`);
      throw error;
    }
  }

  async generateResponse(
    businessId: string,
    customerMessage: string,
    customerPhone?: string,
    context?: {
      platform?: 'WHATSAPP_API' | 'WHATSAPP_WEB' | 'MESSENGER' | 'INSTAGRAM' | 'TELEGRAM';
      senderId?: string;
      files?: FileAttachment[];
    }
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // 1. Evaluar Reglas Manuales primero
    const ruleMatch = await this.botRulesService.evaluateRules(businessId, customerMessage, context?.platform);
    if (ruleMatch.match) {
      this.logger.log(`[RuleEngine] ✅ Regla coincidente encontrada: ${ruleMatch.rule?.name}`);
      return {
        message: ruleMatch.response || 'Sin respuesta configurada',
        confidence: 1.0,
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
      };
    }

    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentDay = String(currentDate.getDate()).padStart(2, '0');
    const exampleDate = `${currentYear}-${currentMonth}-${currentDay}`;
    const nextDay = String(parseInt(currentDay) + 1).padStart(2, '0');
    const exampleDateFuture = `${currentYear}-${currentMonth}-${nextDay}`;

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { botConfig: true },
    });

    if (!business) {
      throw new Error('Business not found');
    }

    const config = business.botConfig as typeof business.botConfig & { ragChannelTargets?: string[] };
    if (!config && !this.systemOpenAiKey) {
      throw new Error('AI configuration not found. Please configure AI provider in settings.');
    }

    // Obtener el proveedor de IA configurado
    const provider = await this.getProviderForBusiness(businessId);

    const ragChannelTargets = Array.isArray(config?.ragChannelTargets) ? config.ragChannelTargets : [];
    const platform = context?.platform;
    const ragChannelAllowed = ragChannelTargets.length === 0 || !platform || ragChannelTargets.includes(platform);

    // Buscar archivos disponibles que podrían ser relevantes
    const availableFiles = await this.prisma.file.findMany({
      where: {
        businessId,
        isActive: true,
        isProcessed: true, // Solo archivos procesados
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        fileType: true,
        description: true,
        tags: true,
      },
      take: 10, // Limitar a 10 archivos más recientes
      orderBy: { createdAt: 'desc' },
    });

    // Obtener terminología y configuración según el rubro (antes de obtener citas para usar terminología correcta)
    // Pasar businessHours configurados si existen
    const customBusinessHours = config.businessHours as Record<string, { enabled: boolean; start: string; end: string }> | null | undefined;
    const industryConfig = this.getIndustryAppointmentConfig(business.industryType, customBusinessHours);

    // Obtener información de citas disponibles
    const upcomingAppointments = await this.appointmentsService.getAvailableAppointmentsInfo(businessId, 7);
    let appointmentsContext = '';
    if (upcomingAppointments.length > 0) {
      const terminologyCapitalized = industryConfig.terminology.charAt(0).toUpperCase() + industryConfig.terminology.slice(1);
      appointmentsContext = `\n\n${terminologyCapitalized} programadas (próximos 7 días):\n`;
      upcomingAppointments.forEach((apt, index) => {
        const date = new Date(apt.appointmentDate);
        appointmentsContext += `${index + 1}. ${apt.customerName} - ${date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${apt.duration} min, ${apt.status})\n`;
      });
    }

    // --- NUEVO: Obtener información de Pedidos y Contacto (Pueleo de BD) ---
    let orderContext = '';
    let contactContext = '';
    if (customerPhone) {
      // Buscar el contacto
      const contact = await this.prisma.contact.findFirst({
        where: { businessId, phone: customerPhone },
        include: { tags: true }
      });
      if (contact) {
        contactContext = `\n👤 INFORMACIÓN DEL CLIENTE:\n`;
        contactContext += `- Nombre: ${contact.name || 'No registrado'}\n`;
        contactContext += `- Etiquetas: ${contact.tags.map(t => t.label).join(', ') || 'Sin etiquetas'}\n`;
        contactContext += `- Última interacción: ${contact.lastIncomingAt?.toLocaleString() || 'Hoy'}\n`;
      }

      // Buscar pedidos recientes
      const recentOrders = await this.prisma.order.findMany({
        where: { businessId, customerPhone },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      if (recentOrders.length > 0) {
        orderContext = `\n📦 PEDIDOS RECIENTES:\n`;
        recentOrders.forEach(o => {
          orderContext += `- Orden #${o.orderNumber}: Total $${o.totalAmount}, Estado: ${o.status}, Fecha: ${o.createdAt.toLocaleDateString()}\n`;
        });
      }
    }

    // Usar el prompt específico del rubro si está disponible
    const industryPrompt = INDUSTRY_PROMPTS[business.industryType] || INDUSTRY_PROMPTS.OTHER;
    const basePrompt = industryPrompt.replace('{businessName}', business.name);

    // Construir el prompt con contexto del negocio
    let businessContext = basePrompt;

    if (business.industryType === 'CLINIC') {
      businessContext += `\n\n🩺 SISTEMA DE TRIAJE DIGITAL PRELIMINAR (OBLIGATORIO):
Si el paciente solicita una consulta médica o cita pero NO indica la especialidad:
1. Pregúntale activamente por sus síntomas o molestias: "¿Qué síntomas o malestares estás experimentando para poder derivarte con el especialista adecuado?"
2. Aplica las siguientes reglas de derivación clínica interna basadas en los síntomas que describa:
   - Dolor en el pecho, presión en el pecho, palpitaciones fuertes, hipertensión o soplo -> Derivar a la especialidad de 'Cardiología'.
   - Fiebre en niños, problemas de crecimiento, vacunas infantiles o malestares en menores de edad -> Derivar a la especialidad de 'Pediatría'.
   - Fracturas, dolores de huesos, articulaciones, esguinces, dolor de columna o muscular fuerte -> Derivar a la especialidad de 'Traumatología'.
   - Problemas urinarios, riñones, próstata -> Derivar a la especialidad de 'Urología'.
   - Problemas en la piel, sarpullido, lunares sospechosos, acné -> Derivar a la especialidad de 'Dermatología'.
   - Dolor de cabeza leve, resfriado común, chequeo general o síntomas no especificados -> Derivar a la especialidad de 'Medicina General'.
3. Una vez identificada la especialidad por triaje, infórmale al paciente y procede al flujo de búsqueda de horarios libres usando [CHECK_APPOINTMENTS_BY_SPECIALTY].
4. Explícale al paciente que sus síntomas de triaje serán registrados de forma real en su expediente médico EHR al confirmar la cita.`;
    }
    
    if (business.categories && business.categories.length > 0) {
      businessContext += `\nEste negocio se especializa en las siguientes categorías: ${business.categories.join(', ')}. Adapta tu vocabulario, tono y recomendaciones explícitamente a estas categorías para dar una atención exclusiva.\n`;
    }

    // MEJORA: Prompt más específico y directo para mejor rendimiento
    businessContext += `\n\n🚀 INSTRUCCIONES DE RENDIMIENTO Y EFICIENCIA:\n`;
    businessContext += `- Sé CONCISO pero COMPLETO. Responde de forma directa sin rodeos\n`;
    businessContext += `- Si tienes información específica en archivos, úsala inmediatamente\n`;
    businessContext += `- No hagas preguntas innecesarias. Si sabes la respuesta, dala directamente\n`;

    // Agregar instrucciones sobre razonamiento contextual y uso inteligente de información
    businessContext += `\n\n🧠 CAPACIDAD DE RAZONAMIENTO Y CONTEXTO:\n`;
    businessContext += `- Tienes capacidad de RAZONAMIENTO CONTEXTUAL. Analiza el contexto completo antes de responder\n`;
    businessContext += `- INFIERE información del contexto: si el cliente dice "Auner Bravo delgado" sin contexto previo, razona que es un nombre completo\n`;
    businessContext += `- Si el cliente responde solo con números (ej: "989353316") después de que preguntaste el teléfono, razona que ese ES el teléfono\n`;
    businessContext += `- Si el cliente dice solo su nombre (ej: "Juan Pérez") sin más contexto, razona que está proporcionando su nombre\n`;
    businessContext += `- NO dependas solo de patrones explícitos. USA TU RAZONAMIENTO para interpretar la intención del cliente\n`;
    businessContext += `- Analiza el flujo de la conversación: si acabas de preguntar "¿Cuál es tu nombre?" y el cliente responde texto, ese texto ES el nombre\n`;
    businessContext += `- Si acabas de preguntar "¿Cuál es tu teléfono?" y el cliente responde números, esos números SON el teléfono\n`;
    businessContext += `\n🔍 ACCESO A BASE DE DATOS (PUELEO):\n`;
    businessContext += `- Tienes acceso a pedidos y datos del cliente. Si el cliente pregunta por su pedido, revisa el historial inyectado.\n`;
    businessContext += `- Comando para buscar detalle: [CHECK_ORDER_STATUS:numero_orden]\n`;
    
    // Inyectar contexto real de la BD
    businessContext += contactContext;
    businessContext += orderContext;
    businessContext += appointmentsContext;

    // MEJORA: Instrucciones más claras y específicas para citas
    businessContext += `\n\n📅 SISTEMA DE CITAS - INSTRUCCIONES CRÍTICAS:\n`;
    businessContext += `- ⚠️ CRÍTICO: Si tienes nombre, teléfono, especialidad Y hora, CREA LA CITA INMEDIATAMENTE\n`;
    businessContext += `- ⚠️ Si falta fecha pero tienes hora específica, ASUME HOY para esa hora\n`;
    businessContext += `- ⚠️ Si el cliente dice "mañana a las 1 pm", ASUME fecha de mañana a las 13:00\n`;
    businessContext += `- ⚠️ Comando exacto: [CREATE_APPOINTMENT:name|phone|specialty|date|time|duration]\n`;
    businessContext += `- ⚠️ Ejemplo: [CREATE_APPOINTMENT:Juan Pérez|999999999|Medicina General|2026-01-04|13:00|30]\n`;
    businessContext += `- ⚠️ NO esperes confirmación adicional. Si tienes los datos, crea la cita\n`;
    businessContext += `- ⚠️ Si ya existe una cita pendiente, cancélala antes de crear nueva\n`;

    businessContext += `\n\n🎥 MASTERIZACIÓN Y REDES SOCIALES - CONTEXTO PRO:\n`;
    businessContext += `- Tienes conocimiento experto en POST-PRODUCCIÓN DE VIDEO para redes sociales (IG, TikTok, YT, FB, X, LinkedIn)\n`;
    businessContext += `- Entiendes que la MASTERIZACIÓN mejora la retención: Brillo/Contraste para visibilidad, Upscale 4K para calidad percibida, y Color Grading para identidad visual\n`;
    businessContext += `- Tienes capacidad para sugerir ESTRATEGIAS DE PLANIFICACIÓN: 3 posts/semana para crecimiento orgánico o 1-2/día para máxima exposición\n`;
    businessContext += `- Si el usuario pregunta sobre la calidad de sus videos, explícale cómo nuestras herramientas de IA (Rostros, 4K, Ruido) optimizan su contenido para el algoritmo de cada red\n`;

    // Inyectar Estrategia de Upselling según Rubro (Si está habilitado)
    if (config.upsellingEnabled) {
      const upsellOffer = INDUSTRY_UPSELL_OFFERS[business.industryType] || INDUSTRY_UPSELL_OFFERS.OTHER;
      businessContext += `\n\n💰 ESTRATEGIA DE CRECIMIENTO (UPSELLING):\n`;
      businessContext += `- Si detectas que el cliente está FELIZ y tiene INTENCIÓN DE COMPRA, sugiere sutilmente lo siguiente: ${upsellOffer}\n`;
      businessContext += `- No seas agresivo. Preséntalo como un beneficio exclusivo para su perfil.\n`;
    }

    if (config.sentimentAnalysisEnabled) {
      businessContext += `\n\n🎯 DETECCIÓN DE SENTIMIENTO E INTENCIÓN (HIDDEN TAGS):\n`;
      businessContext += `- Al final de tu respuesta, DEBES incluir etiquetas de análisis:\n`;
      businessContext += `- [SENTIMENT:POSITIVE|NEUTRAL|NEGATIVE|FRUSTRATED]\n`;
      businessContext += `- [INTENT:INQUIRY|PURCHASE|COMPLAINT|SUPPORT|URGENT]\n`;
      businessContext += `- Ejemplo: "Claro, aquí tienes... [SENTIMENT:POSITIVE] [INTENT:INQUIRY]"\n`;
    }

    businessContext += `\n\n💬 ESTILO DE COMUNICACIÓN:\n`;
    businessContext += `- Sé conciso pero completo. Usa tu razonamiento para interpretar correctamente la intención del cliente\n`;

    // Agregar información sobre citas/reservas según el rubro
    const appointmentsInstructions = `\n\nFUNCIONALIDAD DE ${industryConfig.terminology.toUpperCase()} - FLUJO COMPLETO:

⚠️ FLUJO DE AGENDAMIENTO PASO A PASO:

1. **INICIO**: Si el cliente dice "quiero una cita", "necesito una cita", "${industryConfig.keywords.join('", "')}", etc.:
   - PRIMERO pregunta: "¿Con qué especialidad te gustaría agendar? Por ejemplo: Cardiología, Pediatría, Medicina General, etc."
   - Si el cliente NO sabe qué especialidad necesita:
     * Pregunta: "¿Qué síntomas o malestar tienes? Puedo ayudarte a identificar la especialidad adecuada."
     * Si el cliente describe síntomas, sugiere especialidades basándote en los síntomas
     * También ofrece: "Si prefieres, puedes llamar al número de asistencia médica para una consulta más detallada: [BUSCAR_NUMERO_ASISTENCIA]"
   
2. **ESPECIALIDAD SELECCIONADA**: Cuando el cliente dice una especialidad:
   - Usa: [CHECK_APPOINTMENTS_BY_SPECIALTY:fecha:especialidad]
   - Ejemplo: [CHECK_APPOINTMENTS_BY_SPECIALTY:${exampleDateFuture}:Cardiología]
   - El sistema verificará en la BD los horarios disponibles para esa especialidad
   - Responde: "Perfecto, ya verifiqué los horarios disponibles para ${industryConfig.terminology === 'cita' ? 'la especialidad de' : ''} [ESPECIALIDAD]. Horarios libres: [LISTA_HORARIOS]. ¿Cuál prefieres?"
   
3. **SELECCIÓN DE HORARIO**: Cuando el cliente elige un horario:
   - ⚠️ PRIMERO: Revisa el historial de conversación. Si el cliente ya proporcionó su nombre o teléfono en mensajes anteriores, ÚSALOS directamente.
   - Si el cliente ya dio su nombre (ej: "Auner Bravo delgado"), NO preguntes de nuevo, úsalo.
   - Si el cliente ya dio su teléfono (ej: "989353316"), NO preguntes de nuevo, úsalo.
   - Si el cliente está respondiendo a una pregunta con su nombre o teléfono, ese ES el dato que necesitas.
   - Solo si NO encuentras el nombre o teléfono en el historial, entonces pregunta:
     * "¿Cuál es tu nombre completo?" (solo si falta el nombre)
     * "¿Cuál es tu número de teléfono?" (solo si falta el teléfono)
   
4. **REGISTRO DE CITA**: ⚠️ CRÍTICO - Cuando tengas nombre, teléfono, hora y especialidad:
   - ⚠️⚠️⚠️ CRÍTICO: SI el cliente NO especificó fecha pero sí hora, ASUME que es para HOY (usa la fecha de hoy)
   - ⚠️⚠️⚠️ CRÍTICO ABSOLUTO: NO esperes confirmación explícita. Si tienes nombre, teléfono, hora y especialidad (ya sea del mensaje actual o del historial), CREA LA CITA INMEDIATAMENTE usando [CREATE_APPOINTMENT]
   - ⚠️⚠️⚠️ CRÍTICO: NUNCA digas "Cita registrada exitosamente" SIN haber generado primero el comando [CREATE_APPOINTMENT] en tu respuesta
   - ⚠️⚠️ Si el cliente dice "Si es correcto", "correcto", "sí", "ok", "está bien", "No eso es todo", "eso es todo", CREA LA CITA INMEDIATAMENTE
   - ⚠️ El teléfono del cliente actual está disponible - ÚSALO si no encuentras otro en el historial
   - ⚠️⚠️ NUNCA pidas información que ya está en el historial. Analiza el historial completo antes de hacer preguntas
   - ⚠️⚠️⚠️ CRÍTICO: Si el cliente mencionó una especialidad anteriormente (ej: "necesito ayuda con una especialista en cardiología"), esa ES la especialidad. ÚSALA automáticamente sin preguntar de nuevo
   - ⚠️ Si falta la especialidad pero el cliente mencionó síntomas o necesidades médicas, INFIERE la especialidad apropiada o usa "Medicina General" como predeterminada
   - ⚠️⚠️⚠️ FORMATO OBLIGATORIO: El comando [CREATE_APPOINTMENT] DEBE aparecer en tu respuesta ANTES de decir "Cita registrada exitosamente"
   - Usa: [CREATE_APPOINTMENT:nombre:telefono:fecha:hora:duracion:especialidad:notas]
   - Ejemplo si no hay fecha: [CREATE_APPOINTMENT:Pablo:974501998:${exampleDate}:15:00:60:Neurología:] (usa fecha de hoy)
   - Ejemplo completo: [CREATE_APPOINTMENT:Juan Pérez:51999999999:${exampleDateFuture}:14:00:60:Cardiología:]
   - ⚠️ IMPORTANTE: Si el cliente dice "a las 3 pm" sin fecha, usa la fecha de HOY automáticamente
   - ⚠️⚠️⚠️ RECORDATORIO CRÍTICO: El comando [CREATE_APPOINTMENT] DEBE aparecer en tu respuesta. NO solo digas que la cita está registrada, GENERA EL COMANDO.
   - Después de crear, responde: "✅ Cita registrada exitosamente. Aquí está el detalle de tu cita: [DETALLE_COMPLETO]"
   - Finaliza: "Gracias por elegir ${business.name}. ¡Te esperamos!"
   
5. **VERIFICACIÓN DE CITA**: Si el cliente pregunta "detalle de mi cita", "quiero ver mi cita", "verificar mi cita", "cual fue mi detalle", etc.:
   - Si NO tienes el teléfono en el historial, pregunta: "Por favor, ¿me puedes dar tu nombre completo y número de teléfono para verificar tu cita?"
   - Cuando el cliente proporcione nombre y teléfono, usa: [CHECK_MY_APPOINTMENTS:telefono]
   - Si encuentra la cita, muestra el detalle completo y pregunta: "¿Estás satisfecho con la atención o necesitas más consultas?"
   
6. **MÁS INFORMACIÓN**: Si el cliente dice "más información", "quiero más información", "necesito información", "dame información", etc.:
   - Revisa los archivos subidos usando RAG
   - Proporciona información detallada directamente sin mencionar que viene de archivos
   - ⚠️⚠️⚠️ CRÍTICO: Si hay un VIDEO informativo disponible en los archivos que contenga información relevante, ENVÍALO usando: [SEND_FILE:fileId:video:Descripción del video]
   - ⚠️ Si el cliente dice "no puedo escribir" o "necesito información con video", busca videos informativos en los archivos y envíalos
   - Si no hay información en archivos, responde: "Por el momento no tengo esa información específica, pero puedo ayudarte con [opciones]"
   
7. **PAGO**: Si el cliente dice "quiero hacer el pago", "quiero pagar", "pago de las consultas", "QR de pago", "número de pago", "código de pago", "yape", "plin", etc.:
   - ⚠️ CRÍTICO: SIEMPRE debes usar: [SEND_FILE:qr:image:QR de Pago] para buscar y enviar el QR
   - El sistema buscará automáticamente archivos IMAGE con tags "qr", "pago", "payment", "yape", "plin" o descripción relacionada
   - Si encuentras el QR, envíalo inmediatamente y di: "Aquí está el QR de pago. Por favor, envía el comprobante de pago para finalizar el proceso."
   - Si NO encuentras el QR, di: "No tengo el QR de pago disponible. Por favor, contacta con el administrador para obtenerlo."
   
8. **COMPROBANTE DE PAGO**: Si el cliente envía una imagen de comprobante de pago:
   - El sistema automáticamente reenviará el comprobante al número de destino configurado
   - Responde: "✅ Comprobante recibido. He enviado tu comprobante de pago al especialista con los siguientes detalles: [DETALLE_CITA_COMPLETA]"
   
9. **EVIDENCIAS MÉDICAS**: Si el cliente dice "tengo esto", "tengo síntomas", "me duele", etc. y envía foto/video:
   - Pregunta: "¿Quieres que evalúe estas evidencias el especialista? (Sí/No)"
   - Si dice "Sí" o envía evidencia:
     * Reenvía la evidencia al número de destino del especialista usando: [FORWARD_EVIDENCE:fileId:type:descripción]
     * Responde: "✅ Tus evidencias están siendo evaluadas por el especialista. Para más información, contacta con la asistencia médica al número: [NUMERO_ASISTENCIA]"
   - Si el cliente describe síntomas sin evidencia, pregunta: "¿Tienes alguna foto o video que quieras que el especialista evalúe? Puedes enviármela."
   
10. **RESPUESTAS EN AUDIO**: Si el cliente dice "no sé escribir", "envíame en audio", "respóndeme en audio", etc.:
    - Responde usando: [SEND_AUDIO_RESPONSE:mensaje]
    - El sistema generará una respuesta en audio con el mensaje
    
11. **CIERRE DE CONVERSACIÓN**: Si el cliente dice "gracias", "muchas gracias", "ok gracias", etc.:
    - Responde brevemente: "De nada, ¡que tengas un excelente día! Si necesitas algo más, estaré aquí para ayudarte."
    - NO continúes la conversación a menos que el cliente haga otra pregunta

⚠️ FORMATOS DE COMANDOS:

- [CREATE_APPOINTMENT:nombre:telefono:fecha:hora:duracion:especialidad:notas]
  Ejemplo: [CREATE_APPOINTMENT:Juan Pérez:51999999999:${exampleDateFuture}:14:00:60:Cardiología:Consulta general]
  
- [CHECK_APPOINTMENTS_BY_SPECIALTY:fecha:especialidad]
  Ejemplo: [CHECK_APPOINTMENTS_BY_SPECIALTY:${exampleDateFuture}:Cardiología]
  
- [CHECK_MY_APPOINTMENTS:telefono]
  Ejemplo: [CHECK_MY_APPOINTMENTS:51999999999]
  
- [SEND_FILE:fileId:type:caption] - Para enviar QR de pago, videos informativos u otros archivos
  Ejemplo: [SEND_FILE:abc123:image:QR de Pago]
  Ejemplo video: [SEND_FILE:xyz789:video:Video informativo sobre nuestros servicios]
  ⚠️ IMPORTANTE: Si el cliente pide información y hay un video informativo disponible, usa este comando para enviarlo
  
- [FORWARD_EVIDENCE:fileId:type:descripción] - Para reenviar evidencias al especialista
  Ejemplo: [FORWARD_EVIDENCE:xyz789:image:Evidencia médica de Juan Pérez]
  
- [SEND_AUDIO_RESPONSE:mensaje] - Para responder en audio
  Ejemplo: [SEND_AUDIO_RESPONSE:Tu cita está confirmada para el día...]
  
- [BUSCAR_NUMERO_ASISTENCIA] - Busca número de asistencia médica en archivos

⚠️ REGLAS IMPORTANTES:
- SIEMPRE verifica horarios en la BD primero, luego en archivos si es necesario
- Cuando digas "ya verifiqué", significa que consultaste la BD
- Si hay horarios disponibles, muéstralos todos
- Si todo está libre, permite que el cliente elija cualquier horario dentro del horario de atención
- Horarios de atención: ${industryConfig.businessHours}${appointmentsContext ? '\n' + appointmentsContext.replace(/Citas/g, industryConfig.terminology) : ''}`;

    // Agregar información sobre archivos disponibles si hay
    let filesContext = '';
    if (availableFiles.length > 0) {
      filesContext = `\n\n📁 ARCHIVOS DISPONIBLES (información procesada y disponible para consulta):\n`;
      availableFiles.forEach((file, index) => {
        filesContext += `${index + 1}. ${file.originalName} (${file.fileType}, ID: ${file.id})`;
        if (file.description) {
          filesContext += ` - ${file.description}`;
        }
        if (file.tags && Array.isArray(file.tags) && file.tags.length > 0) {
          filesContext += ` [Tags: ${file.tags.join(', ')}]`;
        }
        filesContext += '\n';
      });
      filesContext += `\n⚠️ IMPORTANTE SOBRE ARCHIVOS Y RESPUESTAS DIRECTAS:\n`;
      filesContext += `- La información de estos archivos está procesada y disponible en la base de conocimiento\n`;
      filesContext += `- ⚠️ REGLA CRÍTICA: Cuando el cliente pregunte algo y la respuesta esté en los archivos, RESPONDE DIRECTAMENTE con la información. NO digas "según nuestros archivos" o "en nuestros documentos". Simplemente proporciona la información de forma natural y profesional\n`;
      filesContext += `- Si el cliente pregunta por precios, servicios, horarios, ubicación, productos, etc., y esa información está en los archivos, dala inmediatamente sin rodeos\n`;
      filesContext += `- Si el cliente pregunta por algo específico que está en un archivo, puedes enviar el archivo usando: [SEND_FILE:fileId:type:caption]\n`;
      filesContext += `- Ejemplo: [SEND_FILE:abc123:image:Catálogo de productos] para enviar una imagen con ID abc123\n`;
      filesContext += `- Tipos válidos: image, video, document\n`;
      filesContext += `\n⚠️ IMPORTANTE PARA QR DE PAGO:\n`;
      filesContext += `- Si el cliente pregunta por QR de pago, busca archivos con:\n`;
      filesContext += `  • Tags: "qr", "pago", "payment", "yape", "plin"\n`;
      filesContext += `  • Descripción que mencione "QR", "pago", "código de pago"\n`;
      filesContext += `  • Nombre de archivo que contenga "qr", "pago", "payment"\n`;
      filesContext += `- Usa: [SEND_FILE:searchTerm:image:QR de Pago] donde searchTerm puede ser "QR de Pago", "qr", "pago", etc.\n`;
      filesContext += `- El sistema buscará automáticamente por nombre, tags y descripción, priorizando archivos con tags/descripción relacionada\n`;
      filesContext += `\n⚠️⚠️⚠️ CRÍTICO PARA VIDEOS INFORMATIVOS:\n`;
      filesContext += `- Si el cliente dice "necesito información", "más información", "no puedo escribir", "necesito información con video", etc., y hay un VIDEO informativo disponible:\n`;
      filesContext += `  • Busca videos con tags: "video", "informativo", "información", "servicios", "productos"\n`;
      filesContext += `  • Busca videos con descripción que mencione "informativo", "información", "servicios", etc.\n`;
      filesContext += `  • Usa: [SEND_FILE:searchTerm:video:Video informativo] donde searchTerm puede ser el nombre del archivo, "video informativo", "información", etc.\n`;
      filesContext += `  • ⚠️ Si el cliente pide información y hay un video disponible, ENVÍALO INMEDIATAMENTE junto con la información textual\n`;
      filesContext += `  • El sistema buscará automáticamente videos por nombre, tags y descripción\n`;

      // Agregar información sobre audio si está habilitado
      if (config.audioEnabled) {
        filesContext += `, audio`;
        filesContext += `\n\nIMPORTANTE: Si el cliente prefiere recibir información en formato de audio o nota de voz, puedes enviar un archivo de audio usando [SEND_FILE:fileId:audio:descripción].`;
      }
      filesContext += '\n';
    } else {
      // Si no hay archivos, informar al sistema
      filesContext = `\n\n⚠️ NO HAY ARCHIVOS DISPONIBLES:\n`;
      filesContext += `- No hay documentos o archivos subidos con información procesada\n`;
      filesContext += `- Si el cliente pide "más información", responde amablemente que no hay información disponible en documentos pero ofrece otras opciones (citas, preguntas generales, etc.)\n`;
      filesContext += `- Puedes usar tu conocimiento general para responder preguntas básicas\n`;

      if (config.audioEnabled) {
        filesContext += `\n- Puedes enviar mensajes de audio cuando sea apropiado usando [SEND_FILE:fileId:audio:descripción] si hay un archivo de audio disponible\n`;
      }
      filesContext += '\n';
    }

    // Obtener historial de conversación reciente si tenemos el teléfono del cliente
    let conversationHistory = '';
    let existingAppointmentsInfo = '';

    if (customerPhone) {
      // Normalizar el teléfono para búsqueda (remover cualquier sufijo)
      const normalizedPhone = customerPhone.split('@')[0].trim();

      // Obtener mensajes recientes - solo de los últimos 10 minutos (timeout de conversación)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentMessages = await this.prisma.message.findMany({
        where: {
          businessId,
          createdAt: {
            gte: tenMinutesAgo, // Solo mensajes de los últimos 10 minutos
          },
          OR: [
            { from: normalizedPhone },
            { from: { contains: normalizedPhone } }, // Buscar si contiene el número
            { to: normalizedPhone },
            { to: { contains: normalizedPhone } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10, // Obtener más para luego limitar por tokens
      });

      this.logger.log(`Found ${recentMessages.length} recent messages for phone: ${normalizedPhone}`);

      if (recentMessages.length > 0) {
        // Invertir para tener el orden cronológico correcto
        const messages = recentMessages.reverse();

        // MEJORA: Limitar a últimos 5 mensajes para evitar error 413
        const limitedMessages = messages.slice(-5);
        this.logger.log(`[History] Limiting to last ${limitedMessages.length} messages (from ${messages.length} total)`);

        // Crear formato de historial como string para incluir en el prompt
        let historyText = '\n\nHistorial de conversación reciente:\n';
        limitedMessages.forEach((msg) => {
          const role = msg.direction === 'INBOUND' ? 'Cliente' : 'Asistente';
          const content = msg.content || '[Mensaje sin texto]';
          // Truncar mensajes muy largos para evitar exceder tokens
          const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content;
          historyText += `${role}: ${truncatedContent}\n`;
        });
        historyText += '\n\n⚠️⚠️⚠️ INSTRUCCIONES CRÍTICAS SOBRE EL HISTORIAL - LEE CON ATENCIÓN:\n';
        historyText += '1. USA este historial para mantener el contexto. NO saludes repetitivamente si ya estás en medio de una conversación\n';
        historyText += '2. ⚠️⚠️⚠️ CRÍTICO: Si el cliente mencionó nombre, teléfono, fecha u hora anteriormente en el historial, ÚSALO INMEDIATAMENTE. NO vuelvas a pedir información que ya proporcionó\n';
        historyText += '3. ⚠️⚠️⚠️ CRÍTICO ABSOLUTO: Si en el historial encuentras:\n';
        historyText += '   - Un nombre (ej: "Enita cruzado valdivia", "Maria", "Juan Pérez", "Auner Bravo")\n';
        historyText += '   - Un teléfono (ej: "974501998", "51999999999", "965210379")\n';
        historyText += '   - Una hora (ej: "Sábado 3 pm", "15:00", "hoy a las 15:00")\n';
        historyText += '   - Una especialidad (ej: "Cardiología", "Medicina general", "Urología", "Necesito ayuda con una especialista en cardiología")\n';
        historyText += '   ENTONCES DEBES CREAR LA CITA INMEDIATAMENTE usando [CREATE_APPOINTMENT] con esos datos. NO preguntes más.\n';
        historyText += '   ⚠️ IMPORTANTE: Si el cliente mencionó "necesito ayuda con una especialista en cardiología" o similar, esa ES la especialidad. ÚSALA.\n';
        historyText += '4. ⚠️⚠️⚠️ CRÍTICO - CONFIRMACIONES: Si el cliente dice "Si", "Sí", "Si xfvor", "Si por favor", "correcto", "ok", "está bien", "claro", "perfecto", etc. después de que le mostraste una pregunta o lista (ej: especialidades), ENTONCES:\n';
        historyText += '   - Si le mostraste una lista de especialidades, PROCEDE con mostrar más detalles o preguntar qué especialidad específica necesita\n';
        historyText += '   - Si le mostraste datos de una cita, CREA LA CITA INMEDIATAMENTE usando [CREATE_APPOINTMENT]\n';
        historyText += '   - Si le preguntaste algo y respondió "si", significa que CONFIRMA. Continúa con el siguiente paso lógico de la conversación\n';
        historyText += '   - ⚠️ NO respondas "Hola de nuevo" o "¿En qué puedo ayudarte?" cuando el cliente está confirmando algo. Mantén el contexto y continúa\n';
        historyText += '5. ⚠️ Si el cliente dice "No eso es todo", "eso es todo", "listo", "ya está", etc., significa que confirmó. CREA LA CITA INMEDIATAMENTE\n';
        historyText += '6. ⚠️ NO asumas que ya existe una cita solo porque se habló de ella. Si el cliente pregunta "detalle de mi cita", primero verifica con [CHECK_MY_APPOINTMENTS:telefono]\n';
        historyText += '7. Si el cliente dice "ya estoy registrado", "ya tengo cita", "detalle de mi cita", "verificar mi cita", "quiero ver mi registro", etc., SIEMPRE usa [CHECK_MY_APPOINTMENTS:telefono] con el teléfono del cliente actual\n';
        historyText += '8. ⚠️⚠️ REGLA DE ORO: Si el cliente está agendando y ya proporcionó nombre + teléfono + hora + especialidad en el historial, NO preguntes más. CREA LA CITA DIRECTAMENTE\n';
        historyText += '9. Si el cliente quiere verificar su cita pero no tienes su teléfono en el historial, pregunta amablemente: "Para verificar tu cita, necesito tu número de teléfono. ¿Cuál es?"\n';
        historyText += '10. Sé profesional y coherente. Continúa la conversación de forma natural sin repetir saludos innecesarios\n';
        historyText += '11. ⚠️⚠️⚠️ NUNCA pidas el nombre si ya está en el historial. Analiza el historial completo antes de hacer cualquier pregunta';
        conversationHistory = historyText;
      }

      // Verificar si el usuario ya tiene citas registradas (usar teléfono normalizado)
      const existingAppointments = await this.appointmentsService.findByPhone(businessId, normalizedPhone);
      if (existingAppointments.length > 0) {
        const upcomingAppointments = existingAppointments.filter(apt =>
          new Date(apt.appointmentDate) >= new Date() &&
          apt.status !== 'CANCELLED' &&
          apt.status !== 'COMPLETED'
        );

        if (upcomingAppointments.length > 0) {
          existingAppointmentsInfo = `\n\n⚠️ IMPORTANTE: Este cliente (teléfono: ${customerPhone}) YA TIENE ${upcomingAppointments.length} ${industryConfig.terminology}(s) registrada(s) en la BASE DE DATOS:\n`;
          upcomingAppointments.forEach((apt, index) => {
            const date = new Date(apt.appointmentDate);
            existingAppointmentsInfo += `${index + 1}. ${apt.customerName} - ${date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${apt.duration} min, Estado: ${apt.status})\n`;
          });
          existingAppointmentsInfo += `\nSi el cliente pregunta por su ${industryConfig.terminology} o dice "ya estoy registrado", confirma sus citas existentes. Si quiere agendar otra ${industryConfig.terminology}, puedes hacerlo pero informa que ya tiene una(s) registrada(s).`;
        }
      } else {
        // ⚠️ CRÍTICO: Si NO hay citas en BD pero en el historial se habló de agendar, el cliente QUIERE crear una cita
        existingAppointmentsInfo = `\n\n⚠️⚠️⚠️ CRÍTICO: Este cliente (teléfono: ${customerPhone}) NO TIENE NINGUNA cita registrada en la BASE DE DATOS.\n`;
        existingAppointmentsInfo += `⚠️ Si en el historial de conversación se mencionó agendar una cita o el cliente proporcionó datos (nombre, teléfono, hora, especialidad), DEBES CREAR LA CITA INMEDIATAMENTE usando [CREATE_APPOINTMENT].\n`;
        existingAppointmentsInfo += `⚠️ NO asumas que ya existe una cita solo porque se habló de ella. Si no está en la BD, NO existe y DEBES CREARLA.\n`;
        existingAppointmentsInfo += `⚠️ Si el cliente pregunta "dame el detalle de la cita" pero NO hay citas en BD, primero CREA LA CITA con los datos del historial, luego muestra el detalle.\n`;
      }
    }

    // Agregar contexto de plataforma si está disponible
    const platformContext = context?.platform ? this.getPlatformContext(context.platform) : '';

    const baseSystemPrompt = config.customPrompt
      ? `${businessContext}${appointmentsInstructions}${filesContext}${existingAppointmentsInfo}${platformContext}\n\n${config.customPrompt}`
      : `${businessContext}${appointmentsInstructions}${filesContext}${existingAppointmentsInfo}${platformContext}`;

    const customPrompt = `${baseSystemPrompt}${conversationHistory}`;

    const fullPrompt = `${customPrompt}\n\nCliente: ${customerMessage}\n\nResponde de manera amigable y profesional, manteniendo el contexto de la conversación anterior:`;

    let aiResponse: string;
    let contextUsed = false;

    // MEJORA: Intentar usar RAG si está disponible con mejor diagnóstico
    // RAG busca conocimiento relevante de forma semántica en los archivos subidos
    const useRAG = this.isEnabled && this.ragService && config.autoReply && ragChannelAllowed;

    // Diagnóstico detallado
    if (!this.isEnabled) {
      this.logger.warn(`[RAG] ⚠️ RAG is disabled. Check QDRANT_URL environment variable.`);
    } else if (!this.ragService) {
      this.logger.warn(`[RAG] ⚠️ RAG service not initialized. Check server logs.`);
    } else if (!config.autoReply) {
      this.logger.warn(`[RAG] ⚠️ Auto-reply is disabled for this business.`);
    } else if (!ragChannelAllowed) {
      this.logger.log(`[RAG] ℹ️ Channel ${platform || 'UNKNOWN'} not enabled for RAG. Using direct provider.`);
    }

    if (useRAG) {
      try {
        // Verificar si hay conocimiento almacenado antes de usar RAG
        // Primero verificar si hay chunks
        const hasKnowledgeChunks = await this.prisma.knowledgeChunk.findFirst({
          where: { businessId },
        });

        // También verificar si hay archivos procesados (puede que el procesamiento esté en curso)
        const processedFilesCount = await this.prisma.file.count({
          where: {
            businessId,
            isActive: true,
            isProcessed: true,
          },
        });

        // MEJORA: Solo usar RAG si hay chunks reales en BD (no solo archivos procesados)
        // Los archivos procesados sin chunks no tienen información útil
        const hasKnowledge = hasKnowledgeChunks;

        this.logger.log(`[RAG] 🔍 Verificando conocimiento para businessId: ${businessId}`);
        this.logger.log(`[RAG] 📚 Chunks en BD: ${hasKnowledgeChunks ? 'SÍ' : 'NO'}`);
        this.logger.log(`[RAG] 📁 Archivos procesados: ${processedFilesCount}`);

        if (processedFilesCount > 0 && !hasKnowledgeChunks) {
          this.logger.warn(`[RAG] ⚠️ Hay ${processedFilesCount} archivos procesados pero NO hay chunks. Los archivos no se procesaron correctamente para RAG.`);
          this.logger.warn(`[RAG] 💡 Solución: Reprocesar los archivos usando POST /api/v1/files/reprocess/:fileId`);
        }

        this.logger.log(`[RAG] ${hasKnowledge ? '✅' : '❌'} Conocimiento encontrado: ${hasKnowledge ? 'SÍ' : 'NO'}`);

        if (hasKnowledge) {
          // Contar total de chunks para este business
          const totalChunks = await this.prisma.knowledgeChunk.count({
            where: { businessId },
          });
          this.logger.log(`[RAG] 📚 Total de chunks disponibles: ${totalChunks}`);

          // Usar RAG para respuesta contextual con búsqueda semántica
          // RAG buscará automáticamente los chunks más relevantes al mensaje del cliente
          this.logger.log(`[RAG] 🔎 Buscando chunks relevantes para: "${customerMessage.substring(0, 100)}..."`);

          // MEJORA: Manejar errores de RAG con fallback
          let ragResponse: AIResponse;
          let lastContext: any = null; // Guardar el último contexto para fallback
          let lastFallbackLevel = 0; // Guardar el último nivel de fallback

          try {
            ragResponse = await this.ragService.generateContextualResponse(
              businessId,
              business.name,
              business.industryType,
              customerMessage,
              baseSystemPrompt,
              conversationHistory ? [conversationHistory] : undefined, // Pasar como array para RAG
              async (context) => {
                // 🚨 OPTIMIZACIÓN CRÍTICA: Sistema de RAG inteligente con reducción automática de contexto
                let knowledgeText = '';

                // Guardar contexto para fallback
                lastContext = context;

                if (context.knowledgeContext.length > 0) {
                  // NIVEL 0: Contexto completo optimizado
                  knowledgeText = context.knowledgeContext.join('\n\n');
                  this.logger.log(`[RAG] 📖 Nivel 0: ${context.knowledgeContext.length} chunks, ${knowledgeText.length} chars`);

                  // Si el contexto es muy largo, reducir automáticamente
                  if (knowledgeText.length > 10000) {
                    // NIVEL 1: Solo información crítica de los chunks más relevantes
                    const criticalPatterns = [
                      /\b\d{11}\b/g, // RUC
                      /\b\d{3,4}-\d{4,7}\b/g, // Teléfonos
                      /\bS\/\s*\d+[\.,]\d{2}\b/g, // Precios en soles
                      /\$\s*\d+[\.,]\d{2}\b/g, // Precios en dólares
                      /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/g, // Horarios
                    ];

                    let criticalInfo = '';
                    criticalPatterns.forEach(pattern => {
                      const matches = knowledgeText.match(pattern);
                      if (matches) {
                        criticalInfo += matches.join(', ') + ' | ';
                      }
                    });

                    knowledgeText = criticalInfo ? `Info crítica: ${criticalInfo}` : context.knowledgeContext[0]; // Solo el chunk más relevante
                    lastFallbackLevel = 1;
                    this.logger.log(`[RAG] 📖 Nivel 1: Contexto reducido a ${knowledgeText.length} chars`);
                  }
                } else {
                  this.logger.warn(`[RAG] ⚠️ No se encontraron chunks relevantes`);
                  lastFallbackLevel = 2; // Sin contexto
                }

                // 🚨 OPTIMIZACIÓN CRÍTICA: Construir prompt MINIMALISTA para evitar límite de tokens
                let enhancedPrompt = customPrompt || '';

                // 🚨 OPTIMIZACIÓN: Sistema de fallback inteligente por niveles
                // Este código ahora se ejecuta dentro del try-catch del RAG principal
                // Si el RAG falla, usamos la información ya procesada según el nivel

                // ⚠️ PRIORIDAD MÁXIMA: Si el cliente pregunta por productos/medicamentos,
                // buscar manualmente en la BD por chunks que contengan esa información
                const lowerMessage = customerMessage.toLowerCase();

                // Palabras clave para detectar preguntas sobre productos/medicamentos
                const productKeywords = ['producto', 'productos', 'vender', 'vende', 'venta', 'comprar',
                  'medicamento', 'medicamentos', 'pastilla', 'pastillas',
                  'farmacia', 'fármaco', 'fármacos'];

                // Nombres específicos de medicamentos
                const medicationKeywords = ['paracetamol', 'ibuprofeno', 'diclofenaco', 'amoxicilina',
                  'azitromicina', 'losartán', 'metformina', 'omeprazol',
                  'loratadina', 'salbutamol', 'budesonida', 'aspirina',
                  'acetaminofen', 'naproxeno', 'ketoprofeno'];

                const askedForProducts = productKeywords.some(keyword =>
                  lowerMessage.includes(keyword.toLowerCase())
                );

                const askedForMedication = medicationKeywords.some(keyword =>
                  lowerMessage.includes(keyword.toLowerCase())
                );

                if ((askedForProducts || askedForMedication) && business.industryType === 'PHARMACY') {
                  this.logger.log(`[RAG] 💊 Cliente preguntó por productos/medicamentos - ANALIZANDO ARCHIVOS PDF`);

                  try {
                    // 🔍 PASO 1: Buscar TODOS los chunks que contienen información de medicamentos
                    const allMedicationChunks = await this.prisma.knowledgeChunk.findMany({
                      where: {
                        businessId: businessId,
                        OR: [
                          { content: { contains: 'paracetamol', mode: 'insensitive' } },
                          { content: { contains: 'ibuprofeno', mode: 'insensitive' } },
                          { content: { contains: 'S/', mode: 'insensitive' } },
                          { content: { contains: 'precio', mode: 'insensitive' } },
                          { content: { contains: 'medicamento', mode: 'insensitive' } }
                        ]
                      },
                      take: 10,
                      orderBy: { id: 'asc' }
                    });

                    this.logger.log(`[RAG] 📄 Encontrados ${allMedicationChunks.length} chunks con información de medicamentos`);

                    // 🔍 PASO 2: Extraer TODOS los medicamentos con precios del archivo
                    const medications = [];

                    for (const chunk of allMedicationChunks) {
                      const content = chunk.content;
                      const lines = content.split('\n');

                      for (const line of lines) {
                        // Buscar cualquier línea que termine con un precio (formato: "Medicamento Presentación Uso Precio")
                        const priceMatch = line.match(/(.+?)(\d+\.\d{2})$/);

                        if (priceMatch) {
                          const medicineInfo = priceMatch[1].trim(); // Todo antes del precio
                          const price = `S/${priceMatch[2]}`;

                          // Intentar extraer nombre del medicamento de manera inteligente
                          let medicineName = '';

                          // Lista de medicamentos conocidos para búsqueda prioritaria
                          const knownMedicines = [
                            'paracetamol', 'ibuprofeno', 'diclofenaco', 'amoxicilina', 'azitromicina',
                            'loratadina', 'omeprazol', 'losartán', 'salbutamol', 'budesonida', 'metformina',
                            'insulina', 'metformina', 'losartan', 'omeprazol', 'loratadina'
                          ];

                          // Primero buscar nombres conocidos en toda la línea
                          for (const med of knownMedicines) {
                            if (medicineInfo.toLowerCase().includes(med)) {
                              medicineName = med.charAt(0).toUpperCase() + med.slice(1);
                              // Para insulina, limpiar el nombre si viene con "Lapicero"
                              if (medicineName.toLowerCase() === 'insulina' && medicineInfo.toLowerCase().includes('lapicero')) {
                                medicineName = 'Insulina (Lápicero)';
                              }
                              break;
                            }
                          }

                          // Si no encontró nombre conocido, intentar extraer del inicio
                          if (!medicineName) {
                            // Separar por números y limpiar
                            const parts = medicineInfo.split(/\d+/);
                            medicineName = parts[0].trim();

                            // Limpiar nombres extraídos automáticamente
                            if (medicineName) {
                              // Quitar palabras como "Inhalador", "Lapicero" del nombre si están al final
                              medicineName = medicineName.replace(/\s*(inhalador|lapicero|diabetes|asma|alergia|gastrico|hta|antibiotic).*$/i, '').trim();

                              // Capitalizar primera letra
                              medicineName = medicineName.charAt(0).toUpperCase() + medicineName.slice(1).toLowerCase();
                            }
                          }

                          // Si encontramos un nombre válido, agregar el medicamento
                          if (medicineName && medicineName.length > 2) {
                            // Extraer presentación (mg x cantidad)
                            const presentationMatch = medicineInfo.match(/(\d+\s*mg\s*x\s*\d+)/i);
                            const presentation = presentationMatch ? presentationMatch[1] : 'Según indicación médica';

                            // Extraer uso/indicación
                            const useMatch = medicineInfo.match(/(dolor|inflamación|alergia|asma|gástrico|antibiótico|hta|diabetes)/i);
                            const use = useMatch ? useMatch[1].charAt(0).toUpperCase() + useMatch[1].slice(1) : 'Según indicación médica';

                            medications.push({
                              name: medicineName,
                              presentation: presentation,
                              use: use,
                              price: price
                            });

                            this.logger.log(`[RAG] 📦 Extraído: ${medicineName} - ${price} (${presentation})`);
                          }
                        }
                      }
                    }

                    // 🔍 PASO 3: Eliminar duplicados y construir respuesta
                    const uniqueMedications = medications.filter((med, index, self) =>
                      index === self.findIndex(m => m.name === med.name && m.price === med.price)
                    );

                    this.logger.log(`[RAG] ✅ Medicamentos encontrados en archivos: ${uniqueMedications.length}`);
                    uniqueMedications.forEach(med => {
                      this.logger.log(`   - ${med.name}: ${med.price} (${med.presentation})`);
                    });

                    // 🔍 PASO 4: Construir respuesta basada en lo encontrado
                    if (uniqueMedications.length > 0) {
                      let response = "Basándome en la información de nuestros archivos, tenemos los siguientes medicamentos disponibles:\n\n";

                      uniqueMedications.forEach(med => {
                        response += `• ${med.name} ${med.presentation} - ${med.price} (${med.use})\n`;
                      });

                      response += "\n¿Te interesa alguno de estos medicamentos o necesitas más información?";

                      return {
                        message: response,
                        confidence: 1.0,
                        shouldEscalate: false,
                        processingTime: 0,
                        appointmentCommand: null,
                        files: []
                      };
                    } else {
                      this.logger.warn(`[RAG] ⚠️ No se encontró información específica de medicamentos en los archivos`);
                      return {
                        message: "No encontré información específica sobre medicamentos en nuestros archivos. ¿Puedes ser más específico sobre qué tipo de producto o medicamento buscas?",
                        confidence: 0.5,
                        shouldEscalate: false,
                        processingTime: 0,
                        appointmentCommand: null,
                        files: []
                      };
                    }

                  } catch (error) {
                    this.logger.error(`[RAG] ❌ Error analizando archivos PDF:`, error.message);
                    return {
                      message: "Lo siento, tuve un problema al consultar la información de nuestros archivos. ¿Puedes intentar de nuevo?",
                      confidence: 0.3,
                      shouldEscalate: false,
                      processingTime: 0,
                      appointmentCommand: null,
                      files: []
                    };
                  }
                }

                if (knowledgeText && knowledgeText.trim().length > 0) {
                  // 🚨 OPTIMIZACIÓN: Prompt MINIMALISTA para evitar límite de tokens
                  enhancedPrompt += `\n\n📋 INFO DISPONIBLE:\n${knowledgeText}\n\n`;
                  enhancedPrompt += `INSTRUCCIONES:\n`;
                  enhancedPrompt += `1. Usa la información arriba para responder preguntas específicas.\n`;
                  enhancedPrompt += `2. Si preguntan precios, usa los valores exactos mostrados.\n`;
                  enhancedPrompt += `3. Si no hay información específica, indica que no tienes datos disponibles.\n`;
                  enhancedPrompt += `4. Mantén respuestas profesionales y concisas.\n`;
                } else {
                  // Si no hay información de documentos pero el usuario pide "más información"
                  const lowerMessage = customerMessage.toLowerCase();
                  if (lowerMessage.includes('más información') || lowerMessage.includes('mas informacion') ||
                    lowerMessage.includes('necesito información') || lowerMessage.includes('dame información') ||
                    lowerMessage.includes('información')) {
                    enhancedPrompt += `\n\n⚠️ ATENCIÓN: El cliente está pidiendo "más información", pero no hay documentos o archivos subidos con información disponible. Debes responder amablemente:\n`;
                    enhancedPrompt += `"Por el momento no tengo información adicional disponible en documentos, pero puedo ayudarte con:\n`;
                    enhancedPrompt += `- Agendar ${industryConfig.terminology}\n`;
                    enhancedPrompt += `- Responder tus preguntas generales\n`;
                    enhancedPrompt += `- Brindarte información básica sobre nuestros servicios\n`;
                    enhancedPrompt += `¿En qué más puedo ayudarte?"\n`;
                  }
                }

                if (conversationHistory) {
                  enhancedPrompt += conversationHistory;
                }

                enhancedPrompt += `\n\nPregunta del cliente: ${customerMessage}\n\n`;
                enhancedPrompt += `INSTRUCCIONES FINALES:\n`;
                enhancedPrompt += `1. Responde de forma natural y profesional.\n`;
                enhancedPrompt += `2. Usa la información disponible cuando sea relevante.\n`;
                enhancedPrompt += `3. Si el cliente confirma algo (sí, ok), mantén el contexto de la conversación.\n`;
                enhancedPrompt += `4. Para citas, usa el formato [CREATE_APPOINTMENT:datos].\n`;
                enhancedPrompt += `5. Sé conciso pero informativo.\n`;
                enhancedPrompt += `10. Si el cliente está agendando una cita, sé proactivo: confirma los datos que tienes y pregunta específicamente lo que falta\n`;
                enhancedPrompt += `11. Responde de manera profesional, amigable y directa. No uses rodeos innecesarios\n`;
                enhancedPrompt += `12. ⚠️ PRECISIÓN: Si el cliente pregunta sobre algo específico (ej: "que especialidades tiene enifarma"), responde con información ESPECÍFICA y DETALLADA de la información disponible. No uses respuestas genéricas\n`;
                enhancedPrompt += `13. ⚠️ Si la información disponible tiene listas o datos estructurados, preséntalos de forma clara y organizada. No los resumas demasiado\n`;

                // Check circuit breaker before calling AI provider
                const providerResponse = await this.executeProviderRequest(
                  businessId,
                  provider,
                  enhancedPrompt,
                  {
                    temperature: config.temperature ?? 0.7,
                    maxTokens: config.maxTokens ?? 500,
                    model: config.aiModel ?? undefined,
                  },
                  context?.platform
                );

                return {
                  message: providerResponse.content,
                  confidence: 0.9,
                  shouldEscalate: false,
                  processingTime: 0,
                };
              }
            );
            aiResponse = ragResponse.message;
            contextUsed = true;
          } catch (ragError: any) {
            // MEJORA: Si RAG falla (ej: error de embeddings), usar proveedor directo sin RAG
            this.logger.warn(`[RAG] RAG failed, falling back to direct provider:`, ragError.message || ragError);
            this.logger.warn(`[RAG] Error: ${ragError.message || ragError}`);
            // Continuar con el flujo normal sin RAG (no re-lanzar, usar proveedor directo)
            contextUsed = false; // Marcar que RAG no se usó para usar proveedor directo
          }
        }

        // Si RAG no se usó o falló, usar proveedor directo
        if (!contextUsed) {
          // No hay conocimiento almacenado, usar solo el proveedor configurado con historial
          let promptWithHistory = conversationHistory
            ? `${customPrompt}\n\nCliente: ${customerMessage}\n\nResponde de manera amigable y profesional, manteniendo el contexto de la conversación anterior:`
            : fullPrompt;

          // Si el usuario pide "más información" y no hay documentos, agregar mensaje apropiado
          const lowerMessage = customerMessage.toLowerCase();
          if (lowerMessage.includes('más información') || lowerMessage.includes('mas informacion') ||
            lowerMessage.includes('necesito información') || lowerMessage.includes('dame información') ||
            lowerMessage.includes('información')) {
            const industryConfig = this.getIndustryAppointmentConfig(business.industryType, customBusinessHours);
            promptWithHistory += `\n\n⚠️ IMPORTANTE: El cliente está pidiendo "más información", pero no hay documentos o archivos subidos con información disponible. Debes responder amablemente:\n`;
            promptWithHistory += `"Por el momento no tengo información adicional disponible en documentos, pero puedo ayudarte con:\n`;
            promptWithHistory += `- Agendar ${industryConfig.terminology}\n`;
            promptWithHistory += `- Responder tus preguntas generales\n`;
            promptWithHistory += `- Brindarte información básica sobre nuestros servicios\n`;
            promptWithHistory += `¿En qué más puedo ayudarte?"\n`;
          }

          const response = await this.executeRequest(
            businessId,
            provider,
            promptWithHistory,
            {
              temperature: config.temperature ?? 0.7,
              maxTokens: config.maxTokens ?? 500,
              model: config.aiModel ?? undefined,
            },
            context
          );
          aiResponse = response.content;
        }
      } catch (error) {
        this.logger.warn(`[RAG] ❌ RAG failed, using fallback:`, error.message);

        // Fallback simple sin RAG
        const fallbackPrompt = conversationHistory
          ? `${customPrompt}\n\nCliente: ${customerMessage}\n\nResponde de manera amigable y profesional, manteniendo el contexto de la conversación anterior:`
          : `${customPrompt}\n\nCliente: ${customerMessage}\n\nResponde de manera profesional.`;

        try {
          const fallbackResponse = await this.executeRequest(
            businessId,
            provider,
            fallbackPrompt,
            {
              temperature: config.temperature ?? 0.7,
              maxTokens: config.maxTokens ?? 300,
              model: config.aiModel ?? undefined,
            },
            context
          );
          aiResponse = fallbackResponse.content;
          this.logger.log('[RAG] ✅ Fallback exitoso');
        } catch (fallbackError) {
          this.logger.error('[RAG] ❌ Fallback también falló:', fallbackError.message);
          // Último fallback: respuesta básica hardcoded
          aiResponse = "Hola, gracias por tu mensaje. Estoy teniendo dificultades técnicas. ¿Podrías intentar nuevamente en unos momentos?";
        }
      }
    } else {
      // Usar solo el proveedor configurado (sin RAG) pero con historial de conversación
      const promptWithHistory = conversationHistory
        ? `${customPrompt}\n\nCliente: ${customerMessage}\n\nResponde de manera amigable y profesional, manteniendo el contexto de la conversación anterior:`
        : fullPrompt;

      const response = await this.executeRequest(
        businessId,
        provider,
        promptWithHistory,
        {
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 500,
          model: config.aiModel ?? undefined,
        },
        context
      );

      aiResponse = response.content;
    }

    const processingTime = Date.now() - startTime;

    // ⚠️ LOG CRÍTICO: Ver qué está generando el AI antes de procesar
    this.logger.log(`[AI Response] Respuesta del AI antes de procesar: ${aiResponse.substring(0, 500)}...`);

    // MEJORA: Extraer comando CREATE_APPOINTMENT ANTES de procesar/limpiar el texto
    // Usar regex más robusto que busque el comando en cualquier parte del texto
    const appointmentRegex = /\[CREATE_APPOINTMENT:([^\]]+)\]/gi;
    const appointmentMatches = aiResponse.match(appointmentRegex);

    if (appointmentMatches && appointmentMatches.length > 0) {
      this.logger.log(`[AI Response] ✅ El AI GENERÓ el comando [CREATE_APPOINTMENT]`);
      this.logger.log(`[AI Response] Comando encontrado: ${appointmentMatches[0]}`);
    } else {
      this.logger.warn(`[AI Response] ❌ El AI NO generó el comando [CREATE_APPOINTMENT]`);
      this.logger.warn(`[AI Response] Respuesta completa: ${aiResponse}`);
    }

    // Procesar solicitudes de citas antes de parsear archivos
    // Pasar el comando extraído si existe
    const processedResponse = await this.processAppointmentRequests(
      businessId,
      business.name,
      aiResponse,
      customerMessage,
      customerPhone,
      conversationHistory,
      appointmentMatches?.[0] // Pasar el comando extraído
    );

    // Procesar consultas de pedidos
    const orderProcessedResponse = await this.processOrderRequests(
      businessId,
      processedResponse
    );

    // Parsear la respuesta para buscar referencias a archivos a enviar
    // (availableFiles ya fue buscado al principio, reutilizamos esa variable)
    const mediaToSend = await this.parseMediaReferences(orderProcessedResponse, availableFiles, businessId);

    // Limpiar el mensaje de las referencias de archivos, citas y pedidos
    let cleanMessage = this.cleanMediaReferences(orderProcessedResponse);

    // Extraer Sentimiento e Intención
    const sentimentMatch = cleanMessage.match(/\[SENTIMENT:(\w+)\]/i);
    const intentMatch = cleanMessage.match(/\[INTENT:(\w+)\]/i);
    const sentiment = sentimentMatch ? sentimentMatch[1].toUpperCase() : 'NEUTRAL';
    const intent = intentMatch ? intentMatch[1].toUpperCase() : 'INQUIRY';

    // Limpiar etiquetas de análisis del mensaje final
    cleanMessage = cleanMessage.replace(/\[SENTIMENT:\w+\]/gi, '').replace(/\[INTENT:\w+\]/gi, '').trim();

    const shouldEscalate = config.sentimentAnalysisEnabled && (sentiment === 'FRUSTRATED' || intent === 'COMPLAINT' || intent === 'URGENT');

    if (shouldEscalate) {
      this.logger.warn(`[Escalation] 🚨 Detectada necesidad de intervención para ${customerPhone}. Sentimiento: ${sentiment}, Intención: ${intent}`);
      // Notificar al dueño del negocio
      await this.notificationsService.create({
        userId: business.ownerId,
        businessId,
        type: 'SYSTEM',
        title: '⚠️ Intervención Humana Requerida',
        message: `El cliente ${customerPhone} parece estar ${sentiment.toLowerCase()}. Intención: ${intent}. Revisa el chat inmediatamente.`,
        metadata: { customerPhone, sentiment, intent, businessId }
      });
    }

    return {
      message: cleanMessage,
      confidence: contextUsed ? 0.9 : 0.7,
      shouldEscalate,
      processingTime,
      sentiment,
      intent,
      mediaToSend: mediaToSend.length > 0 ? mediaToSend : undefined,
    };
  }

  /**
   * Procesa solicitudes de consulta de pedidos
   */
  private async processOrderRequests(
    businessId: string,
    response: string
  ): Promise<string> {
    const orderRegex = /\[CHECK_ORDER_STATUS:([^\]]+)\]/gi;
    let match;
    let processedResponse = response;

    while ((match = orderRegex.exec(response)) !== null) {
      const orderNumber = match[1].trim();
      try {
        const order = await this.prisma.order.findFirst({
          where: { businessId, orderNumber },
          include: { items: true }
        });

        if (order) {
          const detail = `📦 Detalle del Pedido #${order.orderNumber}:\n- Estado: ${order.status}\n- Total: $${order.totalAmount}\n- Fecha: ${order.createdAt.toLocaleDateString()}\n- Items: ${order.items.map(i => i.name).join(', ')}`;
          processedResponse = processedResponse.replace(match[0], detail);
        } else {
          processedResponse = processedResponse.replace(match[0], `❌ No encontré el pedido #${orderNumber}. Por favor verifica el número.`);
        }
      } catch (e) {
        this.logger.error(`Error checking order ${orderNumber}`, e);
        processedResponse = processedResponse.replace(match[0], `(Error al consultar pedido)`);
      }
    }
    return processedResponse;
  }

  /**
   * Procesa solicitudes de citas en la respuesta de la IA
   */
  private async processAppointmentRequests(
    businessId: string,
    businessName: string,
    response: string,
    customerMessage: string,
    customerPhone?: string,
    conversationHistory?: string,
    extractedCommand?: string, // MEJORA: Comando ya extraído con regex
  ): Promise<string> {
    this.logger.log(`[processAppointmentRequests] 🔍 INICIANDO PROCESAMIENTO DE CITAS`);
    this.logger.log(`[processAppointmentRequests] BusinessId: ${businessId}`);
    this.logger.log(`[processAppointmentRequests] Respuesta del AI (primeros 500 chars): ${response.substring(0, 500)}`);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { industryType: true }
    });
    const isClinic = business?.industryType === 'CLINIC';

    // MEJORA: Usar regex más robusto para buscar el comando
    const appointmentRegex = /\[CREATE_APPOINTMENT:([^\]]+)\]/gi;
    let appointmentCommand = extractedCommand || response.match(appointmentRegex)?.[0];

    this.logger.log(`[processAppointmentRequests] ¿Contiene [CREATE_APPOINTMENT]?: ${!!appointmentCommand}`);
    if (appointmentCommand) {
      this.logger.log(`[processAppointmentRequests] ✅ Comando encontrado: ${appointmentCommand}`);
    }

    let processedResponse = response;

    // ⚠️ DETECCIÓN DE FALLO: Si el AI dice "Cita registrada exitosamente" pero NO generó el comando [CREATE_APPOINTMENT]
    // Extraer datos del contexto y crear la cita automáticamente
    const appointmentRegisteredPattern = /(?:cita registrada exitosamente|✅ cita registrada|la cita está registrada|ya está registrada|confirmo que la cita)/i;
    const hasCreateCommand = !!appointmentCommand || /\[CREATE_APPOINTMENT:/.test(response);

    if (appointmentRegisteredPattern.test(response) && !hasCreateCommand) {
      this.logger.warn(`[CREATE_APPOINTMENT] ⚠️ DETECTADO: AI dice que la cita está registrada pero NO generó el comando. Extrayendo datos del contexto...`);

      // Extraer datos del contexto
      const extractedName = this.extractNameFromContext(customerMessage, conversationHistory);
      const extractedPhone = this.extractPhoneFromContext(customerMessage, conversationHistory, customerPhone);
      const extractedSpecialty = this.extractSpecialtyFromContext(customerMessage, conversationHistory);

      // Extraer hora del mensaje actual o historial
      let extractedTime = null;
      let extractedDate = null;

      // Buscar hora en el mensaje actual
      const timePatterns = [
        /(?:a las|las|a|para las)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM|de la mañana|de la tarde|de la noche)?/i,
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM|de la mañana|de la tarde|de la noche)/i,
        /(\d{1,2}):(\d{2})/,
      ];

      for (const pattern of timePatterns) {
        const timeMatch = customerMessage.match(pattern);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const period = timeMatch[3] ? timeMatch[3].toLowerCase() : '';

          if (period) {
            if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
              if (hour !== 12) hour += 12;
            } else if (period.includes('am') || period.includes('mañana')) {
              if (hour === 12) hour = 0;
            }
          }

          extractedTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          break;
        }
      }

      // Si no se encontró en el mensaje actual, buscar en el historial
      if (!extractedTime && conversationHistory) {
        for (const pattern of timePatterns) {
          const timeMatch = conversationHistory.match(pattern);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const period = timeMatch[3] ? timeMatch[3].toLowerCase() : '';

            if (period) {
              if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
                if (hour !== 12) hour += 12;
              } else if (period.includes('am') || period.includes('mañana')) {
                if (hour === 12) hour = 0;
              }
            }

            extractedTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            break;
          }
        }
      }

      // Buscar fecha en el mensaje actual o historial
      const datePatterns = [
        /(?:para|el|la)\s*(mañana|hoy)/i,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{4})-(\d{2})-(\d{2})/,
      ];

      for (const pattern of datePatterns) {
        const dateMatch = customerMessage.match(pattern) || (conversationHistory ? conversationHistory.match(pattern) : null);
        if (dateMatch) {
          if (dateMatch[1].toLowerCase() === 'mañana') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            extractedDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
          } else if (dateMatch[1].toLowerCase() === 'hoy') {
            const today = new Date();
            extractedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          } else if (dateMatch.length === 4) {
            // Formato DD/MM/YYYY
            extractedDate = `${dateMatch[3]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[1]).padStart(2, '0')}`;
          } else if (dateMatch.length === 4 && dateMatch[1].length === 4) {
            // Formato YYYY-MM-DD
            extractedDate = dateMatch[0];
          }
          break;
        }
      }

      // Si no hay fecha pero sí hora, asumir HOY
      if (!extractedDate && extractedTime) {
        const today = new Date();
        extractedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        this.logger.log(`[CREATE_APPOINTMENT] 🧠 Fecha no especificada, asumiendo HOY: ${extractedDate}`);
      }

      // Si tenemos todos los datos necesarios, crear la cita automáticamente
      if (extractedName && extractedPhone && extractedDate && extractedTime) {
        this.logger.log(`[CREATE_APPOINTMENT] ✅ Datos extraídos del contexto: nombre=${extractedName}, teléfono=${extractedPhone}, fecha=${extractedDate}, hora=${extractedTime}, especialidad=${extractedSpecialty || 'No especificada'}`);

        // Crear el comando [CREATE_APPOINTMENT] con los datos extraídos
        const createCommand = `[CREATE_APPOINTMENT:${extractedName}:${extractedPhone}:${extractedDate}:${extractedTime}:60:${extractedSpecialty || 'Medicina General'}:]`;
        processedResponse = createCommand + '\n\n' + processedResponse;
        this.logger.log(`[CREATE_APPOINTMENT] ✅ Comando generado automáticamente: ${createCommand}`);
      } else {
        this.logger.warn(`[CREATE_APPOINTMENT] ❌ No se pudieron extraer todos los datos necesarios. Faltan: ${!extractedName ? 'nombre ' : ''}${!extractedPhone ? 'teléfono ' : ''}${!extractedDate ? 'fecha ' : ''}${!extractedTime ? 'hora' : ''}`);
      }
    }

    // Obtener configuración del rubro para usar terminología correcta
    const businessSettings = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        industryType: true,
        botConfig: {
          select: { businessHours: true },
        },
      },
    });
    const customBusinessHours = businessSettings?.botConfig?.businessHours as Record<string, { enabled: boolean; start: string; end: string }> | null | undefined;
    const industryConfig = this.getIndustryAppointmentConfig(businessSettings?.industryType || 'OTHER', customBusinessHours);

    // Procesar [CREATE_APPOINTMENT:nombre:telefono:fecha:hora:duracion:especialidad:notas]
    // Buscar en processedResponse porque puede haber sido modificado por la detección de fallo
    const createPattern = /\[CREATE_APPOINTMENT:([^:]+):([^:]+):([^:]+):([^:]+):([^:]+):([^:]*):([^\]]*)\]/gi;
    let match;

    this.logger.log(`[processAppointmentRequests] 🔍 Buscando comando [CREATE_APPOINTMENT] en processedResponse...`);
    const matches = processedResponse.match(createPattern);
    if (matches) {
      this.logger.log(`[processAppointmentRequests] ✅ ENCONTRADOS ${matches.length} comando(s) [CREATE_APPOINTMENT]:`, matches);
    } else {
      this.logger.warn(`[processAppointmentRequests] ❌ NO se encontró ningún comando [CREATE_APPOINTMENT] en la respuesta`);
    }

    // Resetear el regex para el while loop
    createPattern.lastIndex = 0;

    while ((match = createPattern.exec(processedResponse)) !== null) {
      this.logger.log(`[processAppointmentRequests] 🔄 PROCESANDO comando [CREATE_APPOINTMENT] encontrado:`);
      this.logger.log(`[processAppointmentRequests]   - Match completo: ${match[0]}`);
      try {
        let [, name, phone, dateStr, timeStr, durationStr, specialty, notes] = match;

        // 🧠 RAZONAMIENTO CONTEXTUAL: Extraer datos usando lógica inteligente
        // Analizar el contexto completo para inferir nombre, teléfono, etc.
        if (!name || name.trim() === '' || name.trim().toLowerCase() === 'no especificado' || name.trim().toLowerCase() === 'desconocido') {
          name = this.extractNameFromContext(customerMessage, conversationHistory);
          if (name) {
            this.logger.log(`[CREATE_APPOINTMENT] 🧠 Nombre inferido por razonamiento contextual: ${name}`);
          }
        }

        // 🧠 RAZONAMIENTO CONTEXTUAL: Extraer teléfono usando lógica inteligente
        if (!phone || phone.trim() === '' || phone.trim() === '0' || phone.trim().toLowerCase() === 'no especificado') {
          phone = this.extractPhoneFromContext(customerMessage, conversationHistory, customerPhone);
          if (phone) {
            this.logger.log(`[CREATE_APPOINTMENT] 🧠 Teléfono inferido por razonamiento contextual: ${phone}`);
          }
        }

        // 🧠 RAZONAMIENTO CONTEXTUAL: Extraer especialidad del historial si no está especificada
        if (!specialty || specialty.trim() === '' || specialty.trim().toLowerCase() === 'no especificada' || specialty.trim().toLowerCase() === 'desconocido') {
          specialty = this.extractSpecialtyFromContext(customerMessage, conversationHistory);
          if (specialty) {
            this.logger.log(`[CREATE_APPOINTMENT] 🧠 Especialidad inferida por razonamiento contextual: ${specialty}`);
          }
        }

        // 🧠 RAZONAMIENTO CONTEXTUAL: Si no hay fecha pero sí hora, asumir que es para HOY
        if ((!dateStr || dateStr.trim() === '' || dateStr.trim().toLowerCase() === 'no especificado') && timeStr && timeStr.trim() !== '') {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
          this.logger.log(`[CREATE_APPOINTMENT] 🧠 Fecha no especificada, asumiendo HOY: ${dateStr}`);
        }

        // Validar que todos los campos obligatorios estén presentes y no estén vacíos
        const missingFields: string[] = [];

        if (!name || name.trim() === '' || name.trim().toLowerCase() === 'no especificado' || name.trim().toLowerCase() === 'desconocido') {
          missingFields.push('nombre');
        }
        if (!phone || phone.trim() === '' || phone.trim() === '0' || phone.trim().toLowerCase() === 'no especificado') {
          missingFields.push('teléfono');
        }
        if (!dateStr || dateStr.trim() === '' || dateStr.trim().toLowerCase() === 'no especificado') {
          missingFields.push('fecha');
        }
        if (!timeStr || timeStr.trim() === '' || timeStr.trim().toLowerCase() === 'no especificado') {
          missingFields.push('hora');
        }
        // Especialidad es opcional pero preferible tenerla
        if (!specialty || specialty.trim() === '' || specialty.trim().toLowerCase() === 'no especificada') {
          // No agregamos especialidad a missingFields porque puede ser opcional
          // Pero logueamos para debugging
          this.logger.warn(`[CREATE_APPOINTMENT] ⚠️ Especialidad no especificada, intentando inferir del contexto...`);
        }

        if (missingFields.length > 0) {
          this.logger.warn(`[CREATE_APPOINTMENT] ❌ Cita incompleta: faltan ${missingFields.join(', ')}`);
          this.logger.warn(`[CREATE_APPOINTMENT] Datos recibidos: nombre=${name}, teléfono=${phone}, fecha=${dateStr}, hora=${timeStr}`);
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, necesito algunos datos adicionales para agendar tu ${industryConfig.terminology}. Por favor, proporciona: ${missingFields.join(', ')}.`,
          );
          continue;
        }

        // Procesar fecha: convertir "hoy", "mañana" o fechas en otros formatos a YYYY-MM-DD
        let processedDate = dateStr.trim();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (processedDate.toLowerCase() === 'hoy') {
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          processedDate = `${year}-${month}-${day}`;
          this.logger.log(`Fecha "hoy" convertida a: ${processedDate}`);
        } else if (processedDate.toLowerCase() === 'mañana') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const year = tomorrow.getFullYear();
          const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
          const day = String(tomorrow.getDate()).padStart(2, '0');
          processedDate = `${year}-${month}-${day}`;
          this.logger.log(`Fecha "mañana" convertida a: ${processedDate}`);
        } else if (!processedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Intentar convertir otros formatos de fecha
          const datePatterns = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD (sin padding)
          ];

          let converted = false;
          for (const pattern of datePatterns) {
            const match = processedDate.match(pattern);
            if (match) {
              if (pattern.source.includes('YYYY') && pattern.source.startsWith('^\\d{4}')) {
                // Formato YYYY-MM-DD o YYYY/MM/DD
                const year = match[1];
                const month = String(match[2]).padStart(2, '0');
                const day = String(match[3]).padStart(2, '0');
                processedDate = `${year}-${month}-${day}`;
              } else {
                // Formato DD/MM/YYYY o DD-MM-YYYY
                const day = String(match[1]).padStart(2, '0');
                const month = String(match[2]).padStart(2, '0');
                const year = match[3];
                processedDate = `${year}-${month}-${day}`;
              }
              converted = true;
              this.logger.log(`Fecha convertida de "${dateStr}" a: ${processedDate}`);
              break;
            }
          }

          if (!converted) {
            this.logger.warn(`Formato de fecha inválido: ${dateStr}`);
            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, el formato de fecha no es válido. Por favor, proporciona una fecha en formato YYYY-MM-DD, DD/MM/YYYY, o di "hoy" o "mañana".`,
            );
            continue;
          }
        }

        // Validar formato de fecha final
        const dateMatch = processedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
          this.logger.warn(`Formato de fecha inválido después de procesamiento: ${processedDate}`);
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, el formato de fecha no es válido. Por favor, proporciona una fecha en formato YYYY-MM-DD o di "hoy" o "mañana".`,
          );
          continue;
        }

        // Procesar hora: convertir formato 12h a 24h si es necesario
        let processedTime = timeStr.trim();
        this.logger.log(`[Appointment] Procesando hora original: "${timeStr}"`);

        // Si la hora viene como "16" o "11" sin minutos, agregar ":00"
        if (/^\d{1,2}$/.test(processedTime)) {
          processedTime = `${processedTime.padStart(2, '0')}:00`;
          this.logger.log(`[Appointment] Hora sin minutos convertida: "${timeStr}" -> "${processedTime}"`);
        }
        // Si viene como "11:00 am", "11 am", "4 pm", "16:00", etc., convertir
        else if (!processedTime.match(/^\d{1,2}:\d{2}$/)) {
          // Intentar convertir formato 12h a 24h - acepta "11:00 am", "11 am", "11:00", etc.
          const time12hPattern = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM|de la mañana|de la tarde|de la noche)?$/i;
          const time12hMatch = processedTime.match(time12hPattern);

          if (time12hMatch) {
            let hour = parseInt(time12hMatch[1]);
            const minutes = time12hMatch[2] ? parseInt(time12hMatch[2]) : 0;
            const period = time12hMatch[3] ? time12hMatch[3].toLowerCase() : '';

            // Si tiene periodo (am/pm), convertir
            if (period) {
              if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
                if (hour !== 12) hour += 12;
              } else if (period.includes('am') || period.includes('mañana')) {
                if (hour === 12) hour = 0;
              }
            }
            // Si no tiene periodo y la hora es <= 12, asumir formato 24h (ya está correcto)
            // Si la hora es > 12, ya está en formato 24h

            processedTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            this.logger.log(`[Appointment] Hora convertida: "${timeStr}" -> "${processedTime}"`);
          } else {
            this.logger.warn(`[Appointment] Formato de hora inválido: ${timeStr}`);
            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, el formato de hora no es válido. Por favor, proporciona una hora en formato HH:MM (24 horas) o formato 12h (ej: "4 pm", "10 am", "11:00 am", "11 am").`,
            );
            continue;
          }
        }

        // Validar formato de hora final
        const timeMatch = processedTime.match(/^(\d{1,2}):(\d{2})$/);
        if (!timeMatch) {
          this.logger.warn(`Formato de hora inválido después de procesamiento: ${processedTime}`);
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, el formato de hora no es válido. Por favor, proporciona una hora en formato HH:MM (24 horas).`,
          );
          continue;
        }

        // Validar que la hora esté en rango válido (0-23 horas, 0-59 minutos)
        const hourValue = parseInt(timeMatch[1]);
        const minuteValue = parseInt(timeMatch[2]);
        if (hourValue < 0 || hourValue > 23 || minuteValue < 0 || minuteValue > 59) {
          this.logger.warn(`Hora fuera de rango: ${processedTime}`);
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, la hora proporcionada no es válida. Por favor, proporciona una hora válida (00:00 - 23:59).`,
          );
          continue;
        }

        // Extraer duración: primero del parámetro, luego del mensaje original si no está especificada
        let duration = parseInt(durationStr) || industryConfig.defaultDuration;

        // Si no se especificó duración en el comando, intentar extraerla del mensaje original
        if (!durationStr || durationStr === '0' || durationStr === industryConfig.defaultDuration.toString()) {
          const durationPatterns = [
            /(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)\s*(?:de\s*)?(?:consulta|atención|sesión|reunión)/i,
            /(\d+(?:\.\d+)?)\s*(?:hora|hr|h)\s*(?:de\s*)?(?:consulta|atención|sesión|reunión)/i,
            /necesito\s+(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)/i,
            /quiero\s+(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)/i,
            /(\d+)\s*(?:minutos?|mins?|min)/i,
          ];

          for (const pattern of durationPatterns) {
            const match = customerMessage.match(pattern);
            if (match) {
              const value = parseFloat(match[1]);
              // Si está en horas, convertir a minutos
              if (pattern.source.includes('hora') || pattern.source.includes('hr') || pattern.source.includes('\\bh')) {
                duration = Math.round(value * 60);
              } else {
                // Ya está en minutos
                duration = Math.round(value);
              }
              this.logger.log(`[Appointment] Duración extraída del mensaje: "${match[0]}" -> ${duration} minutos`);
              break;
            }
          }
        }

        // Asegurar que la duración sea válida
        if (duration <= 0 || duration > 480) {
          duration = industryConfig.defaultDuration;
          this.logger.warn(`[Appointment] Duración inválida, usando default: ${duration} minutos`);
        }

        this.logger.log(`Procesando cita: ${name}, ${phone}, ${processedDate}, ${processedTime}, ${duration}min`);

        // Construir fecha completa usando la fecha y hora procesadas
        const [year, month, day] = processedDate.split('-').map(Number);
        const [appointmentHourFromTime, appointmentMinuteFromTime] = processedTime.split(':').map(Number);
        const appointmentDate = new Date(year, month - 1, day, appointmentHourFromTime, appointmentMinuteFromTime);

        this.logger.log(`[Appointment] Fecha construida: ${appointmentDate.toISOString()}`);

        // Validar fecha
        if (isNaN(appointmentDate.getTime()) || appointmentDate < new Date()) {
          processedResponse = processedResponse.replace(
            match[0],
            'Lo siento, la fecha u horario proporcionado no es válido. Por favor, proporciona una fecha y hora válidas en el futuro.',
          );
          continue;
        }

        // Validar que la hora esté dentro del rango de horarios de atención
        const dayOfWeek = appointmentDate.getDay();
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dayName = dayNames[dayOfWeek];

        const appointmentHour = appointmentDate.getHours();
        const appointmentMinute = appointmentDate.getMinutes();
        const appointmentMinutes = appointmentHour * 60 + appointmentMinute;
        const appointmentEndMinutes = appointmentMinutes + duration;

        let isWithinHours = false;
        let startMinutes = 0;
        let endMinutes = 0;

        if (customBusinessHours && customBusinessHours[dayName]) {
          const dayConfig = customBusinessHours[dayName];
          if (dayConfig.enabled) {
            const [startH, startM] = dayConfig.start.split(':').map(Number);
            const [endH, endM] = dayConfig.end.split(':').map(Number);
            startMinutes = startH * 60 + startM;
            endMinutes = endH * 60 + endM;

            isWithinHours = appointmentMinutes >= startMinutes && appointmentEndMinutes <= endMinutes;

            this.logger.log(`[Appointment] Validación con horarios personalizados para ${dayName}:`);
            this.logger.log(`  Hora inicio: ${dayConfig.start} (${startMinutes} min)`);
            this.logger.log(`  Hora fin: ${dayConfig.end} (${endMinutes} min)`);
            this.logger.log(`  Cita inicio: ${appointmentHour}:${String(appointmentMinute).padStart(2, '0')} (${appointmentMinutes} min)`);
            this.logger.log(`  Cita fin: ${appointmentEndMinutes} min (duración: ${duration} min)`);
            this.logger.log(`  Dentro del rango: ${isWithinHours}`);
          } else {
            // Día deshabilitado
            this.logger.warn(`[Appointment] Día ${dayName} está deshabilitado`);
            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, ese día (${dayName}) no tenemos horarios de atención disponibles. Por favor, elige otro día.`,
            );
            continue;
          }
        } else {
          // Usar horarios por defecto del rubro
          startMinutes = industryConfig.startHour * 60;
          endMinutes = industryConfig.endHour * 60;

          isWithinHours = appointmentMinutes >= startMinutes && appointmentEndMinutes <= endMinutes;

          this.logger.log(`[Appointment] Validación con horarios por defecto del rubro:`);
          this.logger.log(`  Hora inicio: ${industryConfig.startHour}:00 (${startMinutes} min)`);
          this.logger.log(`  Hora fin: ${industryConfig.endHour}:00 (${endMinutes} min)`);
          this.logger.log(`  Cita inicio: ${appointmentHour}:${String(appointmentMinute).padStart(2, '0')} (${appointmentMinutes} min)`);
          this.logger.log(`  Cita fin: ${appointmentEndMinutes} min (duración: ${duration} min)`);
          this.logger.log(`  Dentro del rango: ${isWithinHours} (${appointmentMinutes} >= ${startMinutes} && ${appointmentEndMinutes} <= ${endMinutes})`);
        }

        if (!isWithinHours) {
          this.logger.warn(`[Appointment] Horario fuera de rango. Cita: ${appointmentHour}:${String(appointmentMinute).padStart(2, '0')}, Rango: ${startMinutes}-${endMinutes} min`);
          // Buscar horarios disponibles ese día
          const availableSlots = await this.appointmentsService.findAvailableSlots(
            businessId,
            appointmentDate,
            duration,
            industryConfig.startHour,
            industryConfig.endHour,
            (industryConfig as any).customBusinessHours || customBusinessHours,
          );

          if (availableSlots.length > 0) {
            const slotsText = availableSlots.slice(0, 5).map((slot) => {
              return slot.toLocaleString('es-ES', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }).join(', ');

            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, ese horario está fuera de nuestro rango de atención o no está disponible para la ${industryConfig.terminology}. Horarios disponibles: ${slotsText}. ¿Cuál prefieres?`,
            );
          } else {
            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, ese día no hay horarios disponibles para la ${industryConfig.terminology}. ¿Te gustaría elegir otro día?`,
            );
          }
          continue;
        }

        // Validar que no haya conflictos
        const isValid = await this.appointmentsService.validateNoConflicts(
          businessId,
          appointmentDate,
          duration,
        );

        this.logger.log(`Validación de conflictos: ${isValid ? 'OK' : 'CONFLICTO'}`);

        if (!isValid) {
          // Buscar horarios disponibles ese día usando horarios del rubro
          const availableSlots = await this.appointmentsService.findAvailableSlots(
            businessId,
            appointmentDate,
            duration,
            industryConfig.startHour,
            industryConfig.endHour,
            (industryConfig as any).customBusinessHours || customBusinessHours,
          );

          if (availableSlots.length > 0) {
            const slotsText = availableSlots.slice(0, 5).map((slot) => {
              return slot.toLocaleString('es-ES', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }).join(', ');

            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, ese horario no está disponible para la ${industryConfig.terminology}. Horarios disponibles: ${slotsText}. ¿Cuál prefieres?`,
            );
          } else {
            processedResponse = processedResponse.replace(
              match[0],
              `Lo siento, ese día no hay horarios disponibles para la ${industryConfig.terminology}. ¿Te gustaría elegir otro día?`,
            );
          }
          continue;
        }

        // Normalizar el teléfono antes de guardar (remover espacios, guiones, etc.)
        const normalizedPhoneForSave = phone.replace(/[^\d]/g, '').trim();
        const specialtyValue = specialty?.trim() || null;

        this.logger.log(`[CREATE_APPOINTMENT] ⚠️ INICIANDO CREACIÓN DE CITA:`);
        this.logger.log(`  - BusinessId: ${businessId}`);
        this.logger.log(`  - Nombre: ${name.trim()}`);
        this.logger.log(`  - Teléfono: ${normalizedPhoneForSave}`);
        this.logger.log(`  - Fecha: ${appointmentDate.toISOString()}`);
        this.logger.log(`  - Duración: ${duration} minutos`);
        this.logger.log(`  - Especialidad: ${specialtyValue || 'N/A'}`);

        const appointmentData = {
          customerName: name.trim(),
          customerPhone: normalizedPhoneForSave,
          appointmentDate,
          duration,
          specialty: specialtyValue,
          notes: notes?.trim() || null,
          status: 'PENDING',
        };

        this.logger.log(`[CREATE_APPOINTMENT] Datos a guardar:`, JSON.stringify(appointmentData, null, 2));

        let appointment;
        try {
          appointment = await this.appointmentsService.create(businessId, appointmentData);

          this.logger.log(`[CREATE_APPOINTMENT] ✅ CITA CREADA EXITOSAMENTE EN BD:`);
          this.logger.log(`  - ID: ${appointment.id}`);
          this.logger.log(`  - BusinessId: ${businessId}`);
          this.logger.log(`  - Nombre: ${appointment.customerName}`);
          this.logger.log(`  - Teléfono: ${appointment.customerPhone}`);
          this.logger.log(`  - Fecha: ${appointment.appointmentDate}`);
          this.logger.log(`  - Estado: ${appointment.status}`);

          // Verificar que realmente se guardó consultando la BD
          const verifyAppointment = await this.appointmentsService.findOne(appointment.id);
          if (verifyAppointment) {
            this.logger.log(`[CREATE_APPOINTMENT] ✅ VERIFICACIÓN: Cita encontrada en BD con ID ${appointment.id}`);
          } else {
            this.logger.error(`[CREATE_APPOINTMENT] ❌ ERROR: Cita NO encontrada en BD después de crear`);
          }
        } catch (error: any) {
          this.logger.error(`[CREATE_APPOINTMENT] ❌ ERROR AL CREAR CITA:`, error);
          this.logger.error(`[CREATE_APPOINTMENT] Stack:`, error.stack);
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, hubo un error al registrar tu ${industryConfig.terminology}. Por favor, intenta nuevamente o contacta con atención al cliente.`,
          );
          continue;
        }

        const formattedDate = appointmentDate.toLocaleString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const specialtyText = specialtyValue ? `\n🏥 Especialidad: ${specialtyValue}` : '';
        const endTime = new Date(appointmentDate);
        endTime.setMinutes(endTime.getMinutes() + duration);
        const endTimeStr = endTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const paymentLinkText = isClinic 
          ? `\n\n💳 Para asegurar tu consulta, realiza el pago anticipado aquí: https://pagos.nexorium.com/checkout?appointmentId=${appointment.id}` 
          : '';

        processedResponse = processedResponse.replace(
          match[0],
          `✅ Cita registrada exitosamente.\n\n✨ Detalle de tu cita:\n📅 Fecha: ${formattedDate}\n⏰ Hora: ${appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${endTimeStr}\n⏱️ Duración: ${duration} minutos${specialtyText}\n👤 Cliente: ${name}\n📞 Teléfono: ${normalizedPhoneForSave}\n📝 Notas: ${notes || 'Ninguna'}\n\nGracias por elegir ${businessName}. ¡Te esperamos!${paymentLinkText}`,
        );
      } catch (error: any) {
        this.logger.error('Error creating appointment:', error);
        processedResponse = processedResponse.replace(
          match[0],
          error.message || `Hubo un error al agendar la ${industryConfig.terminology}. Por favor, intenta nuevamente.`,
        );
      }
    }

    // Procesar [CHECK_MY_APPOINTMENTS:telefono] - Consultar citas del cliente
    const checkMyAppointmentsPattern = /\[CHECK_MY_APPOINTMENTS:([^\]]+)\]/gi;
    while ((match = checkMyAppointmentsPattern.exec(response)) !== null) {
      try {
        let phone = match[1].trim();
        let customerName = '';

        // Intentar extraer nombre del mensaje del cliente o historial si está disponible
        if (customerMessage) {
          // Buscar patrones como "mi nombre es X", "soy X", "me llamo X"
          const namePatterns = [
            /(?:mi\s+nombre\s+es|soy|me\s+llamo|nombre:)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
            /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/, // Nombre completo
          ];

          for (const pattern of namePatterns) {
            const nameMatch = customerMessage.match(pattern);
            if (nameMatch) {
              customerName = nameMatch[1].trim();
              this.logger.log(`Nombre extraído del mensaje: ${customerName}`);
              break;
            }
          }
        }

        // Buscar el teléfono en el historial de conversación primero
        let phoneFromHistory = '';
        if (conversationHistory) {
          // Buscar patrones de teléfono en el historial (números de 7-15 dígitos)
          const phonePattern = /(\d{7,15})/g;
          const historyMatches = conversationHistory.match(phonePattern);
          if (historyMatches && historyMatches.length > 0) {
            // Usar el último número mencionado en el historial
            phoneFromHistory = historyMatches[historyMatches.length - 1];
            this.logger.log(`Teléfono encontrado en historial: ${phoneFromHistory}`);
          }

          // También buscar nombre en el historial
          if (!customerName && conversationHistory) {
            const namePatterns = [
              /(?:nombre|cliente):\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
            ];
            for (const pattern of namePatterns) {
              const nameMatch = conversationHistory.match(pattern);
              if (nameMatch) {
                customerName = nameMatch[1].trim();
                this.logger.log(`Nombre encontrado en historial: ${customerName}`);
                break;
              }
            }
          }
        }

        // Prioridad: 1) teléfono del cliente actual, 2) teléfono del historial, 3) teléfono del mensaje
        if (customerPhone) {
          const normalizedCustomerPhone = customerPhone.split('@')[0].trim();
          phone = normalizedCustomerPhone;
          this.logger.log(`Usando teléfono del cliente actual para consultar citas: ${phone}`);
        } else if (phoneFromHistory) {
          phone = phoneFromHistory;
          this.logger.log(`Usando teléfono del historial de conversación: ${phone}`);
        } else if (!phone || phone === '0' || phone.toLowerCase() === 'no especificado') {
          processedResponse = processedResponse.replace(
            match[0],
            'Para verificar tu cita, necesito tu número de teléfono. ¿Cuál es?',
          );
          continue;
        }

        // Normalizar el teléfono para búsqueda
        const normalizedPhone = phone.split('@')[0].trim();
        this.logger.log(`[CHECK_MY_APPOINTMENTS] Consultando BD para teléfono: ${normalizedPhone}${customerName ? ` y nombre: ${customerName}` : ''}`);

        // Buscar citas en la BD: si tenemos nombre y teléfono, usar búsqueda combinada; si solo teléfono, usar búsqueda por teléfono
        let appointments;
        try {
          if (customerName && customerName.trim()) {
            this.logger.log(`[CHECK_MY_APPOINTMENTS] Buscando en BD por nombre "${customerName}" y teléfono "${normalizedPhone}"`);
            appointments = await this.appointmentsService.findByNameAndPhone(businessId, customerName, normalizedPhone);
            this.logger.log(`[CHECK_MY_APPOINTMENTS] BD retornó ${appointments.length} citas por nombre y teléfono`);
          } else {
            this.logger.log(`[CHECK_MY_APPOINTMENTS] Buscando en BD por teléfono "${normalizedPhone}"`);
            appointments = await this.appointmentsService.findByPhone(businessId, normalizedPhone);
            this.logger.log(`[CHECK_MY_APPOINTMENTS] BD retornó ${appointments.length} citas por teléfono`);
          }

          // Log detallado de las citas encontradas
          if (appointments.length > 0) {
            appointments.forEach((apt, idx) => {
              this.logger.log(`[CHECK_MY_APPOINTMENTS] Cita ${idx + 1}: ID=${apt.id}, Cliente="${apt.customerName}", Teléfono="${apt.customerPhone}", Fecha=${apt.appointmentDate}, Estado=${apt.status}`);
            });
          } else {
            this.logger.warn(`[CHECK_MY_APPOINTMENTS] No se encontraron citas en BD para teléfono "${normalizedPhone}"${customerName ? ` y nombre "${customerName}"` : ''}`);
          }
        } catch (error) {
          this.logger.error(`[CHECK_MY_APPOINTMENTS] Error consultando BD:`, error);
          appointments = [];
        }
        const upcomingAppointments = appointments.filter(apt =>
          new Date(apt.appointmentDate) >= new Date() &&
          apt.status !== 'CANCELLED' &&
          apt.status !== 'COMPLETED'
        );

        if (upcomingAppointments.length > 0) {
          // Buscar información sobre especialistas y salas usando RAG
          let specialistInfo = '';
          let roomInfo = '';

          if (this.ragService && this.isEnabled && this.embeddingService && this.vectorService) {
            try {
              // Buscar información sobre especialistas/doctores y salas usando RAG
              const specialistQuery = `especialista doctor médico sala consulta ubicación consultorio`;
              const specialistEmbedding = await this.embeddingService.createEmbedding(specialistQuery);
              const specialistResults = await this.vectorService.search(
                `business_${businessId}`,
                specialistEmbedding,
                5,
                {
                  must: [
                    {
                      key: 'businessId',
                      match: { value: businessId },
                    },
                  ],
                }
              );

              if (specialistResults && specialistResults.length > 0) {
                const specialistContext = specialistResults.map(r => r.content).join(' ');
                // Extraer información relevante sobre especialistas y salas
                const specialistMatch = specialistContext.match(/(?:doctor|médico|especialista|dr\.?|dra\.?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i);
                const roomMatch = specialistContext.match(/(?:sala|consultorio|oficina|habitación)\s*(?:de\s*)?(?:consultas?|atención)?\s*(?:número|#|n°)?\s*(\d+|[A-Z]+)/i);

                if (specialistMatch) {
                  specialistInfo = specialistMatch[1];
                  this.logger.log(`[Appointment] Especialista encontrado en RAG: ${specialistInfo}`);
                }
                if (roomMatch) {
                  roomInfo = roomMatch[1];
                  this.logger.log(`[Appointment] Sala encontrada en RAG: ${roomInfo}`);
                }
              }
            } catch (error) {
              this.logger.warn('Error buscando información de especialistas/salas con RAG:', error);
            }
          }

          // Formato elegante y profesional para los detalles de la cita
          let appointmentsText = `✨ *Detalle de tu ${industryConfig.terminology}*\n\n`;

          upcomingAppointments.forEach((apt, index) => {
            const date = new Date(apt.appointmentDate);
            const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
            const dayNumber = date.getDate();
            const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
            const year = date.getFullYear();
            const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            // Calcular hora de fin
            const endTime = new Date(date);
            endTime.setMinutes(endTime.getMinutes() + apt.duration);
            const endTimeStr = endTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            const statusText = apt.status === 'PENDING'
              ? '⏳ Pendiente'
              : apt.status === 'CONFIRMED'
                ? '✅ Confirmada'
                : apt.status;

            appointmentsText += `📅 *${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNumber} de ${monthName} ${year}*\n`;
            appointmentsText += `🕐 *Horario:* ${time} - ${endTimeStr}\n`;
            appointmentsText += `⏱️ *Duración:* ${apt.duration} minutos (${Math.round(apt.duration / 60 * 10) / 10} horas)\n`;
            appointmentsText += `👤 *Cliente:* ${apt.customerName}\n`;
            appointmentsText += `📱 *Teléfono:* ${apt.customerPhone}\n`;
            appointmentsText += `📊 *Estado:* ${statusText}\n`;

            if (specialistInfo) {
              appointmentsText += `👨‍⚕️ *Especialista:* ${specialistInfo}\n`;
            }

            if (apt.notes) {
              appointmentsText += `📝 *Notas:* ${apt.notes}\n`;
            }

            appointmentsText += `\n📍 *Instrucciones:*\n`;
            if (roomInfo) {
              appointmentsText += `Al llegar, pregunta en asistencia por la ubicación de la sala de consulta ${roomInfo} del ${specialistInfo || 'especialista'}.\n`;
            } else if (specialistInfo) {
              appointmentsText += `Al llegar, pregunta en asistencia por la ubicación de la sala de consulta del ${specialistInfo}.\n`;
            } else {
              appointmentsText += `Al llegar, pregunta en asistencia por la ubicación de la sala de consulta.\n`;
            }
            appointmentsText += `Te esperamos puntualmente. Gracias por tu preferencia. 🙏\n`;

            if (index < upcomingAppointments.length - 1) {
              appointmentsText += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            }
          });

          appointmentsText += `\n💼 *${businessName}*\n`;

          processedResponse = processedResponse.replace(match[0], appointmentsText);
        } else {
          const pastAppointments = appointments.filter(apt =>
            new Date(apt.appointmentDate) < new Date() ||
            apt.status === 'CANCELLED' ||
            apt.status === 'COMPLETED'
          );

          if (pastAppointments.length > 0) {
            processedResponse = processedResponse.replace(
              match[0],
              `No tienes ${industryConfig.terminology} próximas registradas. ¿Te gustaría agendar una nueva?`,
            );
          } else {
            processedResponse = processedResponse.replace(
              match[0],
              `No tienes ${industryConfig.terminology} registradas. ¿Te gustaría agendar una?`,
            );
          }
        }
      } catch (error: any) {
        this.logger.error('Error checking my appointments:', error);
        processedResponse = processedResponse.replace(
          match[0],
          'Hubo un error al consultar tus citas. Por favor, intenta nuevamente.',
        );
      }
    }

    // Procesar [CHECK_APPOINTMENTS_BY_SPECIALTY:fecha:especialidad] - Consultar horarios por especialidad
    const checkBySpecialtyPattern = /\[CHECK_APPOINTMENTS_BY_SPECIALTY:([^:]+):([^\]]+)\]/gi;
    while ((match = checkBySpecialtyPattern.exec(response)) !== null) {
      try {
        const dateStr = match[1].trim();
        const specialty = match[2].trim();
        const [year, month, day] = dateStr.split('-').map(Number);
        const checkDate = new Date(year, month - 1, day);

        if (isNaN(checkDate.getTime())) {
          processedResponse = processedResponse.replace(
            match[0],
            'Fecha inválida. Por favor, proporciona una fecha en formato YYYY-MM-DD.',
          );
          continue;
        }

        this.logger.log(`[CHECK_APPOINTMENTS_BY_SPECIALTY] Buscando horarios para especialidad "${specialty}" el ${dateStr}`);

        const availableSlots = await this.appointmentsService.findAvailableSlotsBySpecialty(
          businessId,
          checkDate,
          specialty,
          industryConfig.defaultDuration,
          industryConfig.startHour,
          industryConfig.endHour,
          (industryConfig as any).customBusinessHours || customBusinessHours,
        );

        if (availableSlots.length > 0) {
          const slotsText = availableSlots.slice(0, 10).map((slot) => {
            return slot.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          }).join(', ');

          const formattedDate = checkDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          processedResponse = processedResponse.replace(
            match[0],
            `Perfecto, ya verifiqué los horarios disponibles para la especialidad de ${specialty} el ${formattedDate}:\n${slotsText}\n\n¿Cuál prefieres?`,
          );
        } else {
          const formattedDate = checkDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, no hay horarios disponibles para la especialidad de ${specialty} el ${formattedDate}. ¿Te gustaría elegir otro día u otra especialidad?`,
          );
        }
      } catch (error: any) {
        this.logger.error('Error checking appointments by specialty:', error);
        processedResponse = processedResponse.replace(
          match[0],
          'Hubo un error al consultar los horarios disponibles para esa especialidad.',
        );
      }
    }

    // Procesar [CHECK_APPOINTMENTS:fecha] - Consultar horarios disponibles
    const checkPattern = /\[CHECK_APPOINTMENTS:([^\]]+)\]/gi;
    while ((match = checkPattern.exec(response)) !== null) {
      try {
        const dateStr = match[1].trim();
        const [year, month, day] = dateStr.split('-').map(Number);
        const checkDate = new Date(year, month - 1, day);

        if (isNaN(checkDate.getTime())) {
          processedResponse = processedResponse.replace(
            match[0],
            'Fecha inválida. Por favor, proporciona una fecha en formato YYYY-MM-DD.',
          );
          continue;
        }

        const availableSlots = await this.appointmentsService.findAvailableSlots(
          businessId,
          checkDate,
          industryConfig.defaultDuration,
          industryConfig.startHour,
          industryConfig.endHour,
          (industryConfig as any).customBusinessHours || customBusinessHours,
        );

        if (availableSlots.length > 0) {
          const slotsText = availableSlots.slice(0, 10).map((slot) => {
            return slot.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          }).join(', ');

          const formattedDate = checkDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          processedResponse = processedResponse.replace(
            match[0],
            `Horarios disponibles para ${industryConfig.terminology} el ${formattedDate}:\n${slotsText}\n\n¿Cuál prefieres?`,
          );
        } else {
          const formattedDate = checkDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          processedResponse = processedResponse.replace(
            match[0],
            `Lo siento, no hay horarios disponibles para ${industryConfig.terminology} el ${formattedDate}. ¿Te gustaría elegir otro día?`,
          );
        }
      } catch (error: any) {
        this.logger.error('Error checking appointments:', error);
        processedResponse = processedResponse.replace(
          match[0],
          'Hubo un error al consultar los horarios disponibles.',
        );
      }
    }

    // Procesar [FORWARD_EVIDENCE:fileId:type:descripción] - Reenviar evidencias al especialista
    const forwardEvidencePattern = /\[FORWARD_EVIDENCE:([^:]+):([^:]+):([^\]]+)\]/gi;
    while ((match = forwardEvidencePattern.exec(response)) !== null) {
      try {
        const [, fileId, type, description] = match;
        this.logger.log(`[FORWARD_EVIDENCE] Reenviando evidencia ${fileId} de tipo ${type} con descripción: ${description}`);
        // Este comando se procesará en whatsapp-web.service.ts cuando se detecte evidencia
        // Por ahora, solo lo marcamos en la respuesta
        processedResponse = processedResponse.replace(
          match[0],
          `✅ Tus evidencias están siendo evaluadas por el especialista. Para más información, contacta con la asistencia médica.`,
        );
      } catch (error: any) {
        this.logger.error('Error processing forward evidence:', error);
      }
    }

    // Procesar [SEND_AUDIO_RESPONSE:mensaje] - Responder en audio
    const audioResponsePattern = /\[SEND_AUDIO_RESPONSE:([^\]]+)\]/gi;
    while ((match = audioResponsePattern.exec(response)) !== null) {
      try {
        const [, message] = match;
        this.logger.log(`[SEND_AUDIO_RESPONSE] Generando respuesta en audio: ${message}`);
        // Este comando se procesará en whatsapp-web.service.ts
        // Por ahora, solo lo marcamos en la respuesta
        processedResponse = processedResponse.replace(
          match[0],
          message, // El mensaje se enviará como texto, pero el sistema puede convertirlo a audio
        );
      } catch (error: any) {
        this.logger.error('Error processing audio response:', error);
      }
    }

    // Procesar [BUSCAR_NUMERO_ASISTENCIA] - Buscar número de asistencia en archivos
    const buscarNumeroPattern = /\[BUSCAR_NUMERO_ASISTENCIA\]/gi;
    while ((match = buscarNumeroPattern.exec(response)) !== null) {
      try {
        this.logger.log(`[BUSCAR_NUMERO_ASISTENCIA] Buscando número de asistencia en archivos`);

        // Buscar en knowledge chunks información sobre números de asistencia
        const assistanceChunks = await this.prisma.knowledgeChunk.findMany({
          where: {
            businessId,
            OR: [
              { content: { contains: 'asistencia', mode: 'insensitive' } },
              { content: { contains: 'teléfono', mode: 'insensitive' } },
              { content: { contains: 'contacto', mode: 'insensitive' } },
              { content: { contains: 'número', mode: 'insensitive' } },
              { content: { contains: 'llamar', mode: 'insensitive' } },
            ],
          },
          take: 5,
        });

        let assistanceNumber = null;
        if (assistanceChunks.length > 0) {
          // Buscar patrones de números de teléfono en el contenido
          const phonePattern = /(\+?\d{1,4}[\s-]?)?(\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4})/g;
          for (const chunk of assistanceChunks) {
            const matches = chunk.content.match(phonePattern);
            if (matches && matches.length > 0) {
              assistanceNumber = matches[0].trim();
              break;
            }
          }
        }

        // También buscar en botConfig
        const botConfig = await this.prisma.botConfig.findUnique({
          where: { businessId },
          select: { reviewerDestination: true },
        });

        const finalNumber = assistanceNumber || botConfig?.reviewerDestination || 'No disponible';

        processedResponse = processedResponse.replace(
          match[0],
          `Número de asistencia médica: ${finalNumber}`,
        );
      } catch (error: any) {
        this.logger.error('Error searching assistance number:', error);
        processedResponse = processedResponse.replace(
          match[0],
          'Por favor, contacta con la asistencia médica para más información.',
        );
      }
    }

    this.logger.log(`[processAppointmentRequests] ✅ FINALIZADO PROCESAMIENTO DE CITAS`);
    this.logger.log(`[processAppointmentRequests] Respuesta procesada (primeros 500 chars): ${processedResponse.substring(0, 500)}`);

    return processedResponse;
  }

  /**
   * 🧠 RAZONAMIENTO CONTEXTUAL: Extrae nombre del contexto usando lógica inteligente
   * Analiza el mensaje y el historial para inferir si hay un nombre presente
   */
  private extractNameFromContext(currentMessage: string, conversationHistory?: string): string | null {
    // Analizar el mensaje actual primero
    const messageToAnalyze = currentMessage?.trim() || '';

    // Si el mensaje es solo texto que parece un nombre (2-4 palabras, mayúsculas iniciales, sin números)
    if (messageToAnalyze) {
      const words = messageToAnalyze.split(/\s+/);
      // Si tiene 2-5 palabras (aumentado para nombres como "Enita cruzado valdivia"), todas con mayúscula inicial, y no contiene números ni signos especiales
      if (words.length >= 2 && words.length <= 5) {
        const isLikelyName = words.every(word => {
          const trimmed = word.trim();
          // Debe empezar con mayúscula y contener solo letras (puede tener acentos)
          return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(trimmed) && trimmed.length >= 2;
        });

        // No debe contener números, signos de interrogación, exclamación, etc.
        const hasNoSpecialChars = !/[0-9?!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/]/.test(messageToAnalyze);

        if (isLikelyName && hasNoSpecialChars) {
          this.logger.log(`[extractNameFromContext] 🧠 Inferido como nombre por estructura: ${messageToAnalyze}`);
          return messageToAnalyze;
        }
      }

      // MEJORA: Buscar patrones explícitos de nombre con más variaciones
      const explicitPatterns = [
        /(?:mi\s+nombre\s+es|soy|me\s+llamo|nombre:)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i,
        /(?:mi\s+nombre\s+es|soy|me\s+llamo|nombre:)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+)/i, // También aceptar minúsculas
        /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)$/,
        /nombre[:\s]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i,
      ];

      for (const pattern of explicitPatterns) {
        const match = messageToAnalyze.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim();
          // Capitalizar primera letra de cada palabra
          const capitalized = extracted.split(/\s+/).map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
          if (capitalized.length >= 3) {
            this.logger.log(`[extractNameFromContext] 🧠 Extraído por patrón explícito: ${capitalized}`);
            return capitalized;
          }
        }
      }
    }

    // Si no se encontró en el mensaje actual, buscar en el historial
    if (conversationHistory) {
      // Buscar en el historial mensajes del cliente que parezcan nombres
      const historyLines = conversationHistory.split('\n');
      for (const line of historyLines.reverse()) { // Empezar desde el más reciente
        if (line.includes('Cliente:')) {
          const clientMessage = line.replace(/^Cliente:\s*/, '').trim();
          if (clientMessage) {
            const words = clientMessage.split(/\s+/);
            if (words.length >= 2 && words.length <= 5) {
              const isLikelyName = words.every(word => {
                const trimmed = word.trim();
                return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(trimmed) && trimmed.length >= 2;
              });

              const hasNoSpecialChars = !/[0-9?!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/]/.test(clientMessage);

              if (isLikelyName && hasNoSpecialChars && !clientMessage.toLowerCase().includes('cita') && !clientMessage.toLowerCase().includes('necesito')) {
                this.logger.log(`[extractNameFromContext] 🧠 Inferido del historial: ${clientMessage}`);
                return clientMessage;
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * 🧠 RAZONAMIENTO CONTEXTUAL: Extrae teléfono del contexto usando lógica inteligente
   * Analiza el mensaje, historial y teléfono del cliente para inferir el teléfono correcto
   */
  private extractPhoneFromContext(currentMessage: string, conversationHistory?: string, customerPhone?: string): string | null {
    // Prioridad 1: Usar el teléfono del cliente actual (más confiable)
    if (customerPhone) {
      const normalizedPhone = customerPhone.split('@')[0].trim().replace(/[^\d]/g, '');
      if (normalizedPhone && normalizedPhone.length >= 8) {
        this.logger.log(`[extractPhoneFromContext] 🧠 Usando teléfono del cliente actual: ${normalizedPhone}`);
        return normalizedPhone;
      }
    }

    // Prioridad 2: Analizar el mensaje actual
    if (currentMessage) {
      // Si el mensaje es solo números (8-15 dígitos), es muy probable que sea un teléfono
      const onlyNumbers = currentMessage.trim().replace(/[^\d]/g, '');
      if (onlyNumbers.length >= 8 && onlyNumbers.length <= 15) {
        // Verificar que no sea una fecha o hora
        const isNotDate = !/^\d{4}$/.test(onlyNumbers) && !/^\d{2}$/.test(onlyNumbers);
        if (isNotDate) {
          this.logger.log(`[extractPhoneFromContext] 🧠 Inferido del mensaje actual (solo números): ${onlyNumbers}`);
          return onlyNumbers;
        }
      }

      // MEJORA: Buscar patrones explícitos de teléfono con más variaciones
      const phonePatterns = [
        /(?:mi\s+teléfono\s+es|mi\s+número\s+es|teléfono:|número\s+de\s+teléfono:)\s*(\d{8,15})/i,
        /(?:mi\s+teléfono\s+es|mi\s+número\s+es)\s+(\d{1,3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/i, // Formato con espacios/guiones
        /(\d{8,15})/,
      ];

      for (const pattern of phonePatterns) {
        const match = currentMessage.match(pattern);
        if (match) {
          const foundPhone = (match[1] || match[0]).replace(/[^\d]/g, '');
          // Validar que no sea una fecha (YYYYMMDD) o hora (HHMM)
          const isNotDate = !/^\d{8}$/.test(foundPhone) || parseInt(foundPhone.substring(0, 4)) < 1900 || parseInt(foundPhone.substring(0, 4)) > 2100;
          if (foundPhone.length >= 8 && foundPhone.length <= 15 && isNotDate) {
            this.logger.log(`[extractPhoneFromContext] 🧠 Extraído por patrón del mensaje: ${foundPhone}`);
            return foundPhone;
          }
        }
      }
    }

    // Prioridad 3: Buscar en el historial
    if (conversationHistory) {
      const phonePatterns = [
        /(?:mi\s+teléfono\s+es|mi\s+número\s+es|teléfono:)\s*(\d{8,15})/i,
        /Cliente:\s*(\d{8,15})/,
      ];

      for (const pattern of phonePatterns) {
        const match = conversationHistory.match(pattern);
        if (match) {
          const foundPhone = (match[1] || match[0]).replace(/[^\d]/g, '');
          if (foundPhone.length >= 8 && foundPhone.length <= 15) {
            this.logger.log(`[extractPhoneFromContext] 🧠 Extraído del historial: ${foundPhone}`);
            return foundPhone;
          }
        }
      }
    }

    return null;
  }

  /**
   * 🧠 RAZONAMIENTO CONTEXTUAL: Extrae especialidad del contexto usando lógica inteligente
   * Analiza el mensaje y el historial para inferir si hay una especialidad mencionada
   */
  private extractSpecialtyFromContext(currentMessage: string, conversationHistory?: string): string | null {
    // Lista de especialidades médicas comunes
    const specialties = [
      'Cardiología', 'Cardiologia', 'Cardiólogo', 'Cardiologo', 'cardiólogo', 'cardióloga',
      'Pediatría', 'Pediatria', 'Pediatra', 'pediatra',
      'Neurología', 'Neurologia', 'Neurólogo', 'Neurologo', 'neurólogo',
      'Urología', 'Urologia', 'Urólogo', 'Urologo', 'urólogo',
      'Medicina General', 'Medicina general', 'General', 'medicina general',
      'Dermatología', 'Dermatologia', 'Dermatólogo', 'Dermatologo',
      'Ginecología', 'Ginecologia', 'Ginecólogo', 'Ginecologo',
      'Oftalmología', 'Oftalmologia', 'Oftalmólogo', 'Oftalmologo',
      'Otorrinolaringología', 'Otorrinolaringologia', 'ORL',
      'Psiquiatría', 'Psiquiatria', 'Psiquiatra',
      'Traumatología', 'Traumatologia', 'Traumatólogo', 'Traumatologo',
      'Endocrinología', 'Endocrinologia', 'Endocrinólogo', 'Endocrinologo',
    ];

    // Analizar el mensaje actual primero
    if (currentMessage) {
      const messageLower = currentMessage.toLowerCase();
      for (const spec of specialties) {
        if (messageLower.includes(spec.toLowerCase())) {
          // Normalizar: usar la versión con mayúscula inicial
          const normalized = spec.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
          this.logger.log(`[extractSpecialtyFromContext] 🧠 Especialidad encontrada en mensaje actual: ${normalized}`);
          return normalized;
        }
      }

      // Buscar patrones como "especialista en X" o "necesito ayuda con X"
      const specialtyPatterns = [
        /(?:especialista|especialidad|médico|doctor|doctora)\s+(?:en|de)\s+([a-záéíóúñ\s]+)/i,
        /(?:necesito|quiero|busco)\s+(?:ayuda|atención|consulta)\s+(?:con|de|en)\s+(?:una|un)\s+(?:especialista|especialidad|médico|doctor|doctora)\s+(?:en|de)\s+([a-záéíóúñ\s]+)/i,
      ];

      for (const pattern of specialtyPatterns) {
        const match = currentMessage.match(pattern);
        if (match && match[1]) {
          const found = match[1].trim();
          // Verificar si coincide con alguna especialidad conocida
          for (const spec of specialties) {
            if (found.toLowerCase().includes(spec.toLowerCase()) || spec.toLowerCase().includes(found.toLowerCase())) {
              const normalized = spec.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ');
              this.logger.log(`[extractSpecialtyFromContext] 🧠 Especialidad extraída por patrón del mensaje: ${normalized}`);
              return normalized;
            }
          }
        }
      }
    }

    // Si no se encontró en el mensaje actual, buscar en el historial
    if (conversationHistory) {
      const historyLower = conversationHistory.toLowerCase();
      for (const spec of specialties) {
        if (historyLower.includes(spec.toLowerCase())) {
          // Normalizar: usar la versión con mayúscula inicial
          const normalized = spec.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
          this.logger.log(`[extractSpecialtyFromContext] 🧠 Especialidad encontrada en historial: ${normalized}`);
          return normalized;
        }
      }

      // Buscar patrones en el historial también
      const specialtyPatterns = [
        /(?:especialista|especialidad|médico|doctor|doctora)\s+(?:en|de)\s+([a-záéíóúñ\s]+)/i,
        /(?:necesito|quiero|busco)\s+(?:ayuda|atención|consulta)\s+(?:con|de|en)\s+(?:una|un)\s+(?:especialista|especialidad|médico|doctor|doctora)\s+(?:en|de)\s+([a-záéíóúñ\s]+)/i,
      ];

      for (const pattern of specialtyPatterns) {
        const match = conversationHistory.match(pattern);
        if (match && match[1]) {
          const found = match[1].trim();
          for (const spec of specialties) {
            if (found.toLowerCase().includes(spec.toLowerCase()) || spec.toLowerCase().includes(found.toLowerCase())) {
              const normalized = spec.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ');
              this.logger.log(`[extractSpecialtyFromContext] 🧠 Especialidad extraída por patrón del historial: ${normalized}`);
              return normalized;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Busca archivo por nombre, tags, descripción o contenido (para QR de pago, etc.)
   */
  private async findFileByNameOrContent(businessId: string, searchTerm: string): Promise<string | null> {
    try {
      const normalizedSearch = searchTerm.toLowerCase().trim();

      // Términos de búsqueda relacionados con QR y pago
      const qrPaymentTerms = ['qr', 'pago', 'payment', 'codigo', 'código', 'yape', 'plin', 'transferencia', 'deposito'];
      const isQrPaymentSearch = qrPaymentTerms.some(term => normalizedSearch.includes(term));

      // Términos de búsqueda relacionados con videos informativos
      const videoInfoTerms = ['video', 'informativo', 'información', 'servicios', 'productos', 'informacion', 'info'];
      const isVideoInfoSearch = videoInfoTerms.some(term => normalizedSearch.includes(term));

      // Buscar archivos por nombre, tags y descripción (priorizando tags y descripción)
      const searchTerms = [
        normalizedSearch,
        ...(isQrPaymentSearch ? qrPaymentTerms : []),
        ...(isVideoInfoSearch ? videoInfoTerms : []),
      ];

      // Construir condiciones de búsqueda
      const searchConditions: any[] = [
        { filename: { contains: normalizedSearch, mode: 'insensitive' } },
        { originalName: { contains: normalizedSearch, mode: 'insensitive' } },
        { description: { contains: normalizedSearch, mode: 'insensitive' } },
        { tags: { has: normalizedSearch } }, // Buscar en tags array
      ];

      // Agregar búsqueda por tags y descripción para términos específicos
      searchTerms.forEach(term => {
        searchConditions.push(
          { filename: { contains: term, mode: 'insensitive' as const } },
          { originalName: { contains: term, mode: 'insensitive' as const } },
          { description: { contains: term, mode: 'insensitive' as const } },
          { tags: { has: term } }, // Buscar en tags
        );
      });

      // Buscar archivos
      const filesByName = await this.prisma.file.findMany({
        where: {
          businessId,
          isActive: true,
          OR: searchConditions,
        },
        include: {
          _count: {
            select: {
              knowledgeChunks: true,
            },
          },
        },
        take: 10, // Obtener más resultados para priorizar
      });

      // Priorizar archivos que coincidan con tags o descripción
      let prioritizedFile = null;

      if (filesByName.length > 0) {
        // MEJORA: Si es búsqueda de QR/pago, priorizar archivos IMAGE con tags o descripción relacionada
        if (isQrPaymentSearch) {
          // Primero buscar archivos de tipo IMAGE con tags/descripción relacionada
          prioritizedFile = filesByName.find(file => {
            // Priorizar archivos de tipo IMAGE
            if (file.fileType !== 'IMAGE') return false;

            const tags = Array.isArray(file.tags) ? file.tags : [];
            const description = (file.description || '').toLowerCase();
            const fileName = (file.originalName || '').toLowerCase();

            // Verificar si tiene tags relacionados con QR/pago
            const hasQrTag = tags.some((tag: string) =>
              qrPaymentTerms.some(term => tag.toLowerCase().includes(term))
            );

            // Verificar si la descripción menciona QR/pago
            const hasQrDescription = qrPaymentTerms.some(term =>
              description.includes(term) || fileName.includes(term)
            );

            return hasQrTag || hasQrDescription;
          });

          // Si no se encontró uno con tags, buscar cualquier imagen
          if (!prioritizedFile) {
            prioritizedFile = filesByName.find(file => file.fileType === 'IMAGE');
            this.logger.log(`[findFileByNameOrContent] ⚠️ QR no encontrado con tags, usando primera imagen disponible`);
          }
        }

        // Si es búsqueda de video informativo, priorizar videos con tags o descripción relacionada
        if (isVideoInfoSearch && !prioritizedFile) {
          prioritizedFile = filesByName.find(file => {
            // Priorizar archivos de tipo VIDEO
            if (file.fileType !== 'VIDEO') return false;

            const tags = Array.isArray(file.tags) ? file.tags : [];
            const description = (file.description || '').toLowerCase();
            const fileName = (file.originalName || '').toLowerCase();

            // Verificar si tiene tags relacionados con video/información
            const hasVideoTag = tags.some((tag: string) =>
              videoInfoTerms.some(term => tag.toLowerCase().includes(term))
            );

            // Verificar si la descripción menciona video/información
            const hasVideoDescription = videoInfoTerms.some(term =>
              description.includes(term) || fileName.includes(term)
            );

            return hasVideoTag || hasVideoDescription;
          });
        }

        // Si no se encontró uno prioritario, usar el primero
        if (!prioritizedFile) {
          prioritizedFile = filesByName[0];
        }

        if (prioritizedFile) {
          this.logger.log(`[findFileByNameOrContent] ✅ Archivo encontrado: ${prioritizedFile.originalName} (ID: ${prioritizedFile.id})`);
          if (isQrPaymentSearch) {
            this.logger.log(`[findFileByNameOrContent] 📋 Archivo identificado como QR de pago por tags/descripción`);
          } else if (isVideoInfoSearch && prioritizedFile.fileType === 'VIDEO') {
            this.logger.log(`[findFileByNameOrContent] 🎥 Archivo identificado como video informativo por tags/descripción`);
          }
          return prioritizedFile.id;
        }
      }

      // Buscar en knowledge chunks por contenido
      const chunks = await this.prisma.knowledgeChunk.findMany({
        where: {
          businessId,
          OR: [
            { content: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ...searchTerms.map(term => ({
              content: { contains: term, mode: 'insensitive' as const },
            })),
          ],
        },
        take: 1,
      });

      // Si encontramos chunks, buscar el archivo asociado por fileId
      if (chunks.length > 0 && chunks[0].fileId) {
        const file = await this.prisma.file.findUnique({
          where: { id: chunks[0].fileId },
        });
        if (file) {
          this.logger.log(`[findFileByNameOrContent] Archivo encontrado por contenido: ${file.id}`);
          return file.id;
        }
      }

      this.logger.warn(`[findFileByNameOrContent] No se encontró archivo para: ${searchTerm}`);
      return null;
    } catch (error) {
      this.logger.error('Error finding file:', error);
      return null;
    }
  }

  /**
   * Parsea referencias a archivos en la respuesta de la IA
   * Formato: [SEND_FILE:fileId:type:caption] o [SEND_FILE:searchTerm:type:caption] para búsqueda
   */
  private async parseMediaReferences(
    response: string,
    availableFiles: Array<{ id: string; originalName: string; mimeType: string; fileType: string }>,
    businessId: string,
  ): Promise<Array<{ type: 'image' | 'video' | 'document' | 'audio'; fileId?: string; filePath?: string; filename?: string; mimetype?: string; caption?: string }>> {
    const mediaToSend: Array<{ type: 'image' | 'video' | 'document' | 'audio'; fileId?: string; filePath?: string; filename?: string; mimetype?: string; caption?: string }> = [];

    // Buscar patrones [SEND_FILE:fileId:type:caption] o [SEND_FILE:searchTerm:type:caption]
    const filePattern = /\[SEND_FILE:([^:]+):(image|video|document|audio):([^\]]*)\]/gi;
    let match;

    while ((match = filePattern.exec(response)) !== null) {
      const [, fileIdOrName, type, caption] = match;

      // Buscar el archivo por ID o por nombre en availableFiles
      let file = availableFiles.find(f =>
        f.id === fileIdOrName ||
        f.originalName.toLowerCase().includes(fileIdOrName.toLowerCase())
      );

      // Si no se encuentra, buscar por nombre o contenido en la BD (para QR de pago, etc.)
      if (!file) {
        const foundFileId = await this.findFileByNameOrContent(businessId, fileIdOrName);
        if (foundFileId) {
          const foundFile = await this.prisma.file.findUnique({
            where: { id: foundFileId },
            select: { id: true, originalName: true, mimeType: true, fileType: true },
          });
          if (foundFile) {
            file = foundFile;
          }
        }
      }

      if (file) {
        // Determinar el tipo basado en el fileType o mimeType
        let mediaType: 'image' | 'video' | 'document' | 'audio' = type as 'image' | 'video' | 'document' | 'audio';

        // Si el tipo especificado no coincide, ajustar según el tipo de archivo
        if (file.fileType === 'IMAGE' && mediaType !== 'image') mediaType = 'image';
        else if (file.fileType === 'VIDEO' && mediaType !== 'video') mediaType = 'video';
        else if (file.mimeType?.startsWith('audio/') && mediaType !== 'audio') mediaType = 'audio';
        else if (file.fileType !== 'IMAGE' && file.fileType !== 'VIDEO' && !file.mimeType?.startsWith('audio/') && mediaType !== 'document') mediaType = 'document';

        mediaToSend.push({
          type: mediaType,
          fileId: file.id,
          filename: file.originalName,
          mimetype: file.mimeType,
          caption: caption || undefined,
        });
      }
    }

    return mediaToSend;
  }

  /**
   * Obtiene configuración de citas según el rubro del negocio
   * @param industryType Tipo de industria
   * @param customBusinessHours Horarios personalizados desde la configuración (opcional)
   */
  private getIndustryAppointmentConfig(
    industryType: string,
    customBusinessHours?: Record<string, { enabled: boolean; start: string; end: string }> | null,
  ) {
    const configs: Record<string, {
      terminology: string;
      keywords: string[];
      defaultDuration: number;
      businessHours: string;
      exampleNotes: string;
      startHour: number;
      endHour: number;
    }> = {
      RESTAURANT: {
        terminology: 'reserva de mesa',
        keywords: ['quiero reservar', 'necesito una mesa', 'quiero una reserva', 'reservar mesa', 'agendar mesa'],
        defaultDuration: 120, // 2 horas típicas en restaurantes
        businessHours: 'Lunes a Domingo: 12:00 PM - 11:00 PM',
        exampleNotes: 'Mesa para 2 personas',
        startHour: 12,
        endHour: 23,
      },
      CLINIC: {
        terminology: 'cita médica',
        keywords: ['quiero una cita', 'necesito consulta', 'quiero agendar cita', 'cita médica', 'consulta médica'],
        defaultDuration: 30, // 30 minutos típicos para consultas
        businessHours: 'Lunes a Viernes: 8:00 AM - 6:00 PM, Sábados: 9:00 AM - 1:00 PM',
        exampleNotes: 'Consulta general',
        startHour: 8,
        endHour: 18,
      },
      REAL_ESTATE: {
        terminology: 'visita',
        keywords: ['quiero una visita', 'necesito ver la propiedad', 'quiero agendar visita', 'cita de visita'],
        defaultDuration: 60, // 1 hora para visitas
        businessHours: 'Lunes a Sábado: 9:00 AM - 7:00 PM',
        exampleNotes: 'Visita a propiedad',
        startHour: 9,
        endHour: 19,
      },
      ACADEMY: {
        terminology: 'clase o inscripción',
        keywords: ['quiero inscribirme', 'necesito una clase', 'quiero agendar clase', 'inscripción'],
        defaultDuration: 90, // 1.5 horas típicas para clases
        businessHours: 'Lunes a Viernes: 8:00 AM - 8:00 PM, Sábados: 9:00 AM - 2:00 PM',
        exampleNotes: 'Clase de nivel básico',
        startHour: 8,
        endHour: 20,
      },
      RETAIL: {
        terminology: 'cita',
        keywords: ['quiero una cita', 'necesito agendar', 'quiero reservar cita', 'agendar'],
        defaultDuration: 60,
        businessHours: 'Lunes a Sábado: 9:00 AM - 7:00 PM',
        exampleNotes: 'Consulta de producto',
        startHour: 9,
        endHour: 19,
      },
      SERVICES: {
        terminology: 'cita o servicio',
        keywords: ['quiero una cita', 'necesito agendar', 'quiero reservar servicio', 'agendar servicio'],
        defaultDuration: 60,
        businessHours: 'Lunes a Viernes: 9:00 AM - 6:00 PM',
        exampleNotes: 'Servicio solicitado',
        startHour: 9,
        endHour: 18,
      },
      OTHER: {
        terminology: 'cita',
        keywords: ['quiero una cita', 'necesito agendar', 'quiero reservar', 'agendar'],
        defaultDuration: 60,
        businessHours: 'Lunes a Viernes: 9:00 AM - 6:00 PM',
        exampleNotes: 'Consulta general',
        startHour: 9,
        endHour: 18,
      },
    };

    const baseConfig = configs[industryType] || configs.OTHER;

    // Si hay horarios personalizados, usarlos
    if (customBusinessHours && Object.keys(customBusinessHours).length > 0) {
      // Generar texto descriptivo de horarios
      const daysMap: Record<string, string> = {
        lunes: 'Lunes',
        martes: 'Martes',
        miércoles: 'Miércoles',
        jueves: 'Jueves',
        viernes: 'Viernes',
        sábado: 'Sábado',
        domingo: 'Domingo',
      };

      const enabledDays = Object.entries(customBusinessHours)
        .filter(([_, config]) => config.enabled)
        .map(([day, config]) => `${daysMap[day] || day}: ${config.start} - ${config.end}`);

      const businessHoursText = enabledDays.length > 0
        ? enabledDays.join(', ')
        : baseConfig.businessHours;

      // Calcular hora mínima y máxima de todos los días habilitados
      let minStartHour = 24;
      let maxEndHour = 0;

      Object.values(customBusinessHours).forEach((dayConfig) => {
        if (dayConfig.enabled) {
          const [startHour] = dayConfig.start.split(':').map(Number);
          const [endHour] = dayConfig.end.split(':').map(Number);
          if (startHour < minStartHour) minStartHour = startHour;
          if (endHour > maxEndHour) maxEndHour = endHour;
        }
      });

      // Si no hay días habilitados, usar valores por defecto
      if (minStartHour === 24 || maxEndHour === 0) {
        return baseConfig;
      }

      return {
        ...baseConfig,
        businessHours: businessHoursText,
        startHour: minStartHour,
        endHour: maxEndHour,
        customBusinessHours, // Guardar para uso en findAvailableSlots
      };
    }

    return baseConfig;
  }

  /**
   * Limpia las referencias de archivos y citas del mensaje
   */
  private cleanMediaReferences(response: string): string {
    // Remover patrones [SEND_FILE:...], [CREATE_APPOINTMENT:...], [CHECK_APPOINTMENTS:...], [CHECK_MY_APPOINTMENTS:...], etc.
    return response
      .replace(/\[SEND_FILE:[^\]]+\]/gi, '')
      .replace(/\[CREATE_APPOINTMENT:[^\]]+\]/gi, '')
      .replace(/\[CHECK_APPOINTMENTS:[^\]]+\]/gi, '')
      .replace(/\[CHECK_APPOINTMENTS_BY_SPECIALTY:[^\]]+\]/gi, '')
      .replace(/\[CHECK_MY_APPOINTMENTS:[^\]]+\]/gi, '')
      .replace(/\[FORWARD_EVIDENCE:[^\]]+\]/gi, '')
      .replace(/\[SEND_AUDIO_RESPONSE:[^\]]+\]/gi, '')
      .replace(/\[BUSCAR_NUMERO_ASISTENCIA\]/gi, '')
      .trim();
  }

  async processFileKnowledge(businessId: string, fileId: string, chunks: string[]): Promise<void> {
    // MEJORA: Diagnóstico detallado si RAG no está disponible
    if (!this.isEnabled) {
      this.logger.error(`[AI Service] ❌ RAG is disabled. isEnabled=${this.isEnabled}`);
      this.logger.error(`[AI Service] Check QDRANT_URL environment variable`);
      throw new Error('RAG service is disabled. Please configure QDRANT_URL environment variable.');
    }

    if (!this.ragService) {
      this.logger.error(`[AI Service] ❌ RAG service not initialized. ragService=${this.ragService}`);
      this.logger.error(`[AI Service] This should not happen if QDRANT_URL is configured`);
      throw new Error('RAG service not initialized. Please check server logs for initialization errors.');
    }

    if (!this.embeddingService) {
      this.logger.error(`[AI Service] ❌ Embedding service not initialized. embeddingService=${this.embeddingService}`);
      throw new Error('Embedding service not initialized. Please check server logs for initialization errors.');
    }

    this.logger.log(`[AI Service] ✅ RAG service is ready. Processing ${chunks.length} chunks for file ${fileId}`);

    const startTime = Date.now();
    this.logger.log(`[AI Service] Processing ${chunks.length} chunks for file ${fileId}`);

    const chunkData = chunks.map((content, index) => ({
      id: randomUUID(),
      content,
      metadata: { fileId, chunkIndex: index },
    }));

    // MEJORA: Procesar embeddings usando el servicio inteligente seleccionado
    const embeddingStartTime = Date.now();
    try {
      this.logger.log(`[AI Service] 🔄 Creating embeddings for ${chunkData.length} chunks using ${this.embeddingService?.constructor?.name || 'unknown'} service...`);
      await this.ragService!.processAndStoreKnowledge(businessId, chunkData);
      const embeddingTime = Date.now() - embeddingStartTime;
      this.logger.log(`[AI Service] ✅ Embeddings created and stored in vector DB in ${embeddingTime}ms`);
    } catch (error: any) {
      this.logger.error(`[AI Service] ❌ Error processing embeddings for file ${fileId}:`, error.message || error);

      // Si el servicio actual falla, intentar recrear con el factory (puede que haya cambiado la configuración)
      this.logger.warn(`[AI Service] 🔄 Current embedding service failed, attempting to reinitialize...`);
      try {
        const openaiApiKey = this.configService.get('OPENAI_API_KEY');

        // Obtener chunks existentes para re-entrenamiento si es necesario
        const existingChunks = await this.prisma.knowledgeChunk.findMany({
          where: { businessId },
          select: { content: true },
          take: 50,
        });
        const chunksForTraining = existingChunks.map(c => c.content);

        // Recrear servicio con factory
        const newEmbeddingService = await EmbeddingServiceFactory.createService(openaiApiKey);
        const newRAGService = new RAGService(newEmbeddingService, this.vectorService!);

        // Reintentar con el nuevo servicio
        await newRAGService.processAndStoreKnowledge(businessId, chunkData);

        // Actualizar servicios para futuras operaciones
        this.embeddingService = newEmbeddingService;
        this.ragService = newRAGService;

        this.logger.log(`[AI Service] ✅ Service reinitialized and processing successful`);
      } catch (reinitError: any) {
        this.logger.error(`[AI Service] ❌ Service reinitialization also failed:`, reinitError.message);
        throw new Error(`Failed to process embeddings: ${error.message}. Service reinitialization also failed: ${reinitError.message}`);
      }
    }

    // Guardar chunks en BD de forma optimizada (usar createMany si hay muchos)
    const dbStartTime = Date.now();
    try {
      if (chunkData.length > 10) {
        // Para muchos chunks, usar createMany (más rápido)
        await this.prisma.knowledgeChunk.createMany({
          data: chunkData.map((chunk) => ({
            businessId,
            fileId,
            content: chunk.content,
            vectorId: chunk.id,
            metadata: chunk.metadata,
          })) as any,
        });
      } else {
        // Para pocos chunks, crear uno por uno
        for (const chunk of chunkData) {
          await this.prisma.knowledgeChunk.create({
            data: {
              businessId,
              fileId,
              content: chunk.content,
              vectorId: chunk.id,
              metadata: chunk.metadata,
            },
          });
        }
      }
      const dbTime = Date.now() - dbStartTime;
      this.logger.log(`[AI Service] Chunks saved to database in ${dbTime}ms`);

      // MEJORA: Validar que se crearon chunks antes de continuar
      const chunksCreated = await this.prisma.knowledgeChunk.count({
        where: { fileId },
      });

      if (chunksCreated === 0) {
        this.logger.error(`[AI Service] ❌ No se crearon chunks en BD para file ${fileId}. El procesamiento falló.`);
        throw new Error(`Failed to create chunks in database for file ${fileId}`);
      }

      this.logger.log(`[AI Service] ✅ Validación: ${chunksCreated} chunks creados en BD para file ${fileId}`);
    } catch (error) {
      this.logger.error(`[AI Service] Error saving chunks to database for file ${fileId}:`, error);
      throw error;
    }

    const totalTime = Date.now() - startTime;
    this.logger.log(`[AI Service] File knowledge processing completed in ${totalTime}ms for file ${fileId}`);
  }

  async deleteFileKnowledge(businessId: string, fileId: string): Promise<void> {
    if (!this.isEnabled || !this.ragService) {
      this.logger.warn(
        `Skipping knowledge deletion for file ${fileId}: AI service is not configured.`,
      );
      return;
    }

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { businessId, fileId },
    });

    const chunkIds = chunks.map((chunk) => chunk.vectorId).filter((id) => id !== null);

    if (chunkIds.length > 0) {
      await this.ragService.deleteKnowledge(businessId, chunkIds);
    }

    await this.prisma.knowledgeChunk.deleteMany({
      where: { businessId, fileId },
    });
  }

  async testApiKey(
    provider: string,
    apiKey: string,
    model?: string,
    baseUrl?: string,
  ): Promise<{ status: 'working' | 'failed' | 'error'; message?: string }> {
    try {
      if (!apiKey || apiKey.trim() === '') {
        return { status: 'error', message: 'API Key no puede estar vacía' };
      }

      if (!provider || provider.trim() === '') {
        return { status: 'error', message: 'Proveedor no especificado' };
      }

      this.logger.log(`Testing API for provider: ${provider}, model: ${model || 'default'}`);

      const testProvider = this.providerFactory.createProvider({
        provider,
        apiKey,
        model: model || undefined,
        baseUrl: baseUrl || undefined,
      });

      const isWorking = await testProvider.testConnection();

      if (isWorking) {
        return { status: 'working', message: 'Conexión exitosa' };
      } else {
        return { status: 'failed', message: 'No se pudo conectar con el proveedor' };
      }
    } catch (error: any) {
      this.logger.error(`API test failed for ${provider}:`, error);

      let errorMessage = 'Error desconocido';

      if (error?.response?.status === 401 || error?.status === 401) {
        errorMessage = 'API Key inválida o no autorizada';
      } else if (error?.response?.status === 429 || error?.status === 429) {
        errorMessage = 'Límite de solicitudes excedido. Intenta más tarde';
      } else if (error?.response?.status === 400 || error?.status === 400) {
        errorMessage = 'Solicitud inválida. Verifica el modelo y la configuración';
      } else if (error?.response?.status === 404 || error?.status === 404) {
        // Error 404 generalmente significa que el modelo no existe
        const modelError = error?.message || '';
        if (modelError.includes('model') || modelError.includes('does not exist')) {
          if (provider === 'GROQ') {
            errorMessage = 'Modelo no válido. Modelos disponibles: llama-3.1-8b-instant, llama-3.1-70b-versatile, mixtral-8x7b-32768, gemma-7b-it';
          } else {
            errorMessage = `Modelo no encontrado: ${model || 'no especificado'}. Verifica el nombre del modelo.`;
          }
        } else {
          errorMessage = 'Recurso no encontrado. Verifica la configuración';
        }
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.toString) {
        errorMessage = error.toString();
      }

      return { status: 'error', message: errorMessage };
    }
  }

  /**
   * Obtiene el contexto de plataforma para agregar al prompt
   * NUEVO método - no afecta métodos existentes
   */
  private getPlatformContext(platform: string): string {
    switch (platform) {
      case 'MESSENGER':
        return '\n⚠️ CONTEXTO: El cliente está escribiendo desde Facebook Messenger. Puedes usar botones interactivos y respuestas más extensas.';
      case 'INSTAGRAM':
        return '\n⚠️ CONTEXTO: El cliente está escribiendo desde Instagram Direct. Sé más conciso (límite de caracteres más estricto). Enfócate en respuestas visuales cuando sea posible.';
      case 'WHATSAPP_WEB':
        return '\n⚠️ CONTEXTO: El cliente está escribiendo desde WhatsApp Web.';
      case 'WHATSAPP_API':
        return '\n⚠️ CONTEXTO: El cliente está escribiendo desde WhatsApp Business API.';
      default:
        return '';
    }
  }

  // ===== BOT RESPONSE METHOD (For Business Owners via WhatsApp) =====

  /**
   * Genera respuesta de IA para el bot de WhatsApp
   * Este método NO requiere permisos de Super Admin
   * Es usado por el webhook de WhatsApp para responder automáticamente
   */
  async generateBotResponse(
    businessId: string,
    message: string,
    customerPhone?: string,
    sessionId?: string
  ): Promise<AIResponse> {
    try {
      const startTime = Date.now();

      // Validar que el business existe y está activo
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          industryType: true,
          isActive: true,
          botConfig: true,
        }
      });

      if (!business || !business.isActive) {
        throw new Error('Business not found or inactive');
      }

      if (!business.botConfig?.autoReply) {
        throw new Error('AI bot is disabled for this business');
      }

      // Record API usage for monitoring
      await this.recordApiUsage(businessId, 'bot_response', 1);

      // Generate AI response using existing logic
      const response = await this.generateResponse(businessId, message, customerPhone, {
        platform: 'WHATSAPP_API',
        senderId: customerPhone || 'unknown'
      });

      // Record response time for monitoring
      const processingTime = Date.now() - startTime;
      await this.monitoringService.recordAPIMetric({
        endpoint: '/ai/bot-response',
        method: 'POST',
        responseTime: processingTime,
        statusCode: 200,
        businessId,
        userId: `bot-${businessId}`,
        timestamp: new Date(startTime),
      });

      return response;

    } catch (error) {
      this.logger.error(`Bot response generation failed for business ${businessId}:`, error);

      // Return a fallback response
      return {
        message: 'Lo siento, estoy teniendo dificultades técnicas. Por favor, intenta nuevamente en unos momentos.',
        confidence: 0,
        tokensUsed: 0,
        processingTime: 0,
        needsHumanIntervention: true,
        suggestedActions: [],
        metadata: {
          error: error.message,
          fallback: true
        }
      } as any;
    }
  }

  private async recordApiUsage(businessId: string, endpoint: string, tokensUsed: number) {
    try {
      await this.prisma.apiUsage.create({
        data: {
          businessId,
          provider: 'system',
          model: 'bot-response',
          endpoint,
          tokensUsed,
          cost: 0, // Free for bot responses
        }
      });
    } catch (error) {
      this.logger.warn('Failed to record API usage:', error);
    }
  }

  // 🚀 Método para testing RAG desde Admin Panel
  async testRAGQuery(
    businessId: string,
    businessName: string,
    industryType: string,
    query: string,
    maxChunks: number = 5,
    includeMetadata: boolean = false
  ): Promise<any> {
    const startTime = Date.now();

    try {
      if (!this.isEnabled || !this.ragService) {
        throw new Error('RAG service is not enabled. Configure QDRANT_URL and restart.');
      }

      // Verificar que el negocio tenga chunks
      const chunksCount = await this.prisma.knowledgeChunk.count({
        where: { businessId }
      });

      if (chunksCount === 0) {
        return {
          chunks: [],
          processingTime: Date.now() - startTime,
          provider: 'none',
          message: 'No knowledge chunks found for this business'
        };
      }

      // Usar el RAG service real para buscar
      const ragResponse = await this.ragService.generateContextualResponse(
        businessId,
        businessName,
        industryType,
        query,
        undefined, // customPrompt
        [], // conversationHistory
        async (context) => {
          // Extraer los chunks encontrados con metadata
          const chunks = [];
          
          if (context.knowledgeContext && context.knowledgeContext.length > 0) {
            // Buscar los chunks originales en la BD para obtener metadata
            const originalChunks = await this.prisma.knowledgeChunk.findMany({
              where: {
                businessId,
                content: {
                  in: context.knowledgeContext.slice(0, maxChunks)
                }
              },
              include: {
                file: {
                  select: {
                    originalName: true,
                    fileType: true
                  }
                }
              },
              take: maxChunks
            });

            chunks.push(...originalChunks.map(chunk => ({
              content: chunk.content,
              score: 0.8, // Score simulado - en producción debería venir del vector search
              metadata: includeMetadata ? {
                fileName: chunk.file?.originalName || 'unknown',
                fileType: chunk.file?.fileType || 'unknown',
                chunkId: chunk.id,
                vectorId: chunk.vectorId
              } : undefined
            })));
          }

          // Retornar AIResponse válido
          return {
            message: `Found ${chunks.length} relevant chunks for query: "${query}"`,
            confidence: chunks.length > 0 ? 0.8 : 0.1,
            shouldEscalate: false,
            processingTime: Date.now() - startTime,
            suggestedActions: [],
            // Agregar chunks como propiedad extra para el admin
            ...(chunks.length > 0 && { chunks })
          };
        }
      );

      const processingTime = Date.now() - startTime;

      return {
        chunks: (ragResponse as any).chunks || [], // chunks es propiedad extra agregada
        processingTime,
        provider: this.embeddingService?.constructor?.name || 'unknown',
        totalChunksFound: chunksCount,
        queryProcessed: query
      };

    } catch (error: any) {
      console.error('[AiService] Error in testRAGQuery:', error);
      return {
        chunks: [],
        processingTime: Date.now() - startTime,
        provider: 'error',
        error: error.message,
        queryProcessed: query
      };
    }
  }
}
