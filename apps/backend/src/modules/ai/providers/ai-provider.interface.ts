export interface FileAttachment {
  data: Buffer;
  mimeType: string;
  filename?: string;
}

export interface AIProviderResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider?: string;
}

export interface AIProvider {
  generateResponse(
    prompt: string,
    context?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<AIProviderResponse>;

  // Nueva funcionalidad: Procesar archivos directamente
  generateResponseWithFiles?(
    prompt: string,
    files: FileAttachment[],
    context?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<AIProviderResponse>;

  testConnection(): Promise<boolean>;
}

export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}













