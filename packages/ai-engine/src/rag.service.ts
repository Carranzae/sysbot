import { OpenAIService } from './openai.service';
import { VectorService } from './vector.service';
import { EmbeddingService } from './embedding.service';
import { AIPromptContext, AIResponse, VectorSearchResult } from '@syst/shared';

export class RAGService {
 
  private async getSpecializedAPIs(_businessId: string, _industryType: string): Promise<Array<{ id: string; name: string; getContext: (message: string, businessId: string) => Promise<string> }>> {
    return [];
  }
 
  private async enrichContextWithSpecializedAPIs(
    customerMessage: string,
    specializedAPIs: Array<{ id: string; name: string; getContext: (message: string, businessId: string) => Promise<string> }>,
    businessId: string,
  ): Promise<string> {
    const results = await Promise.allSettled(
      specializedAPIs.map((api) => api.getContext(customerMessage, businessId)),
    );
 
    return results
      .filter(
        (r): r is PromiseFulfilledResult<string> =>
          r.status === 'fulfilled' && typeof r.value === 'string' && r.value.trim().length > 0,
      )
      .map((r) => r.value.trim())
      .join('\n\n');
  }
 
  constructor(
    private embeddingService: EmbeddingService,
    private vectorService: VectorService,
    private openaiService?: OpenAIService // Opcional, solo para generar respuestas si se usa OpenAI
  ) {}

  async generateContextualResponse(
    businessId: string,
    businessName: string,
    industryType: string,
    customerMessage: string,
    customPrompt?: string,
    conversationHistory?: string[],
    responseGenerator?: (context: AIPromptContext) => Promise<AIResponse>
  ): Promise<AIResponse> {

    // 🚀 MEJORA: Sistema de APIs especializadas por tipo de contenido
    const specializedAPIs = await this.getSpecializedAPIs(businessId, industryType);

    // Si hay APIs especializadas disponibles, usarlas para enriquecer el contexto
    let enrichedContext = '';
    if (specializedAPIs.length > 0) {
      enrichedContext = await this.enrichContextWithSpecializedAPIs(
        customerMessage,
        specializedAPIs,
        businessId
      );
    }

    // 🚨 NUEVO: Función para resumir historial de conversación
    const summarizeConversationHistory = (history: string[], maxLength: number = 1000): string => {
      if (!history || history.length === 0) return '';

      // Tomar solo los últimos 3 mensajes para evitar sobrecargar
      const recentHistory = history.slice(-3);

      // Resumir cada mensaje a su esencia
      const summarized = recentHistory.map(msg => {
        if (msg.length > 200) {
          // Extraer la intención principal del mensaje
          const lowerMsg = msg.toLowerCase();
          if (lowerMsg.includes('precio') || lowerMsg.includes('costo') || lowerMsg.includes('cuánto')) {
            return 'Cliente preguntó por precios';
          }
          if (lowerMsg.includes('horario') || lowerMsg.includes('hora') || lowerMsg.includes('cuándo')) {
            return 'Cliente preguntó por horarios';
          }
          if (lowerMsg.includes('cita') || lowerMsg.includes('agendar') || lowerMsg.includes('appointment')) {
            return 'Cliente quiere agendar cita';
          }
          if (lowerMsg.includes('servicio') || lowerMsg.includes('producto')) {
            return 'Cliente preguntó por servicios/productos';
          }
          // Para mensajes largos, tomar solo el principio
          return msg.substring(0, 150) + '...';
        }
        return msg;
      });

      const result = summarized.join(' | ');
      return result.length > maxLength ? result.substring(0, maxLength) + '...' : result;
    };

    // 🚨 NUEVO: Función para extraer información crítica de chunks
    const extractCriticalInfo = (chunks: string[]): string[] => {
      return chunks.map(chunk => {
        // Buscar información crítica: precios, RUC, direcciones, teléfonos, horarios
        const criticalPatterns = [
          /\b\d{11}\b/g, // RUC (11 dígitos)
          /\b\d{3,4}-\d{4,7}\b/g, // Teléfonos
          /\bS\/\s*\d+[\.,]\d{2}\b/g, // Precios en soles
          /\$\s*\d+[\.,]\d{2}\b/g, // Precios en dólares
          /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/g, // Horarios
          /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi, // Fechas
        ];

        let criticalInfo = '';
        criticalPatterns.forEach(pattern => {
          const matches = chunk.match(pattern);
          if (matches) {
            criticalInfo += matches.join(', ') + ' | ';
          }
        });

        // Si encontramos info crítica, incluirla junto con contexto breve
        if (criticalInfo) {
          const contextStart = chunk.indexOf(criticalInfo.split(' | ')[0]);
          const context = chunk.substring(Math.max(0, contextStart - 50), contextStart + 100);
          return `${criticalInfo}${context}`.substring(0, 300);
        }

        // Si no hay info crítica, resumir el chunk
        return chunk.length > 200 ? chunk.substring(0, 200) + '...' : chunk;
      });
    };
    // MEJORA: Manejar errores de embeddings con fallback inteligente
    let queryEmbedding: number[];
    try {
      // Usar el servicio de embeddings (gratuito o OpenAI)
      queryEmbedding = await this.embeddingService.createEmbedding(customerMessage);
    } catch (error: any) {
      // Si falla (ej: API key inválida o servicio caído), intentar con fallback inteligente
      console.error('[RAG] Primary embedding service failed:', error.message);
      console.log('[RAG] Attempting smart fallback embedding service...');
      
      try {
        const { EmbeddingServiceFactory } = require('./embedding.service');
        const openaiKey = process.env.OPENAI_API_KEY;
        const fallbackService = await EmbeddingServiceFactory.createService(openaiKey);
        queryEmbedding = await fallbackService.createEmbedding(customerMessage);
        console.log(`[RAG] ✅ Smart fallback successful (${fallbackService?.constructor?.name || 'unknown'})`);
      } catch (fallbackError: any) {
        console.error('[RAG] ❌ Smart fallback also failed:', fallbackError.message);
        throw new Error(`Failed to create embedding with both primary and fallback services: ${error.message}`);
      }
    }

    // OPTIMIZACIÓN: Buscar chunks con umbral más bajo para incluir información completa
    const relevantContext = await this.vectorService.search(
      `business_${businessId}`,
      queryEmbedding,
      10, // Buscar hasta 10 chunks relevantes
      {
        must: [
          {
            key: 'businessId',
            match: { value: businessId },
          },
        ],
      },
      0.15 // Umbral más bajo para incluir chunks de medicamentos, precios y reglas
    );

    // Conservar chunks reales para que la IA los lea sin recortes destructivos
    const knowledgeContext = relevantContext
      .filter((result) => result.content && result.content.trim().length > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0)) // Ordenar por relevancia
      .map((result) => result.content)
      .slice(0, 5); // Aumentar a 5 chunks máximo con su contenido original

