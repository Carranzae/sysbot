"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalancedEmbeddingService = exports.EmbeddingServiceFactory = exports.apiBalancer = exports.APIBalancerService = exports.GeminiEmbeddingService = exports.OpenAIEmbeddingService = exports.LocalEmbeddingService = exports.HuggingFaceEmbeddingService = exports.GeminiEmbeddingServiceLegacy = exports.CohereEmbeddingService = void 0;
class CohereEmbeddingService {
    constructor(apiKey) {
        this.apiUrl = 'https://api.cohere.ai/v1/embed';
        this.apiKey = apiKey;
    }
    async createEmbedding(text) {
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
            const result = await response.json();
            return result.embeddings[0];
        }
        catch (error) {
            console.error('Error creating Cohere embedding:', error);
            throw error;
        }
    }
    async createEmbeddings(texts) {
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
            const result = await response.json();
            return result.embeddings;
        }
        catch (error) {
            console.error('Error creating Cohere embeddings:', error);
            throw error;
        }
    }
}
exports.CohereEmbeddingService = CohereEmbeddingService;
class GeminiEmbeddingServiceLegacy {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    }
    async createEmbedding(text) {
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
            const result = await response.json();
            return result.embedding.values;
        }
        catch (error) {
            console.error('Error creating Gemini embedding:', error);
            throw error;
        }
    }
    async createEmbeddings(texts) {
        const results = [];
        for (const text of texts) {
            const embedding = await this.createEmbedding(text);
            results.push(embedding);
        }
        return results;
    }
}
exports.GeminiEmbeddingServiceLegacy = GeminiEmbeddingServiceLegacy;
class HuggingFaceEmbeddingService {
    constructor(modelName = 'sentence-transformers/all-MiniLM-L6-v2', apiKey) {
        this.modelName = modelName;
        this.apiKey = apiKey;
        this.apiUrl = `https://router.huggingface.co/hf-inference/models/${modelName}`;
    }
    async createEmbedding(text) {
        try {
            const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
            const headers = {
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
                if (response.status === 503) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return this.createEmbedding(text);
                }
                const body = await response.text().catch(() => '');
                throw new Error(`Hugging Face API error: ${response.status} ${response.statusText} ${body}`);
            }
            const result = await response.json();
            if (Array.isArray(result)) {
                return result[0] || result;
            }
            if (result.embeddings) {
                return result.embeddings[0] || result.embeddings;
            }
            return result;
        }
        catch (error) {
            console.error('Error creating embedding with Hugging Face:', error);
            throw error;
        }
    }
    async createEmbeddings(texts) {
        try {
            const batchSize = 50;
            const batches = [];
            for (let i = 0; i < texts.length; i += batchSize) {
                batches.push(texts.slice(i, i + batchSize));
            }
            console.log(`[EmbeddingService] Processing ${texts.length} texts in ${batches.length} batches`);
            const allEmbeddings = [];
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`[EmbeddingService] Processing batch ${i + 1}/${batches.length} (${batch.length} texts)`);
                const batchStartTime = Date.now();
                const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
                const headers = {
                    'Content-Type': 'application/json',
                };
                if (this.apiKey && this.apiKey.trim().length > 10) {
                    headers.Authorization = `Bearer ${this.apiKey}`;
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);
                try {
                    const response = await fetchFn(this.apiUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            inputs: batch,
                            options: {
                                wait_for_model: false,
                            },
                        }),
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        if (response.status === 503) {
                            console.log(`[EmbeddingService] Model loading, waiting 3 seconds before retry...`);
                            await new Promise(resolve => setTimeout(resolve, 3000));
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
                    let batchEmbeddings;
                    if (Array.isArray(result) && Array.isArray(result[0])) {
                        batchEmbeddings = result;
                    }
                    else if (Array.isArray(result) && typeof result[0] === 'number') {
                        batchEmbeddings = [result];
                    }
                    else {
                        batchEmbeddings = [result];
                    }
                    allEmbeddings.push(...batchEmbeddings);
                    const batchTime = Date.now() - batchStartTime;
                    console.log(`[EmbeddingService] Batch ${i + 1} completed in ${batchTime}ms`);
                }
                catch (error) {
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
        }
        catch (error) {
            console.error('[EmbeddingService] Error creating embeddings with Hugging Face:', error);
            throw error;
        }
    }
}
exports.HuggingFaceEmbeddingService = HuggingFaceEmbeddingService;
class LocalEmbeddingService {
    constructor() {
        this.vocabulary = new Map();
        this.documentFrequency = new Map();
        this.totalDocuments = 0;
        this.trainedChunks = [];
    }
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && word.length < 20)
            .slice(0, 100);
    }
    calculateTF(tokens) {
        const tf = new Map();
        const totalTokens = tokens.length;
        if (totalTokens === 0)
            return tf;
        tokens.forEach(token => {
            tf.set(token, (tf.get(token) || 0) + 1);
        });
        tf.forEach((count, token) => {
            tf.set(token, count / totalTokens);
        });
        return tf;
    }
    calculateIDF(token) {
        const df = this.documentFrequency.get(token) || 1;
        return Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
    }
    async createEmbedding(text) {
        const tokens = this.tokenize(text);
        const tf = this.calculateTF(tokens);
        const vector = new Array(200).fill(0);
        tokens.forEach((token, index) => {
            if (index < 200) {
                const tfValue = tf.get(token) || 0;
                const idfValue = this.calculateIDF(token);
                vector[index] = tfValue * idfValue;
            }
        });
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            return vector.map(val => val / magnitude);
        }
        return vector;
    }
    async createEmbeddings(texts) {
        const embeddings = [];
        for (const text of texts) {
            const embedding = await this.createEmbedding(text);
            embeddings.push(embedding);
        }
        return embeddings;
    }
    async trainOnChunks(chunks) {
        if (chunks.length === 0)
            return;
        this.trainedChunks = chunks;
        this.totalDocuments = chunks.length;
        this.vocabulary.clear();
        this.documentFrequency.clear();
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
    calculateSimilarity(text1, text2) {
        const tokens1 = new Set(this.tokenize(text1));
        const tokens2 = new Set(this.tokenize(text2));
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        return intersection.size / union.size;
    }
}
exports.LocalEmbeddingService = LocalEmbeddingService;
class OpenAIEmbeddingService {
    constructor(apiKey, model = 'text-embedding-3-small') {
        const OpenAI = require('openai');
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }
    async createEmbedding(text) {
        const response = await this.client.embeddings.create({
            model: this.model,
            input: text,
        });
        return response.data[0].embedding;
    }
    async createEmbeddings(texts) {
        const response = await this.client.embeddings.create({
            model: this.model,
            input: texts,
        });
        return response.data.map((item) => item.embedding);
    }
}
exports.OpenAIEmbeddingService = OpenAIEmbeddingService;
class GeminiEmbeddingService {
    constructor(apiKey, model = 'text-embedding-004') {
        this.apiKey = apiKey;
        this.model = model;
    }
    get baseUrl() {
        return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}`;
    }
    async postJson(path, body) {
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
    async createEmbedding(text) {
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
    async createEmbeddings(texts) {
        const requests = texts.map((text) => ({
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
        return embeddings.map((e) => {
            const values = e?.values;
            if (!Array.isArray(values)) {
                throw new Error('Gemini API error: invalid embedding in batch response');
            }
            return values;
        });
    }
}
exports.GeminiEmbeddingService = GeminiEmbeddingService;
class APIBalancerService {
    constructor() {
        this.providers = new Map();
        this.balanceStrategy = 'COST_OPTIMIZED';
        this.loadProviderMetrics();
    }
    registerProvider(id, service, config) {
        const providerConfig = {
            id,
            name: config.name || id,
            service,
            priority: config.priority || 1,
            quotaLimit: config.quotaLimit || 10000,
            usedTokens: config.usedTokens || 0,
            costPerToken: config.costPerToken || 0.0001,
            isActive: config.isActive !== false,
            lastUsed: config.lastUsed || new Date(),
            avgLatency: config.avgLatency || 1000,
            errorCount: config.errorCount || 0
        };
        this.providers.set(id, providerConfig);
        console.log(`[APIBalancer] ✅ Registrado proveedor: ${id} (Prioridad: ${providerConfig.priority})`);
    }
    async selectBestProvider(textLength = 1000) {
        const availableProviders = Array.from(this.providers.values())
            .filter(p => p.isActive)
            .filter(p => p.usedTokens + textLength <= p.quotaLimit);
        if (availableProviders.length === 0) {
            throw new Error('No hay proveedores disponibles o han excedido su quota');
        }
        let selectedProvider;
        switch (this.balanceStrategy) {
            case 'COST_OPTIMIZED':
                selectedProvider = availableProviders.reduce((best, current) => current.costPerToken < best.costPerToken ? current : best);
                break;
            case 'PERFORMANCE':
                selectedProvider = availableProviders.reduce((best, current) => current.avgLatency < best.avgLatency ? current : best);
                break;
            case 'LOAD_BALANCED':
                selectedProvider = availableProviders.reduce((best, current) => current.usedTokens < best.usedTokens ? current : best);
                break;
            case 'ROUND_ROBIN':
            default:
                const sortedByLastUsed = availableProviders.sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());
                selectedProvider = sortedByLastUsed[0];
                break;
        }
        selectedProvider.lastUsed = new Date();
        selectedProvider.usedTokens += textLength;
        console.log(`[APIBalancer] 🎯 Seleccionado: ${selectedProvider.name} (${this.balanceStrategy})`);
        return selectedProvider.service;
    }
    async createEmbedding(text) {
        const textTokens = Math.ceil(text.length / 4);
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const provider = await this.selectBestProvider(textTokens);
                const startTime = Date.now();
                const result = await provider.createEmbedding(text);
                const latency = Date.now() - startTime;
                this.updateProviderMetrics(provider.constructor.name, latency, false);
                return result;
            }
            catch (error) {
                lastError = error;
                console.warn(`[APIBalancer] ❌ Intento ${attempt + 1} falló:`, error.message);
            }
        }
        throw new Error(`Todos los proveedores fallaron. Último error: ${lastError?.message}`);
    }
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
    setBalanceStrategy(strategy) {
        this.balanceStrategy = strategy;
        console.log(`[APIBalancer] 🔄 Estrategia cambiada a: ${strategy}`);
    }
    updateProviderMetrics(providerId, latency, hadError) {
        const provider = Array.from(this.providers.values())
            .find(p => p.service.constructor.name === providerId);
        if (provider) {
            if (hadError) {
                provider.errorCount++;
            }
            else {
                provider.avgLatency = (provider.avgLatency + latency) / 2;
            }
        }
    }
    async loadProviderMetrics() {
    }
    resetHourlyCounters() {
        this.providers.forEach(provider => {
            provider.usedTokens = 0;
            provider.errorCount = 0;
        });
        console.log('[APIBalancer] 🔄 Contadores horarios reiniciados');
    }
}
exports.APIBalancerService = APIBalancerService;
exports.apiBalancer = new APIBalancerService();
class EmbeddingServiceFactory {
    static async testService(service, testText = "test") {
        try {
            const embedding = await service.createEmbedding(testText);
            return Array.isArray(embedding) && embedding.length > 0;
        }
        catch (error) {
            console.warn(`Service test failed:`, error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    static isUsableOpenAIKey(apiKey) {
        if (!apiKey)
            return false;
        const key = apiKey.trim();
        if (key.length <= 10)
            return false;
        const lower = key.toLowerCase();
        if (lower.includes('your-api-key'))
            return false;
        if (lower.includes('sk-your-'))
            return false;
        if (lower.includes('********'))
            return false;
        if (lower.endsWith('here'))
            return false;
        return true;
    }
    static isUsableGeminiKey(apiKey) {
        if (!apiKey)
            return false;
        const key = apiKey.trim();
        if (key.length <= 10)
            return false;
        const lower = key.toLowerCase();
        if (lower.includes('your-api-key'))
            return false;
        if (lower.includes('********'))
            return false;
        if (lower.endsWith('here'))
            return false;
        return true;
    }
    static async createService(openaiApiKey) {
        const provider = (process.env.EMBEDDINGS_PROVIDER || process.env.EMBEDDING_PROVIDER || '').toLowerCase();
        const disableExternal = (process.env.DISABLE_EXTERNAL_EMBEDDINGS || '').toLowerCase() === 'true';
        if (disableExternal || provider === 'local') {
            console.log('🔒 External embeddings disabled. Using local embeddings (no external APIs).');
            return new LocalEmbeddingService();
        }
        if (this.isUsableOpenAIKey(openaiApiKey)) {
            try {
                console.log('🔄 Probando servicio de embeddings de OpenAI...');
                const openaiService = new OpenAIEmbeddingService(openaiApiKey);
                const isWorking = await this.testService(openaiService);
                if (isWorking) {
                    console.log('✅ OpenAI embeddings funcionando correctamente');
                    return openaiService;
                }
            }
            catch (error) {
                console.warn('❌ OpenAI embeddings fallaron:', error instanceof Error ? error.message : String(error));
            }
        }
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (this.isUsableGeminiKey(geminiApiKey)) {
            try {
                console.log('🔄 Probando servicio de embeddings de Gemini...');
                const geminiService = new GeminiEmbeddingService(geminiApiKey);
                const isWorking = await this.testService(geminiService);
                if (isWorking) {
                    console.log('✅ Gemini embeddings funcionando correctamente');
                    return geminiService;
                }
            }
            catch (error) {
                console.warn('❌ Gemini embeddings fallaron:', error instanceof Error ? error.message : String(error));
            }
        }
        try {
            console.log('🔄 Probando servicio de embeddings de Hugging Face...');
            const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
            const huggingFaceService = new HuggingFaceEmbeddingService('sentence-transformers/all-MiniLM-L6-v2', huggingFaceApiKey);
            const isWorking = await this.testService(huggingFaceService);
            if (isWorking) {
                console.log('✅ Hugging Face embeddings funcionando correctamente');
                return huggingFaceService;
            }
        }
        catch (error) {
            console.warn('❌ Hugging Face embeddings fallaron:', error instanceof Error ? error.message : String(error));
        }
        console.log('🔄 Usando embeddings locales (sin APIs externas)...');
        const localService = new LocalEmbeddingService();
        console.log('✅ Embeddings locales listos para usar');
        return localService;
    }
    static async createBalancedService(openaiApiKey) {
        if (EmbeddingServiceFactory.isUsableOpenAIKey(openaiApiKey)) {
            try {
                const openaiService = new OpenAIEmbeddingService(openaiApiKey);
                exports.apiBalancer.registerProvider('OpenAI', openaiService, {
                    name: 'OpenAI Embeddings',
                    priority: 1,
                    quotaLimit: 50000,
                    costPerToken: 0.0001
                });
                console.log('✅ OpenAI registrado en balancer');
            }
            catch (error) {
                console.warn('❌ Error registrando OpenAI:', error);
            }
        }
        const cohereKey = process.env.COHERE_API_KEY;
        if (cohereKey && EmbeddingServiceFactory.isUsableOpenAIKey(cohereKey)) {
            try {
                const cohereService = new CohereEmbeddingService(cohereKey);
                exports.apiBalancer.registerProvider('Cohere', cohereService, {
                    name: 'Cohere Embeddings',
                    priority: 2,
                    quotaLimit: 100000,
                    costPerToken: 0.00005
                });
                console.log('✅ Cohere registrado en balancer');
            }
            catch (error) {
                console.warn('❌ Error registrando Cohere:', error);
            }
        }
        try {
            const huggingFaceService = new HuggingFaceEmbeddingService();
            exports.apiBalancer.registerProvider('HuggingFace', huggingFaceService, {
                name: 'HuggingFace (Free)',
                priority: 3,
                quotaLimit: 10000,
                costPerToken: 0
            });
            console.log('✅ HuggingFace registrado en balancer');
        }
        catch (error) {
            console.warn('❌ Error registrando HuggingFace:', error);
        }
        try {
            const localService = new LocalEmbeddingService();
            exports.apiBalancer.registerProvider('Local', localService, {
                name: 'Local Embeddings',
                priority: 4,
                quotaLimit: 5000,
                costPerToken: 0
            });
            console.log('✅ Local registrado en balancer');
        }
        catch (error) {
            console.warn('❌ Error registrando Local:', error);
        }
        console.log(`[EmbeddingFactory] 🎯 Balanceador listo con ${exports.apiBalancer.getAllProviderMetrics().length} proveedores`);
        return new BalancedEmbeddingService();
    }
}
exports.EmbeddingServiceFactory = EmbeddingServiceFactory;
class BalancedEmbeddingService {
    async createEmbedding(text) {
        return exports.apiBalancer.createEmbedding(text);
    }
    async createEmbeddings(texts) {
        const results = [];
        for (const text of texts) {
            const embedding = await this.createEmbedding(text);
            results.push(embedding);
        }
        return results;
    }
}
exports.BalancedEmbeddingService = BalancedEmbeddingService;
//# sourceMappingURL=embedding.service.js.map