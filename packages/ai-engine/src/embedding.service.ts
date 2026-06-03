/**
 * EmbeddingService - Servicio gratuito para crear embeddings usando Hugging Face
 * Completamente gratis, no requiere API key
 */

export interface EmbeddingService {
  createEmbedding(text: string): Promise<number[]>;
  createEmbeddings(texts: string[]): Promise<number[][]>;
}

// Cohere Embedding Service
export class CohereEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private apiUrl = 'https://api.cohere.ai/v1/embed';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [text],
          model: 'embed-multilingual-v3.0',
          input_type: 'search_document'
        }),
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status}`);
      }

      const result: any = await response.json();
      return result.embeddings[0];
    } catch (error) {
      console.error('Error creating Cohere embedding:', error);
      throw error;
    }
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: texts,
          model: 'embed-multilingual-v3.0',
          input_type: 'search_document'
        }),
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status}`);
      }

      const result: any = await response.json();
      return result.embeddings;
    } catch (error) {
      console.error('Error creating Cohere embeddings:', error);
      throw error;
    }
  }
}

// Gemini Embedding Service
export class GeminiEmbeddingServiceLegacy implements EmbeddingService {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: text }]
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result: any = await response.json();
      return result.embedding.values;
    } catch (error) {
      console.error('Error creating Gemini embedding:', error);
      throw error;
    }
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    // Gemini no soporta batch, procesar uno por uno
    const results: number[][] = [];
    for (const text of texts) {
      const embedding = await this.createEmbedding(text);
      results.push(embedding);
    }
    return results;
  }
}

export class HuggingFaceEmbeddingService implements EmbeddingService {
  private modelName: string;
  private apiUrl: string;
  private apiKey?: string;

