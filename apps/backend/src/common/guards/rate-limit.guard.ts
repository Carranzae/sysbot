import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  forwardRef,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MonitoringService } from '../../modules/monitoring/monitoring.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => MonitoringService))
    private monitoringService: MonitoringService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip rate limiting for health checks and static files
    const endpoint = request.route?.path || request.url;
    if (
      endpoint.includes('/health') ||
      endpoint.includes('/favicon') ||
      endpoint.includes('/static') ||
      endpoint.includes('/assets')
    ) {
      return true;
    }

    const userId = request.user?.userId || request.user?.sub || 'anonymous';
    const userRole = request.user?.role;
    const businessPlan = request.user?.businessPlan;

    try {
      const result = await this.monitoringService.checkRateLimit(
        endpoint,
        request.method,
        userId,
        userRole,
        businessPlan,
      );

      if (!result.allowed) {
        // Trigger rate limit alert
        setImmediate(() => {
          this.monitoringService['triggerAlert']('RATE_LIMIT_EXCEEDED', {
            endpoint,
            userId,
            userRole,
            remainingRequests: result.remainingRequests,
            resetTime: result.resetTime,
          });
        });

        throw new HttpException({
          message: 'Rate limit exceeded',
          remainingRequests: result.remainingRequests,
          resetTime: result.resetTime,
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      // Add rate limit headers to response
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Remaining', result.remainingRequests);
      response.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());

      return true;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }

      // If rate limiting fails, allow the request (fail-open)
      console.warn('Rate limiting check failed, allowing request:', error);
      return true;
    }
  }
}