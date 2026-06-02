import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import axios from 'axios';
import { AIProvider, AIProviderConfig, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class CustomProvider implements AIProvider {
  private client?: OpenAI;
  private config: AIProviderConfig;
  private logger = new Logger(CustomProvider.name);
  private useOpenAISDK: boolean;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.useOpenAISDK = !config.baseUrl || config.baseUrl.includes('openai') || config.baseUrl.includes('api.openai.com');
    
    // Si tiene baseUrl y parece compatible con OpenAI, usar SDK
    if (this.useOpenAISDK && config.baseUrl) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
    } else if (this.useOpenAISDK) {
      // Sin baseUrl, usar OpenAI estándar
      this.client = new OpenAI({
        apiKey: config.apiKey,
      });
    }
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
    const model = options?.model || this.config.model || 'gpt-3.5-turbo';
    const temperature = options?.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? this.config.maxTokens ?? 500;

    // Si usa SDK de OpenAI (compatible con OpenAI)
    if (this.useOpenAISDK && this.client) {
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
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
          },
          model,
          provider: 'custom-openai',
        };
      } catch (error: any) {
        this.logger.error('OpenAI SDK failed, trying direct HTTP:', error.message);
        // Fallback a HTTP directo
        return this.generateViaHTTP(fullPrompt, model, temperature, maxTokens);
      }
    }

    // Usar HTTP directo para APIs personalizadas
    return this.generateViaHTTP(fullPrompt, model, temperature, maxTokens);
  }

  private async generateViaHTTP(
    prompt: string,
    model: string,
    temperature: number,
    maxTokens: number,
  ): Promise<AIProviderResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const endpoint = baseUrl.endsWith('/chat/completions') 
      ? baseUrl 
      : `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    try {
      const response = await axios.post(
        endpoint,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const content = response.data?.choices?.[0]?.message?.content || 
             response.data?.response || 
             response.data?.text || 
             '';
             
      const usage = response.data?.usage;

      return {
        content,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        model,
        provider: 'custom-http',
      };
    } catch (error: any) {
      this.logger.error('HTTP request failed:', error.message);
      throw new Error(`Custom API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.useOpenAISDK && this.client) {
        const completion = await this.client.chat.completions.create({
          model: this.config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        });
        return !!completion.choices[0]?.message?.content;
      }

      // Probar con HTTP directo
      const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
      const endpoint = baseUrl.endsWith('/chat/completions') 
        ? baseUrl 
        : `${baseUrl.replace(/\/$/, '')}/chat/completions`;

      const response = await axios.post(
        endpoint,
        {
          model: this.config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      return !!(response.data?.choices?.[0]?.message?.content || 
                response.data?.response || 
                response.data?.text);
    } catch (error) {
      this.logger.error('Connection test failed:', error.message);
      return false;
    }
  }
}

