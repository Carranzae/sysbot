import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIProviderConfig, FileAttachment } from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  async generateResponse(
    prompt: string,
    context?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<AIProviderResponse> {
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    const modelName = options?.model || this.config.model || 'gemini-2.0-flash';
    const model = this.genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? this.config.maxTokens ?? 500,
      },
    });

    let lastError: any;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        return {
          content: response.text(),
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
          },
          model: modelName,
          provider: 'google',
        };
      } catch (error: any) {
        lastError = error;
        
        if (error?.status === 429 && attempt < maxRetries) {
          const retryDelay = error?.errorDetails?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
            ?.retryDelay || '30s';
          
          const delaySeconds = parseFloat(retryDelay.replace('s', '')) || 30;
          
          console.log(`Gemini quota exceeded, waiting ${delaySeconds}s before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  async generateResponseWithFiles(
    prompt: string,
    files: FileAttachment[],
    context?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<AIProviderResponse> {
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    const modelName = options?.model || this.config.model || 'gemini-1.5-pro';
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? this.config.maxTokens ?? 1000,
      },
    });

    const content: any[] = [{ text: fullPrompt }];

    files.forEach(file => {
      content.push({
        inlineData: {
          data: file.data.toString('base64'),
          mimeType: file.mimeType,
        },
      });
    });

    let lastError: any;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(content);
        const response = await result.response;

        return {
          content: response.text(),
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
          },
          model: modelName,
          provider: 'google',
        };
      } catch (error: any) {
        lastError = error;

        if (error?.status === 429 && attempt < maxRetries) {
          const retryDelay = error?.errorDetails?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
            ?.retryDelay || '30s';

          const delaySeconds = parseFloat(retryDelay.replace('s', '')) || 30;

          console.log(`Gemini quota exceeded, waiting ${delaySeconds}s before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.config.model || 'gemini-2.5-flash' });
      const result = await model.generateContent('Hello');
      const response = await result.response;
      return !!response.text();
    } catch (error) {
      return false;
    }
  }
}

