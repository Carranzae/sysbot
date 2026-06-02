"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGService = void 0;
class RAGService {
    async getSpecializedAPIs(_businessId, _industryType) {
        return [];
    }
    async enrichContextWithSpecializedAPIs(customerMessage, specializedAPIs, businessId) {
        const results = await Promise.allSettled(specializedAPIs.map((api) => api.getContext(customerMessage, businessId)));
        return results
            .filter((r) => r.status === 'fulfilled' && typeof r.value === 'string' && r.value.trim().length > 0)
            .map((r) => r.value.trim())
            .join('\n\n');
    }
    constructor(embeddingService, vectorService, openaiService) {
        this.embeddingService = embeddingService;
        this.vectorService = vectorService;
        this.openaiService = openaiService;
    }
    async generateContextualResponse(businessId, businessName, industryType, customerMessage, customPrompt, conversationHistory, responseGenerator) {
        const specializedAPIs = await this.getSpecializedAPIs(businessId, industryType);
        let enrichedContext = '';
        if (specializedAPIs.length > 0) {
            enrichedContext = await this.enrichContextWithSpecializedAPIs(customerMessage, specializedAPIs, businessId);
        }
        const summarizeConversationHistory = (history, maxLength = 1000) => {
            if (!history || history.length === 0)
                return '';
            const recentHistory = history.slice(-3);
            const summarized = recentHistory.map(msg => {
                if (msg.length > 200) {
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
                    return msg.substring(0, 150) + '...';
                }
                return msg;
            });
            const result = summarized.join(' | ');
            return result.length > maxLength ? result.substring(0, maxLength) + '...' : result;
        };
        const extractCriticalInfo = (chunks) => {
            return chunks.map(chunk => {
                const criticalPatterns = [
                    /\b\d{11}\b/g,
                    /\b\d{3,4}-\d{4,7}\b/g,
                    /\bS\/\s*\d+[\.,]\d{2}\b/g,
                    /\$\s*\d+[\.,]\d{2}\b/g,
                    /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/g,
                    /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi,
                ];
                let criticalInfo = '';
                criticalPatterns.forEach(pattern => {
                    const matches = chunk.match(pattern);
                    if (matches) {
                        criticalInfo += matches.join(', ') + ' | ';
                    }
                });
                if (criticalInfo) {
                    const contextStart = chunk.indexOf(criticalInfo.split(' | ')[0]);
                    const context = chunk.substring(Math.max(0, contextStart - 50), contextStart + 100);
                    return `${criticalInfo}${context}`.substring(0, 300);
                }
                return chunk.length > 200 ? chunk.substring(0, 200) + '...' : chunk;
            });
        };
        let queryEmbedding;
        try {
            queryEmbedding = await this.embeddingService.createEmbedding(customerMessage);
        }
        catch (error) {
            console.error('[RAG] Primary embedding service failed:', error.message);
            console.log('[RAG] Attempting smart fallback embedding service...');
            try {
                const { EmbeddingServiceFactory } = require('./embedding.service');
                const openaiKey = process.env.OPENAI_API_KEY;
                const fallbackService = await EmbeddingServiceFactory.createService(openaiKey);
                queryEmbedding = await fallbackService.createEmbedding(customerMessage);
                console.log(`[RAG] ✅ Smart fallback successful (${fallbackService?.constructor?.name || 'unknown'})`);
            }
            catch (fallbackError) {
                console.error('[RAG] ❌ Smart fallback also failed:', fallbackError.message);
                throw new Error(`Failed to create embedding with both primary and fallback services: ${error.message}`);
            }
        }
        const relevantContext = await this.vectorService.search(`business_${businessId}`, queryEmbedding, 5, {
            must: [
                {
                    key: 'businessId',
                    match: { value: businessId },
                },
            ],
        }, 0.15);
        const knowledgeContext = relevantContext
            .filter((result) => result.content && result.content.trim().length > 0)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((result) => result.content)
            .slice(0, 3);
        const criticalKnowledgeContext = extractCriticalInfo(knowledgeContext);
        console.log(`[RAG] Found ${criticalKnowledgeContext.length} critical chunks from ${relevantContext.length} results`);
        const summarizedHistory = conversationHistory ?
            [summarizeConversationHistory(conversationHistory)] : undefined;
        const promptContext = {
            businessId,
            businessName,
            industryType,
            customerMessage,
            knowledgeContext: criticalKnowledgeContext,
            customPrompt,
            conversationHistory: summarizedHistory,
        };
        if (responseGenerator) {
            return responseGenerator(promptContext);
        }
        if (this.openaiService) {
            return this.openaiService.generateResponse(promptContext);
        }
        throw new Error('No response generator provided and OpenAI service not available');
    }
    async processAndStoreKnowledge(businessId, chunks) {
        const collectionName = `business_${businessId}`;
        const texts = chunks.map((chunk) => chunk.content);
        let embeddings;
        try {
            embeddings = await this.embeddingService.createEmbeddings(texts);
        }
        catch (error) {
            console.error('[RAG] Primary embedding service failed for batch processing:', error.message);
            console.log('[RAG] Attempting smart fallback embedding service for batch...');
            try {
                const { EmbeddingServiceFactory } = require('./embedding.service');
                const openaiKey = process.env.OPENAI_API_KEY;
                const fallbackService = await EmbeddingServiceFactory.createService(openaiKey);
                embeddings = await fallbackService.createEmbeddings(texts);
                console.log(`[RAG] ✅ Smart fallback successful for batch (${fallbackService?.constructor?.name || 'unknown'})`);
            }
            catch (fallbackError) {
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
    async deleteKnowledge(businessId, chunkIds) {
        const collectionName = `business_${businessId}`;
        await this.vectorService.deleteVectors(collectionName, chunkIds);
    }
}
exports.RAGService = RAGService;
//# sourceMappingURL=rag.service.js.map