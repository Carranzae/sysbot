import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class GroqProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.groq.com/openai/v1',
    });
  }

  // Modelos válidos de Groq
  private readonly validModels = [
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma-7b-it',
    'llama-3.3-70b-versatile',
    'llama-3.2-90b-text-preview',
  ];

  private getValidModel(model?: string): string {
    if (!model) {
      return 'llama-3.1-8b-instant';
    }
    // Si el modelo es válido, usarlo
    if (this.validModels.includes(model)) {
      return model;
    }
    // Si el modelo contiene "gemini" o no es válido, usar el default
    if (model.toLowerCase().includes('gemini') || model.toLowerCase().includes('gpt')) {
      return 'llama-3.1-8b-instant';
    }
    // Intentar usar el modelo si parece válido (contiene "llama", "mixtral", "gemma")
    if (model.toLowerCase().includes('llama') || model.toLowerCase().includes('mixtral') || model.toLowerCase().includes('gemma')) {
      return model; // Permitir variaciones
    }
    // Default si no es válido
    return 'llama-3.1-8b-instant';
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
    const model = this.getValidModel(options?.model || this.config.model);
    const temperature = options?.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? this.config.maxTokens ?? 500;

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: fullPrompt }],
          temperature,
          max_tokens: maxTokens,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
          usage: {
            promptTokens: (completion as any).usage?.prompt_tokens || 0,
            completionTokens: (completion as any).usage?.completion_tokens || 0,
            totalTokens: (completion as any).usage?.total_tokens || 0,
          },
          model,
          provider: 'groq',
        };

      } catch (error: any) {
        lastError = error;

        if (error?.status === 429 || error?.message?.includes('Rate limit')) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.warn(`[GroqProvider] Rate limit hit, attempt ${attempt + 1}/${maxRetries}, waiting ${waitTime}ms...`);

          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        if (attempt === maxRetries - 1) {
          if (model.includes('70b') || model.includes('90b')) {
            console.warn(`[GroqProvider] Large model failed, trying smaller model...`);
            try {
              const fallbackModel = 'llama-3.1-8b-instant';
              const fallbackCompletion = await this.client.chat.completions.create({
                model: fallbackModel,
                messages: [{ role: 'user', content: fullPrompt }],
                temperature,
                max_tokens: maxTokens,
              });
              return {
                content: fallbackCompletion.choices[0]?.message?.content || '',
                usage: {
                  promptTokens: (fallbackCompletion as any).usage?.prompt_tokens || 0,
                  completionTokens: (fallbackCompletion as any).usage?.completion_tokens || 0,
                  totalTokens: (fallbackCompletion as any).usage?.total_tokens || 0,
                },
                model: fallbackModel,
                provider: 'groq',
              };
            } catch (fallbackError) {
              console.error(`[GroqProvider] Fallback model also failed:`, fallbackError.message);
            }
          }
        }

        throw error;
      }
    }

    throw lastError;
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.getValidModel(this.config.model);
      const completion = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error: any) {
      console.error('Groq testConnection error:', error?.message || error);
      throw error; // Re-lanzar el error para que el servicio pueda capturarlo
    }
  }
}

