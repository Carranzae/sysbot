export interface EmbeddingService {
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
export declare class CohereEmbeddingService implements EmbeddingService {
    private apiKey;
    private apiUrl;
    constructor(apiKey: string);
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
export declare class GeminiEmbeddingServiceLegacy implements EmbeddingService {
    private apiKey;
    private apiUrl;
    constructor(apiKey: string);
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
export declare class HuggingFaceEmbeddingService implements EmbeddingService {
    private modelName;
    private apiUrl;
    private apiKey?;
    constructor(modelName?: string, apiKey?: string);
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
export declare class LocalEmbeddingService implements EmbeddingService {
    private vocabulary;
    private documentFrequency;
    private totalDocuments;
    private trainedChunks;
    private tokenize;
    private calculateTF;
    private calculateIDF;
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
    trainOnChunks(chunks: string[]): Promise<void>;
    calculateSimilarity(text1: string, text2: string): number;
}
export declare class OpenAIEmbeddingService implements EmbeddingService {
    private client;
    private model;
    constructor(apiKey: string, model?: string);
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
export declare class GeminiEmbeddingService implements EmbeddingService {
    private apiKey;
    private model;
    constructor(apiKey: string, model?: string);
    private get baseUrl();
    private postJson;
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
export interface APIProviderConfig {
    id: string;
    name: string;
    service: EmbeddingService;
    priority: number;
    quotaLimit: number;
    usedTokens: number;
    costPerToken: number;
    isActive: boolean;
    lastUsed: Date;
    avgLatency: number;
    errorCount: number;
}
export declare class APIBalancerService {
    private providers;
    private balanceStrategy;
    constructor();
    registerProvider(id: string, service: EmbeddingService, config: Partial<APIProviderConfig>): void;
    selectBestProvider(textLength?: number): Promise<EmbeddingService>;
    createEmbedding(text: string): Promise<number[]>;
    getAllProviderMetrics(): {
        id: string;
        name: string;
        isActive: boolean;
        usedTokens: number;
        quotaLimit: number;
        usagePercent: number;
        costPerToken: number;
        avgLatency: number;
        errorCount: number;
        lastUsed: Date;
    }[];
    setBalanceStrategy(strategy: 'ROUND_ROBIN' | 'COST_OPTIMIZED' | 'PERFORMANCE' | 'LOAD_BALANCED'): void;
    private updateProviderMetrics;
    private loadProviderMetrics;
    resetHourlyCounters(): void;
}
export declare const apiBalancer: APIBalancerService;
export declare class EmbeddingServiceFactory {
    private static testService;
    private static isUsableOpenAIKey;
    private static isUsableGeminiKey;
    static createService(openaiApiKey?: string): Promise<EmbeddingService>;
    static createBalancedService(openaiApiKey?: string): Promise<EmbeddingService>;
}
export declare class BalancedEmbeddingService implements EmbeddingService {
    createEmbedding(text: string): Promise<number[]>;
    createEmbeddings(texts: string[]): Promise<number[][]>;
}
//# sourceMappingURL=embedding.service.d.ts.map