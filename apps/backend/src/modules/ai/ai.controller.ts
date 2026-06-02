import { Controller, Post, Body, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RateLimit, StrictRateLimit } from '../../common/decorators/rate-limit.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test-api')
  async testApi(@Body() body: { provider: string; apiKey: string; model?: string; baseUrl?: string }) {
    const result = await this.aiService.testApiKey(body.provider, body.apiKey, body.model, body.baseUrl);
    return result;
  }

  // SOLO PARA SUPER ADMINS - Acceso directo al motor de IA
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN) // SOLO SUPER ADMINS
  @RateLimit({ limit: 10, windowMs: 60000 }) // Rate limit más estricto para Super Admins
  async generate(@Body() body: { businessId: string; message: string; customerPhone?: string }) {
    const { businessId, message, customerPhone } = body;
    return this.aiService.generateResponse(businessId, message, customerPhone);
  }

  // PARA BUSINESS OWNERS - Uso a través del bot (sin autenticación JWT)
  @Post('bot-response')
  @RateLimit({ limit: 100, windowMs: 60000 }) // Rate limit más permisivo para bots
  async generateBotResponse(@Body() body: {
    businessId: string;
    message: string;
    customerPhone?: string;
    sessionId?: string;
  }) {
    // Este endpoint es usado por el bot de WhatsApp
    // No requiere autenticación JWT porque viene del webhook
    const { businessId, message, customerPhone, sessionId } = body;
    return this.aiService.generateBotResponse(businessId, message, customerPhone, sessionId);
  }

  @Post('vision/detect')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ limit: 30, windowMs: 60000 })
  @UseInterceptors(FileInterceptor('file'))
  async detectObjects(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { businessId?: string },
  ) {
    if (!body.businessId) {
      throw new BadRequestException('businessId is required');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return this.aiService.detectObjectsInImage(body.businessId, {
      data: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    });
  }
}
