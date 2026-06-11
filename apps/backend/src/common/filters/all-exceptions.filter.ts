import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const externalStatus = Number((exception as any)?.statusCode || (exception as any)?.status);
    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : Number.isInteger(externalStatus) && externalStatus >= 400 && externalStatus < 600
          ? externalStatus
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as any)?.message || 'Internal server error';

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: typeof message === 'string' ? message : (message as any).message || message,
    };

    // Log the error
    if (httpStatus >= 500) {
      this.logger.error(
        `[${httpAdapter.getRequestMethod(ctx.getRequest())}] ${httpAdapter.getRequestUrl(ctx.getRequest())} - Status: ${httpStatus} - Error: ${JSON.stringify(exception)}`,
      );
    } else {
      this.logger.warn(
        `[${httpAdapter.getRequestMethod(ctx.getRequest())}] ${httpAdapter.getRequestUrl(ctx.getRequest())} - Status: ${httpStatus} - Warning: ${JSON.stringify(message)}`,
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