    console.log(`[RAG] Found ${knowledgeContext.length} original chunks from ${relevantContext.length} results`);

    // 🚨 NUEVO: Resumir historial de conversación para evitar sobrecarga de tokens
    const summarizedHistory = conversationHistory ?
      [summarizeConversationHistory(conversationHistory)] : undefined;

    const promptContext: AIPromptContext = {
      businessId,
      businessName,
      industryType,
      customerMessage,
      knowledgeContext: knowledgeContext, // Usar contexto original sin truncamiento agresivo
      customPrompt,
      conversationHistory: summarizedHistory, // Usar historial resumido
    };

    // Si hay un generador de respuestas personalizado, usarlo (para Groq, Gemini, etc.)
    if (responseGenerator) {
      return responseGenerator(promptContext);
    }

    // Si no, usar OpenAI (compatibilidad hacia atrás)
    if (this.openaiService) {
      return this.openaiService.generateResponse(promptContext);
    }

    throw new Error('No response generator provided and OpenAI service not available');
  }

  async processAndStoreKnowledge(
    businessId: string,
    chunks: Array<{ id: string; content: string; metadata?: any }>
  ): Promise<void> {
    const collectionName = `business_${businessId}`;
    const texts = chunks.map((chunk) => chunk.content);
    // MEJORA: Usar el servicio de embeddings con fallback automático
    let embeddings: number[][];
    try {
      embeddings = await this.embeddingService.createEmbeddings(texts);
    } catch (error: any) {
      console.error('[RAG] Primary embedding service failed for batch processing:', error.message);
      console.log('[RAG] Attempting smart fallback embedding service for batch...');
      
      try {
        const { EmbeddingServiceFactory } = require('./embedding.service');
        const openaiKey = process.env.OPENAI_API_KEY;
        const fallbackService = await EmbeddingServiceFactory.createService(openaiKey);
        embeddings = await fallbackService.createEmbeddings(texts);
        console.log(`[RAG] ✅ Smart fallback successful for batch (${fallbackService?.constructor?.name || 'unknown'})`);
      } catch (fallbackError: any) {
        console.error('[RAG] ❌ Smart fallback also failed for batch:', fallbackError.message);
        throw new Error(`Failed to create embeddings with both primary and fallback services: ${error.message}`);
      }
    }

    const vectorSize = embeddings[0]?.length || 1536;
    await this.vectorService.createCollection(collectionName, vectorSize);

    const vectors = chunks.map((chunk, index) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        content: chunk.content,
        businessId,
        metadata: chunk.metadata || {},
      },
    }));

    await this.vectorService.upsertVectors(collectionName, vectors);
  }

  async deleteKnowledge(businessId: string, chunkIds: string[]): Promise<void> {
    const collectionName = `business_${businessId}`;
    await this.vectorService.deleteVectors(collectionName, chunkIds);
  }
}
