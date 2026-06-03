import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (2 levels up from apps/backend/src)
// Trigger redeployment on Railway for automatic migrations check
config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = process.env.PORT || 3003;
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';
  const environment = configService.get('NODE_ENV') || 'development';
  
  app.setGlobalPrefix(apiPrefix);

  // CORS configuration - Allow all origins in development for easier debugging
  const corsOrigins = configService.get('CORS_ORIGINS')?.split(',').filter(Boolean) || [];
  const corsOrigin = configService.get('CORS_ORIGIN');
  
  // In development, allow all origins (including localhost on any port)
  if (environment === 'development') {
    console.log('🔓 CORS: Allowing all origins in development mode');
    app.enableCors({
      origin: true, // Allow all origins in development
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin'],
      exposedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  } else {
    // In production, use explicit origins
    const explicitOrigins: string[] = [];
    if (corsOrigin) explicitOrigins.push(corsOrigin);
    if (corsOrigins.length > 0) explicitOrigins.push(...corsOrigins);
    const finalOrigins = explicitOrigins.length > 0 ? explicitOrigins : ['http://localhost:3000'];
    
    console.log(`🔒 CORS: Allowing origins: ${finalOrigins.join(', ')}`);
    app.enableCors({
      origin: finalOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin'],
      exposedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  }

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: false,
      skipNullProperties: true,
      skipUndefinedProperties: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(port);
  console.log(`🚀 SYST Backend running on: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
