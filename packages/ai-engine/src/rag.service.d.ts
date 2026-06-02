import { OpenAIService } from './openai.service';
import { VectorService } from './vector.service';
import { EmbeddingService } from './embedding.service';
import { AIPromptContext, AIResponse } from '@syst/shared';
export declare class RAGService {
    private embeddingService;
    private vectorService;
    private openaiService?;
    private getSpecializedAPIs;
    private enrichContextWithSpecializedAPIs;
    constructor(embeddingService: EmbeddingService, vectorService: VectorService, openaiService?: OpenAIService);
    generateContextualResponse(businessId: string, businessName: string, industryType: string, customerMessage: string, customPrompt?: string, conversationHistory?: string[], responseGenerator?: (context: AIPromptContext) => Promise<AIResponse>): Promise<AIResponse>;
    processAndStoreKnowledge(businessId: string, chunks: Array<{
        id: string;
        content: string;
        metadata?: any;
    }>): Promise<void>;
    deleteKnowledge(businessId: string, chunkIds: string[]): Promise<void>;
}
//# sourceMappingURL=rag.service.d.ts.map