import { Injectable } from '@nestjs/common';
import { AIProvider, AIProviderConfig } from './ai-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { AzureOpenAIProvider } from './azure-openai.provider';
import { GroqProvider } from './groq.provider';
import { CustomProvider } from './custom.provider';

@Injectable()
export class AIProviderFactory {
  createProvider(config: AIProviderConfig): AIProvider {
    const providerName = (config.provider || 'OPENAI').toUpperCase();

    switch (providerName) {
      case 'OPENAI':
        return new OpenAIProvider(config);
      
      case 'GEMINI':
        return new GeminiProvider(config);
      
      case 'OPENROUTER':
        return new OpenRouterProvider(config);
      
      case 'AZURE_OPENAI':
        return new AzureOpenAIProvider(config);
      
      case 'GROQ':
        return new GroqProvider(config);
      
      case 'CUSTOM':
        // Custom provider puede funcionar con o sin baseUrl
        // Si no hay baseUrl, usará OpenAI estándar con la API key proporcionada
        return new CustomProvider(config);
      
      default:
        // Para cualquier proveedor desconocido, intentar como personalizado
        // Esto permite usar cualquier nombre de proveedor y configurarlo como Custom
        if (config.baseUrl) {
          return new CustomProvider(config);
        }
        // Si no hay baseUrl pero hay API key, intentar como OpenAI
        if (config.apiKey) {
          return new CustomProvider(config);
        }
        // Fallback final
        return new OpenAIProvider(config);
    }
  }
}

