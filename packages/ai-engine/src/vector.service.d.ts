import { VectorSearchResult } from '@syst/shared';
export interface VectorDBConfig {
    url: string;
    apiKey?: string;
}
export declare class VectorService {
    private config;
    constructor(config: VectorDBConfig);
    createCollection(collectionName: string, vectorSize?: number): Promise<void>;
    upsertVectors(collectionName: string, vectors: Array<{
        id: string;
        vector: number[];
        payload: any;
    }>): Promise<void>;
    search(collectionName: string, queryVector: number[], limit?: number, filter?: any, scoreThreshold?: number): Promise<VectorSearchResult[]>;
    deleteVectors(collectionName: string, ids: string[]): Promise<void>;
}
//# sourceMappingURL=vector.service.d.ts.map