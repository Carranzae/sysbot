import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MonitoringService, APIMetrics } from '../../modules/monitoring/monitoring.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @Inject(forwardRef(() => MonitoringService))
    private monitoringService: MonitoringService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Extract request information
    const endpoint = request.route?.path || request.url;
    const method = request.method;
    const userId = request.user?.userId || request.user?.sub;
    const businessId = request.user?.businessId;

    let errorMessage: string | undefined;

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode;

        const metric: APIMetrics = {
          endpoint,
          method,
          responseTime,
          statusCode,
          userId,
          businessId,
          timestamp: new Date(startTime),
          userAgent: request.get('User-Agent'),
          ipAddress: request.ip || request.connection?.remoteAddress,
        };

        // Record metric asynchronously (don't block response)
        setImmediate(() => {
          this.monitoringService.recordAPIMetric(metric);
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || 500;
        errorMessage = error.message || 'Unknown error';

        const metric: APIMetrics = {
          endpoint,
          method,
          responseTime,
          statusCode,
          userId,
          businessId,
          timestamp: new Date(startTime),
          userAgent: request.get('User-Agent'),
          ipAddress: request.ip || request.connection?.remoteAddress,
          errorMessage,
        };

        // Record error metric asynchronously
        setImmediate(() => {
          this.monitoringService.recordAPIMetric(metric);
        });

        throw error;
      }),
    );
  }
}