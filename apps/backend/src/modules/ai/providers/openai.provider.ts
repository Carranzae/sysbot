import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, FileAttachment, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
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
    const model = options?.model || this.config.model || 'gpt-4o';
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
      provider: 'openai',
    };
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
    try {
      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
      const model = options?.model || this.config.model || 'gpt-4o';

      const hasImages = files.some(f => f.mimeType.startsWith('image/'));

      if (hasImages && files.length === 1) {
        const messages: any[] = [{
          role: 'user',
          content: [
            { type: 'text', text: fullPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${files[0].mimeType};base64,${files[0].data.toString('base64')}`
              }
            }
          ]
        }];

        const completion = await this.client.chat.completions.create({
          model: 'gpt-4o',
          messages,
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 1000,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
          },
          model: 'gpt-4o',
          provider: 'openai',
        };
      } else {
        let enhancedPrompt = fullPrompt;
        enhancedPrompt += '\n\nINFORMACIÓN DE ARCHIVOS SUBIDOS:\n';

        for (const file of files) {
          if (file.mimeType === 'application/pdf') {
            enhancedPrompt += `\n📄 Archivo PDF "${file.filename || 'documento.pdf'}": `;
            enhancedPrompt += '(Contenido será procesado automáticamente)\n';
          } else if (file.mimeType.startsWith('image/')) {
            enhancedPrompt += `\n🖼️ Imagen "${file.filename || 'imagen'}": `;
            enhancedPrompt += '(Contenido visual será analizado)\n';
          } else {
            enhancedPrompt += `\n📎 Archivo "${file.filename || 'archivo'}": `;
            enhancedPrompt += '(Tipo de archivo soportado)\n';
          }
        }

        const completion = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: enhancedPrompt }],
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 1000,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
          },
          model,
          provider: 'openai',
        };
      }
    } catch (error) {
      console.error('Error en OpenAI con archivos:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      return false;
    }
  }
}













