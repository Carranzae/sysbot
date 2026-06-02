import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class AzureOpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    // Azure OpenAI usa el formato: https://{resource}.openai.azure.com
    const baseURL = config.baseUrl || process.env.AZURE_OPENAI_ENDPOINT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: baseURL ? `${baseURL}/openai/deployments/${config.model || 'gpt-4'}/chat/completions?api-version=${apiVersion}` : undefined,
    });
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
    const model = options?.model || this.config.model || 'gpt-4';
    const temperature = options?.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? this.config.maxTokens ?? 500;

    const completion = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      model,
      provider: 'azure-openai',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      return false;
    }
  }
}

















