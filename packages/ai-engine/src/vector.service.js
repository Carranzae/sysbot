"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorService = void 0;
class VectorService {
    constructor(config) {
        this.config = config;
    }
    async createCollection(collectionName, vectorSize = 1536) {
        try {
            const existing = await fetch(`${this.config.url}/collections/${collectionName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
                },
            });
            if (existing.ok) {
                const existingData = (await existing.json());
                const existingSize = existingData?.result?.config?.params?.vectors?.size ??
                    existingData?.result?.config?.params?.vector_size;
                if (typeof existingSize === 'number' && existingSize !== vectorSize) {
                    console.warn(`[VectorService] Collection ${collectionName} exists with size=${existingSize}, expected=${vectorSize}. Recreating collection...`);
                    const del = await fetch(`${this.config.url}/collections/${collectionName}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
                        },
                    });
                    if (!del.ok) {
                        const delBody = await del.text().catch(() => '');
                        throw new Error(`Failed to delete collection for resize: ${del.status} ${del.statusText} ${delBody}`);
                    }
                }
                else {
                    return;
                }
            }
            const response = await fetch(`${this.config.url}/collections/${collectionName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    vectors: {
                        size: vectorSize,
                        distance: 'Cosine',
                    },
                }),
            });
            if (!response.ok && response.status !== 409) {
                const body = await response.text().catch(() => '');
                throw new Error(`Failed to create collection: ${response.status} ${response.statusText} ${body}`);
            }
        }
        catch (error) {
            console.error('Vector DB Create Collection Error:', error);
            throw error;
        }
    }
    async upsertVectors(collectionName, vectors) {
        try {
            const response = await fetch(`${this.config.url}/collections/${collectionName}/points`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    points: vectors.map((v) => ({
                        id: v.id,
                        vector: v.vector,
                        payload: v.payload,
                    })),
                }),
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`Failed to upsert vectors: ${response.status} ${response.statusText} ${body}`);
            }
        }
        catch (error) {
            console.error('Vector DB Upsert Error:', error);
            throw error;
        }
    }
    async search(collectionName, queryVector, limit = 5, filter, scoreThreshold = 0.3) {
        try {
            const searchLimit = Math.max(limit * 2, 20);
            const response = await fetch(`${this.config.url}/collections/${collectionName}/points/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    vector: queryVector,
                    limit: searchLimit,
                    with_payload: true,
                    score_threshold: scoreThreshold,
                    ...(filter && { filter }),
                }),
            });
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`[VectorService] Collection ${collectionName} not found. Returning empty results.`);
                    return [];
                }
                throw new Error(`Failed to search vectors: ${response.statusText}`);
            }
            const data = await response.json();
            if (!data.result || !Array.isArray(data.result)) {
                console.warn(`[VectorService] Invalid search result format. Returning empty results.`);
                return [];
            }
            const results = data.result
                .filter((item) => item.payload?.content && item.payload.content.trim().length > 0)
                .filter((item) => (item.score || 0) >= (scoreThreshold || 0.2))
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, limit)
                .map((item) => ({
                id: item.id,
                content: item.payload.content,
                score: item.score || 0,
                metadata: item.payload.metadata || {},
            }));
            console.log(`[VectorService] Found ${results.length} relevant results (from ${data.result.length} total, threshold: ${scoreThreshold || 0.2})`);
            return results;
        }
        catch (error) {
            console.error('Vector DB Search Error:', error);
            throw error;
        }
    }
    async deleteVectors(collectionName, ids) {
        try {
            const response = await fetch(`${this.config.url}/collections/${collectionName}/points/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
                },
                body: JSON.stringify({
                    points: ids,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to delete vectors: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error('Vector DB Delete Error:', error);
            throw error;
        }
    }
}
exports.VectorService = VectorService;
//# sourceMappingURL=vector.service.js.map