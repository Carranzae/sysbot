import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'] || request.query['api_key'];

    if (!key) {
      return false; // Let other guards handle it if this fails (or use it in a ComposeGuard)
    }

    try {
      const business = await this.apiKeyService.validateKey(key as string);
      request.user = {
        businessId: business.id,
        businessName: business.name,
        role: 'API_CLIENT',
      };
      return true;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}
