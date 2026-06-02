import { AIPromptContext, AIResponse } from '@syst/shared';
export declare class OpenAIService {
    private client;
    constructor(apiKey?: string);
    generateResponse(context: AIPromptContext): Promise<AIResponse>;
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
    private buildSystemPrompt;
    private buildMessages;
    private shouldEscalateToHuman;
    private calculateConfidence;
}
//# sourceMappingURL=openai.service.d.ts.map