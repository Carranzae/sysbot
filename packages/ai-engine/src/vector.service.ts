import { VectorSearchResult } from '@syst/shared';

export interface VectorDBConfig {
  url: string;
  apiKey?: string;
}

export class VectorService {
  private config: VectorDBConfig;

  constructor(config: VectorDBConfig) {
    this.config = config;
  }

  async createCollection(collectionName: string, vectorSize: number = 1536): Promise<void> {
    try {
      // If collection exists, ensure vector size matches.
      const existing = await fetch(`${this.config.url}/collections/${collectionName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
        },
      });

      if (existing.ok) {
        const existingData = (await existing.json()) as any;
        const existingSize =
          existingData?.result?.config?.params?.vectors?.size ??
          existingData?.result?.config?.params?.vector_size;

        if (typeof existingSize === 'number' && existingSize !== vectorSize) {
          console.warn(
            `[VectorService] Collection ${collectionName} exists with size=${existingSize}, expected=${vectorSize}. Recreating collection...`,
          );

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
        } else {
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
    } catch (error) {
      console.error('Vector DB Create Collection Error:', error);
      throw error;
    }
  }

  async upsertVectors(
    collectionName: string,
    vectors: Array<{ id: string; vector: number[]; payload: any }>
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.url}/collections/${collectionName}/points`,
        {
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
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to upsert vectors: ${response.status} ${response.statusText} ${body}`);
      }
    } catch (error) {
      console.error('Vector DB Upsert Error:', error);
      throw error;
    }
  }

  async search(
    collectionName: string,
    queryVector: number[],
    limit: number = 5,
    filter?: any,
    scoreThreshold: number = 0.3 // MEJORA: Umbral de similitud más bajo para no perder información relevante
  ): Promise<VectorSearchResult[]> {
    try {
      // MEJORA: Buscar más resultados y filtrar por score después
      const searchLimit = Math.max(limit * 2, 20); // Buscar el doble para tener más opciones
      
      const response = await fetch(
        `${this.config.url}/collections/${collectionName}/points/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
          },
          body: JSON.stringify({
            vector: queryVector,
            limit: searchLimit,
            with_payload: true,
            score_threshold: scoreThreshold, // Filtrar por similitud mínima
            ...(filter && { filter }),
          }),
        }
      );

      if (!response.ok) {
        // Si la colección no existe, retornar array vacío en lugar de error
        if (response.status === 404) {
          console.warn(`[VectorService] Collection ${collectionName} not found. Returning empty results.`);
          return [];
        }
        throw new Error(`Failed to search vectors: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      // MEJORA: Filtrar resultados vacíos y ordenar por score
      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`[VectorService] Invalid search result format. Returning empty results.`);
        return [];
      }
      
      const results = data.result
        .filter((item: any) => item.payload?.content && item.payload.content.trim().length > 0) // Filtrar chunks vacíos
        .filter((item: any) => (item.score || 0) >= (scoreThreshold || 0.2)) // Filtrar por umbral de similitud
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0)) // Ordenar por score descendente
        .slice(0, limit) // Limitar a los mejores resultados
        .map((item: any) => ({
          id: item.id,
          content: item.payload.content,
          score: item.score || 0,
          metadata: item.payload.metadata || {},
        }));
      
      console.log(`[VectorService] Found ${results.length} relevant results (from ${data.result.length} total, threshold: ${scoreThreshold || 0.2})`);
      return results;
    } catch (error) {
      console.error('Vector DB Search Error:', error);
      throw error;
    }
  }

  async deleteVectors(collectionName: string, ids: string[]): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.url}/collections/${collectionName}/points/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'api-key': this.config.apiKey }),
          },
          body: JSON.stringify({
            points: ids,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete vectors: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Vector DB Delete Error:', error);
      throw error;
    }
  }
}
