import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@syst/database';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  async onModuleInit() {
    // Solo intentar conectar una vez, incluso si se llama múltiples veces
    if (!this.connectionPromise) {
      this.connectionPromise = this.connectWithRetry();
    }
    await this.connectionPromise;
  }

  private runMigrations() {
    try {
      // Find schema.prisma file in monorepo
      const possiblePaths = [
        path.join(process.cwd(), 'packages/database/prisma/schema.prisma'),
        path.join(process.cwd(), '../database/prisma/schema.prisma'),
        path.join(process.cwd(), '../../packages/database/prisma/schema.prisma'),
        path.join(process.cwd(), 'prisma/schema.prisma'),
      ];

      let schemaPath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          schemaPath = p;
          break;
        }
      }

      if (!schemaPath) {
        this.logger.warn('⚠️ Could not find schema.prisma to run migrations automatically.');
        return;
      }

      this.logger.log(`⏳ Running database migrations using schema: ${schemaPath}`);
      
      // Run prisma migrate deploy
      execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
        stdio: 'inherit',
        env: process.env,
      });
      
      this.logger.log('✅ Database migrations applied successfully');
    } catch (err: any) {
      this.logger.error(`❌ Failed to run database migrations: ${err.message || err}`);
    }
  }

  private async connectWithRetry(maxRetries = 15, delay = 2000) {
    this.logger.log('🔌 Attempting to connect to database...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 1) {
          this.logger.debug(`DATABASE_URL: ${process.env.DATABASE_URL || 'undefined'}`);
        }
        await this.$connect();
        this.isConnected = true;
        this.logger.log('✅ Database connected successfully');
        
        // Run database migrations programmatically
        this.runMigrations();
        
        return;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt) {
          this.logger.error(`❌ Failed to connect to database after ${maxRetries} attempts`);
          this.logger.error('Make sure Docker is running and PostgreSQL container is started');
          this.logger.error('Run: docker-compose up -d postgres redis qdrant');
          this.logger.error(`Error: ${error?.message || 'Unknown error'}`);
          // No lanzar error - permitir que la app inicie pero las operaciones de BD fallarán
          return;
        }
        
        // Mostrar progreso cada 3 intentos
        if (attempt === 1 || attempt % 3 === 0) {
          this.logger.warn(`⏳ Waiting for database... (attempt ${attempt}/${maxRetries})`);
        }
        
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
      this.logger.log('Database disconnected');
    }
  }

  async ensureConnected() {
    if (this.isConnected) {
      return;
    }
    
    if (!this.connectionPromise) {
      this.connectionPromise = this.connectWithRetry(5, 1000);
    }
    
    await this.connectionPromise;
  }
}
