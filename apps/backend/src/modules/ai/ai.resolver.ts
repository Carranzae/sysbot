import { Query, Resolver, Args } from '@nestjs/graphql';
import { AiService } from './ai.service';

@Resolver()
export class AiResolver {
  constructor(private readonly aiService: AiService) {}

  @Query(() => String)
  async testAiApi(
    @Args('provider') provider: string,
    @Args('apiKey') apiKey: string,
  ): Promise<'working' | 'failed' | 'error'> {
    const result = await this.aiService.testApiKey(provider, apiKey);
    // Retornar solo el status para mantener compatibilidad con GraphQL
    return result.status;
  }
}