  constructor(modelName: string = 'sentence-transformers/all-MiniLM-L6-v2', apiKey?: string) {
    this.modelName = modelName;
    this.apiKey = apiKey;
    // NOTE: Hugging Face serverless Inference API migrated from api-inference.huggingface.co
    // to router.huggingface.co. Keeping path compatible for feature-extraction style calls.
    this.apiUrl = `https://router.huggingface.co/hf-inference/models/${modelName}`;
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Usar fetch nativo de Node.js 18+ o importar node-fetch si es necesario
      const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey && this.apiKey.trim().length > 10) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const response = await fetchFn(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
          },
        }),
      });

      if (!response.ok) {
        // Si falla la API, intentar con modelo alternativo o retry
        if (response.status === 503) {
          // Modelo cargándose, esperar y reintentar
          await new Promise(resolve => setTimeout(resolve, 5000));
          return this.createEmbedding(text);
        }
        const body = await response.text().catch(() => '');
        throw new Error(`Hugging Face API error: ${response.status} ${response.statusText} ${body}`);
      }

      const result = await response.json();
      
      // La API puede devolver un array directamente o un objeto con el array
      if (Array.isArray(result)) {
        return result[0] || result;
      }
      
      if (result.embeddings) {
        return result.embeddings[0] || result.embeddings;
      }

      return result;
    } catch (error) {
      console.error('Error creating embedding with Hugging Face:', error);
      throw error;
    }
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // Procesar en lotes más pequeños para evitar timeouts (máximo 50 textos por lote)
      const batchSize = 50;
      const batches: string[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      console.log(`[EmbeddingService] Processing ${texts.length} texts in ${batches.length} batches`);

      const allEmbeddings: number[][] = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`[EmbeddingService] Processing batch ${i + 1}/${batches.length} (${batch.length} texts)`);
        
        const batchStartTime = Date.now();
        
        // Usar fetch nativo de Node.js 18+ o importar node-fetch si es necesario
        const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.apiKey && this.apiKey.trim().length > 10) {
          headers.Authorization = `Bearer ${this.apiKey}`;
        }
        
        // Agregar timeout de 60 segundos por lote
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        try {
          const response = await fetchFn(this.apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              inputs: batch,
              options: {
                wait_for_model: false, // No esperar a que el modelo se cargue (más rápido)
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 503) {
              // Modelo cargándose, esperar y reintentar solo una vez
              console.log(`[EmbeddingService] Model loading, waiting 3 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Reintentar sin timeout más corto
              const retryResponse = await fetchFn(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  inputs: batch,
                  options: {
                    wait_for_model: true,
                  },
                }),
              });
              
              if (!retryResponse.ok) {
                const body = await retryResponse.text().catch(() => '');
                throw new Error(`Hugging Face API error after retry: ${retryResponse.status} ${retryResponse.statusText} ${body}`);
              }
              
              const retryResult = await retryResponse.json();
              const batchEmbeddings = Array.isArray(retryResult) && Array.isArray(retryResult[0]) 
                ? retryResult 
                : [retryResult];
              allEmbeddings.push(...batchEmbeddings);
              continue;
            }
            const body = await response.text().catch(() => '');
            throw new Error(`Hugging Face API error: ${response.status} ${response.statusText} ${body}`);
          }

          const result = await response.json();
          
          // La API devuelve un array de arrays
          let batchEmbeddings: number[][];
          if (Array.isArray(result) && Array.isArray(result[0])) {
            batchEmbeddings = result;
          } else if (Array.isArray(result) && typeof result[0] === 'number') {
            batchEmbeddings = [result];
          } else {
            batchEmbeddings = [result];
          }
          
          allEmbeddings.push(...batchEmbeddings);
          
          const batchTime = Date.now() - batchStartTime;
          console.log(`[EmbeddingService] Batch ${i + 1} completed in ${batchTime}ms`);
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.error(`[EmbeddingService] Timeout processing batch ${i + 1}`);
            throw new Error(`Embedding timeout after 60 seconds for batch ${i + 1}`);
          }
          throw error;
        }
      }

      console.log(`[EmbeddingService] All ${texts.length} embeddings created successfully`);
      return allEmbeddings;
    } catch (error) {
      console.error('[EmbeddingService] Error creating embeddings with Hugging Face:', error);
      throw error;
    }
  }
}

/**
 * Servicio de embeddings local que no requiere APIs externas
 * Usa TF-IDF y similitud de coseno para búsquedas básicas
 */
export class LocalEmbeddingService implements EmbeddingService {
  private vocabulary: Map<string, number> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;
  private trainedChunks: string[] = [];

  // TF-IDF implementation for local embeddings
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 20) // Filtro básico
      .slice(0, 100); // Limitar tokens para rendimiento
  }

  private calculateTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    const totalTokens = tokens.length;

    if (totalTokens === 0) return tf;

    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });

    // Normalize TF
    tf.forEach((count, token) => {
      tf.set(token, count / totalTokens);
    });

    return tf;
  }

  private calculateIDF(token: string): number {
    const df = this.documentFrequency.get(token) || 1;
    return Math.log((this.totalDocuments + 1) / (df + 1)) + 1; // Smoothed IDF
  }

  async createEmbedding(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    const tf = this.calculateTF(tokens);

    // Create TF-IDF vector (fixed size: 200 dimensions for better accuracy)
    const vector: number[] = new Array(200).fill(0);

    tokens.forEach((token, index) => {
      if (index < 200) {
        const tfValue = tf.get(token) || 0;
        const idfValue = this.calculateIDF(token);
        vector[index] = tfValue * idfValue;
      }
    });

    // Normalize vector (L2 normalization)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(val => val / magnitude);
    }

    return vector;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.createEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  // Train on existing chunks for better TF-IDF
  async trainOnChunks(chunks: string[]): Promise<void> {
    if (chunks.length === 0) return;

    this.trainedChunks = chunks;
    this.totalDocuments = chunks.length;
    this.vocabulary.clear();
    this.documentFrequency.clear();

    // Build vocabulary and document frequency
    chunks.forEach(chunk => {
      const tokens = this.tokenize(chunk);
      const uniqueTokens = new Set(tokens);

      uniqueTokens.forEach(token => {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
      });
    });

    console.log(`📚 Local embeddings trained on ${this.totalDocuments} documents, vocabulary size: ${this.vocabulary.size}`);
  }

  // Método adicional para búsqueda directa por similitud de texto
  calculateSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenize(text1));
    const tokens2 = new Set(this.tokenize(text2));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size; // Jaccard similarity
  }
}

/**
 * Servicio de embeddings que usa OpenAI (requiere API key)
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private client: any;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    const OpenAI = require('openai');
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async createEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((item: any) => item.embedding);
  }
}

export class GeminiEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-004') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private get baseUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}`;
  }

  private async postJson(path: string, body: any): Promise<any> {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
    const url = `${this.baseUrl}:${path}?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} ${text}`);
    }

    return response.json();
  }

  async createEmbedding(text: string): Promise<number[]> {
    const result = await this.postJson('embedContent', {
      content: {
        parts: [{ text }],
      },
    });

    const values = result?.embedding?.values;
    if (!Array.isArray(values)) {
      throw new Error('Gemini API error: invalid embedding response');
    }
    return values;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const requests = texts.map((text: string) => ({
      model: `models/${this.model}`,
      content: {
        parts: [{ text }],
      },
    }));

    const result = await this.postJson('batchEmbedContents', { requests });
    const embeddings = result?.embeddings;
    if (!Array.isArray(embeddings)) {
      throw new Error('Gemini API error: invalid batch embedding response');
    }

    return embeddings.map((e: any) => {
      const values = e?.values;
      if (!Array.isArray(values)) {
        throw new Error('Gemini API error: invalid embedding in batch response');
      }
      return values;
    });
  }
}

