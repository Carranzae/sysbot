import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class OpenRouterProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://syst.app',
        'X-Title': 'SYST Bot',
      },
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
    const model = options?.model || this.config.model || 'openai/gpt-4o';
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
      provider: 'openrouter',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      return false;
    }
  }
}

















