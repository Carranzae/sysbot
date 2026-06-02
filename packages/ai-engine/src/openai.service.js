"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIService = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIService {
    constructor(apiKey) {
        if (apiKey && apiKey !== 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
            this.client = new openai_1.default({ apiKey });
        }
        else {
            this.client = null;
            console.warn('OpenAI API key not configured. AI features will be disabled.');
        }
    }
    async generateResponse(context) {
        const startTime = Date.now();
        if (!this.client) {
            throw new Error('OpenAI client not initialized. Please configure OPENAI_API_KEY.');
        }
        try {
            const systemPrompt = this.buildSystemPrompt(context);
            const messages = this.buildMessages(context, systemPrompt);
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages,
                temperature: 0.7,
                max_tokens: 500,
            });
            const message = completion.choices[0]?.message?.content || '';
            const processingTime = Date.now() - startTime;
            const shouldEscalate = this.shouldEscalateToHuman(message, context);
            const confidence = this.calculateConfidence(completion, context);
            return {
                message,
                confidence,
                shouldEscalate,
                processingTime,
            };
        }
        catch (error) {
            console.error('OpenAI API Error:', error);
            throw error;
        }
    }
    async createEmbedding(text) {
        if (!this.client) {
            throw new Error('OpenAI service not configured');
        }
        try {
            const response = await this.client.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
            });
            return response.data[0].embedding;
        }
        catch (error) {
            console.error('OpenAI Embedding Error:', error);
            throw error;
        }
    }
    async createEmbeddings(texts) {
        if (!this.client) {
            throw new Error('OpenAI client not initialized. Please configure OPENAI_API_KEY.');
        }
        try {
            const response = await this.client.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts,
            });
            return response.data.map((item) => item.embedding);
        }
        catch (error) {
            console.error('OpenAI Embeddings Error:', error);
            throw error;
        }
    }
    buildSystemPrompt(context) {
        const { INDUSTRY_PROMPTS } = require('@syst/shared');
        const basePrompt = INDUSTRY_PROMPTS[context.industryType] || INDUSTRY_PROMPTS.OTHER;
        let prompt = basePrompt.replace('{businessName}', context.businessName);
        if (context.customPrompt) {
            prompt += `\n\nInstrucciones adicionales: ${context.customPrompt}`;
        }
        if (context.knowledgeContext.length > 0) {
            prompt += `\n\nContexto relevante del negocio:\n${context.knowledgeContext.join('\n\n')}`;
        }
        return prompt;
    }
    buildMessages(context, systemPrompt) {
        const messages = [
            { role: 'system', content: systemPrompt },
        ];
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            context.conversationHistory.forEach((msg) => {
                messages.push({ role: 'user', content: msg });
            });
        }
        messages.push({ role: 'user', content: context.customerMessage });
        return messages;
    }
    shouldEscalateToHuman(message, context) {
        const escalationPhrases = [
            'un asesor',
            'no tengo información',
            'no puedo ayudar',
            'contactar',
            'no estoy seguro',
        ];
        return escalationPhrases.some((phrase) => message.toLowerCase().includes(phrase));
    }
    calculateConfidence(completion, context) {
        let confidence = 0.8;
        if (context.knowledgeContext.length === 0) {
            confidence -= 0.3;
        }
        if (completion.choices[0]?.finish_reason === 'length') {
            confidence -= 0.1;
        }
        return Math.max(0, Math.min(1, confidence));
    }
}
exports.OpenAIService = OpenAIService;
//# sourceMappingURL=openai.service.js.map