/**
 * Factory inteligente que elige automáticamente el mejor servicio de embeddings disponible
 */
// Sistema de Balanceo Inteligente de APIs RAG
export interface APIProviderConfig {
  id: string;
  name: string;
  service: EmbeddingService;
  priority: number; // 1 = más alta prioridad
  weight: number;
  quotaLimit: number; // tokens por hora
  usedTokens: number; // tokens usados en la hora actual
  costPerToken: number; // costo por token
  isActive: boolean;
  lastUsed: Date;
  avgLatency: number; // ms promedio
  errorCount: number; // errores en la última hora
}

export class APIBalancerService {
  private providers: Map<string, APIProviderConfig> = new Map();
  private balanceStrategy: 'ROUND_ROBIN' | 'COST_OPTIMIZED' | 'PERFORMANCE' | 'LOAD_BALANCED' = 'COST_OPTIMIZED';

  constructor() {
    // Inicializar con métricas desde Redis o BD
    this.loadProviderMetrics();
  }

  getProviders(): APIProviderConfig[] {
    return Array.from(this.providers.values());
  }

  getHealthyProviders(): APIProviderConfig[] {
    return Array.from(this.providers.values()).filter(p => p.isActive && p.errorCount < 5);
  }

  // Registrar un proveedor de embeddings
  registerProvider(id: string, service: EmbeddingService, config: Partial<APIProviderConfig>) {
    const providerConfig: APIProviderConfig = {
      id,
      name: config.name || id,
      service,
      priority: config.priority || 1,
      weight: config.weight || (10 - (config.priority || 1)),
      quotaLimit: config.quotaLimit || 10000, // 10K tokens/hora por defecto
      usedTokens: config.usedTokens || 0,
      costPerToken: config.costPerToken || 0.0001, // $0.0001 por token por defecto
      isActive: config.isActive !== false,
      lastUsed: config.lastUsed || new Date(),
      avgLatency: config.avgLatency || 1000, // 1s por defecto
      errorCount: config.errorCount || 0
    };

    this.providers.set(id, providerConfig);
    console.log(`[APIBalancer] ✅ Registrado proveedor: ${id} (Prioridad: ${providerConfig.priority})`);
  }

  // Seleccionar el mejor proveedor basado en la estrategia actual
  async selectBestProvider(textLength: number = 1000): Promise<EmbeddingService> {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.isActive)
      .filter(p => p.usedTokens + textLength <= p.quotaLimit); // Verificar quota

    if (availableProviders.length === 0) {
      throw new Error('No hay proveedores disponibles o han excedido su quota');
    }

    let selectedProvider: APIProviderConfig;

    switch (this.balanceStrategy) {
      case 'COST_OPTIMIZED':
        // Seleccionar el más barato disponible
        selectedProvider = availableProviders.reduce((best, current) =>
          current.costPerToken < best.costPerToken ? current : best
        );
        break;

      case 'PERFORMANCE':
        // Seleccionar el más rápido disponible
        selectedProvider = availableProviders.reduce((best, current) =>
          current.avgLatency < best.avgLatency ? current : best
        );
        break;

      case 'LOAD_BALANCED':
        // Seleccionar el menos usado
        selectedProvider = availableProviders.reduce((best, current) =>
          current.usedTokens < best.usedTokens ? current : best
        );
        break;

      case 'ROUND_ROBIN':
      default:
        // Rotar entre todos los disponibles
        const sortedByLastUsed = availableProviders.sort((a, b) =>
          a.lastUsed.getTime() - b.lastUsed.getTime()
        );
        selectedProvider = sortedByLastUsed[0];
        break;
    }

    // Actualizar métricas de uso
    selectedProvider.lastUsed = new Date();
    selectedProvider.usedTokens += textLength;

    console.log(`[APIBalancer] 🎯 Seleccionado: ${selectedProvider.name} (${this.balanceStrategy})`);
    return selectedProvider.service;
  }

  // Ejecutar embedding con balanceo automático y failover
  async createEmbedding(text: string): Promise<number[]> {
    const textTokens = Math.ceil(text.length / 4); // Estimación simple de tokens
    let lastError: Error | null = null;

    // Intentar hasta 3 proveedores diferentes
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const provider = await this.selectBestProvider(textTokens);
        const startTime = Date.now();

        const result = await provider.createEmbedding(text);

        const latency = Date.now() - startTime;

        // Actualizar métricas de éxito
        this.updateProviderMetrics(provider.constructor.name, latency, false);

        return result;

      } catch (error: any) {
        lastError = error;
        console.warn(`[APIBalancer] ❌ Intento ${attempt + 1} falló:`, error.message);

        // Actualizar métricas de error
        // this.updateProviderMetrics(providerId, 0, true);
      }
    }

    throw new Error(`Todos los proveedores fallaron. Último error: ${lastError?.message}`);
  }

  // Obtener métricas de todos los proveedores
  getAllProviderMetrics() {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      isActive: provider.isActive,
      usedTokens: provider.usedTokens,
      quotaLimit: provider.quotaLimit,
      usagePercent: (provider.usedTokens / provider.quotaLimit) * 100,
      costPerToken: provider.costPerToken,
      avgLatency: provider.avgLatency,
      errorCount: provider.errorCount,
      lastUsed: provider.lastUsed
    }));
  }

  // Cambiar estrategia de balanceo
  setBalanceStrategy(strategy: 'ROUND_ROBIN' | 'COST_OPTIMIZED' | 'PERFORMANCE' | 'LOAD_BALANCED') {
    this.balanceStrategy = strategy;
    console.log(`[APIBalancer] 🔄 Estrategia cambiada a: ${strategy}`);
  }

  // Actualizar métricas de un proveedor
  private updateProviderMetrics(providerId: string, latency: number, hadError: boolean) {
    const provider = Array.from(this.providers.values())
      .find(p => p.service.constructor.name === providerId);

    if (provider) {
      if (hadError) {
        provider.errorCount++;
      } else {
        // Actualizar latencia promedio (media móvil simple)
        provider.avgLatency = (provider.avgLatency + latency) / 2;
      }
    }
  }

  // Cargar métricas desde persistencia (Redis/BD)
  private async loadProviderMetrics() {
    // TODO: Implementar carga desde Redis/BD
    // Por ahora usa valores por defecto
  }

  // Resetear contadores de uso (llamar cada hora)
  resetHourlyCounters() {
    this.providers.forEach(provider => {
      provider.usedTokens = 0;
      provider.errorCount = 0;
    });
    console.log('[APIBalancer] 🔄 Contadores horarios reiniciados');
  }
}

// Instancia global del balancer
export const apiBalancer = new APIBalancerService();

export class EmbeddingServiceFactory {
  private static async testService(service: EmbeddingService, testText: string = "test"): Promise<boolean> {
    try {
      const embedding = await service.createEmbedding(testText);
      return Array.isArray(embedding) && embedding.length > 0;
    } catch (error) {
      console.warn(`Service test failed:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private static isUsableOpenAIKey(apiKey?: string): boolean {
    if (!apiKey) return false;
    const key = apiKey.trim();
    if (key.length <= 10) return false;
    const lower = key.toLowerCase();
    // Common placeholders / masked values that shouldn't be tested
    if (lower.includes('your-api-key')) return false;
    if (lower.includes('sk-your-')) return false;
    if (lower.includes('********')) return false;
    if (lower.endsWith('here')) return false;
    return true;
  }

  private static isUsableGeminiKey(apiKey?: string): boolean {
    if (!apiKey) return false;
    const key = apiKey.trim();
    if (key.length <= 10) return false;
    const lower = key.toLowerCase();
    if (lower.includes('your-api-key')) return false;
    if (lower.includes('********')) return false;
    if (lower.endsWith('here')) return false;
    return true;
  }

  static async createService(openaiApiKey?: string): Promise<EmbeddingService> {
    // 0. Allow forcing local embeddings to avoid any external API calls
    const provider = (process.env.EMBEDDINGS_PROVIDER || process.env.EMBEDDING_PROVIDER || '').toLowerCase();
    const disableExternal = (process.env.DISABLE_EXTERNAL_EMBEDDINGS || '').toLowerCase() === 'true';
    if (disableExternal || provider === 'local') {
      console.log('🔒 External embeddings disabled. Using local embeddings (no external APIs).');
      return new LocalEmbeddingService();
    }

    // 1. Intentar OpenAI si hay API key
    if (this.isUsableOpenAIKey(openaiApiKey)) {
      try {
        console.log('🔄 Probando servicio de embeddings de OpenAI...');
        const openaiService = new OpenAIEmbeddingService(openaiApiKey as string);
        const isWorking = await this.testService(openaiService);
        if (isWorking) {
          console.log('✅ OpenAI embeddings funcionando correctamente');
          return openaiService;
        }
      } catch (error) {
        console.warn('❌ OpenAI embeddings fallaron:', error instanceof Error ? error.message : String(error));
      }
    }

    // 2. Intentar Gemini (Google) si hay API key
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (this.isUsableGeminiKey(geminiApiKey)) {
      try {
        console.log('🔄 Probando servicio de embeddings de Gemini...');
        const geminiService = new GeminiEmbeddingService(geminiApiKey as string);
        const isWorking = await this.testService(geminiService);
        if (isWorking) {
          console.log('✅ Gemini embeddings funcionando correctamente');
          return geminiService;
        }
      } catch (error) {
        console.warn('❌ Gemini embeddings fallaron:', error instanceof Error ? error.message : String(error));
      }
    }

    // 3. Intentar Hugging Face (gratuito)
    try {
      console.log('🔄 Probando servicio de embeddings de Hugging Face...');
      const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
      const huggingFaceService = new HuggingFaceEmbeddingService(
        'sentence-transformers/all-MiniLM-L6-v2',
        huggingFaceApiKey,
      );
      const isWorking = await this.testService(huggingFaceService);
      if (isWorking) {
        console.log('✅ Hugging Face embeddings funcionando correctamente');
        return huggingFaceService;
      }
    } catch (error) {
      console.warn('❌ Hugging Face embeddings fallaron:', error instanceof Error ? error.message : String(error));
    }

    // 3. Usar servicio local como último recurso (siempre funciona)
    console.log('🔄 Usando embeddings locales (sin APIs externas)...');
    const localService = new LocalEmbeddingService();

    // El servicio local funciona sin entrenamiento inicial
    // Se puede entrenar más tarde si es necesario
    console.log('✅ Embeddings locales listos para usar');
    return localService;
  }

  // Nuevo método para crear servicio balanceado
  static async createBalancedService(openaiApiKey?: string): Promise<EmbeddingService> {
    // Limpiar balancer anterior
    // TODO: Implementar limpieza del balancer

    // OpenAI (prioridad alta, costo medio)
    if (EmbeddingServiceFactory.isUsableOpenAIKey(openaiApiKey)) {
      try {
        const openaiService = new OpenAIEmbeddingService(openaiApiKey as string);
        apiBalancer.registerProvider('OpenAI', openaiService, {
          name: 'OpenAI Embeddings',
          priority: 1,
          quotaLimit: 50000, // 50K tokens/hora
          costPerToken: 0.0001
        });
        console.log('✅ OpenAI registrado en balancer');
      } catch (error) {
        console.warn('❌ Error registrando OpenAI:', error);
      }
    }

    // Cohere (prioridad media, costo bajo)
    const cohereKey = process.env.COHERE_API_KEY;
    if (cohereKey && EmbeddingServiceFactory.isUsableOpenAIKey(cohereKey)) {
      try {
        const cohereService = new CohereEmbeddingService(cohereKey);
        apiBalancer.registerProvider('Cohere', cohereService, {
          name: 'Cohere Embeddings',
          priority: 2,
          quotaLimit: 100000, // 100K tokens/hora
          costPerToken: 0.00005
        });
        console.log('✅ Cohere registrado en balancer');
      } catch (error) {
        console.warn('❌ Error registrando Cohere:', error);
      }
    }

    // HuggingFace (prioridad baja, gratis)
    try {
      const huggingFaceService = new HuggingFaceEmbeddingService();
      apiBalancer.registerProvider('HuggingFace', huggingFaceService, {
        name: 'HuggingFace (Free)',
        priority: 3,
        quotaLimit: 10000, // Límite más bajo por rate limiting
        costPerToken: 0
      });
      console.log('✅ HuggingFace registrado en balancer');
    } catch (error) {
      console.warn('❌ Error registrando HuggingFace:', error);
    }

    // Local como último recurso
    try {
      const localService = new LocalEmbeddingService();
      apiBalancer.registerProvider('Local', localService, {
        name: 'Local Embeddings',
        priority: 4,
        quotaLimit: 5000, // Muy limitado
        costPerToken: 0
      });
      console.log('✅ Local registrado en balancer');
    } catch (error) {
      console.warn('❌ Error registrando Local:', error);
    }

    console.log(`[EmbeddingFactory] 🎯 Balanceador listo con ${apiBalancer.getAllProviderMetrics().length} proveedores`);

    // Devolver servicio que usa el balancer
    return new BalancedEmbeddingService();
  }
}

// Servicio que usa el balancer internamente
export class BalancedEmbeddingService implements EmbeddingService {
  async createEmbedding(text: string): Promise<number[]> {
    return apiBalancer.createEmbedding(text);
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    // Para múltiples textos, procesar uno por uno con balanceo
    const results: number[][] = [];
    for (const text of texts) {
      const embedding = await this.createEmbedding(text);
      results.push(embedding);
    }
    return results;
  }
}

