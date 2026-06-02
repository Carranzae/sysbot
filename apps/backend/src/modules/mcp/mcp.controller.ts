import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { McpService } from './mcp.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('MCP - Model Context Protocol')
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conectar ChatGPT/IA externa via MCP' })
  @ApiResponse({ status: 200, description: 'Conexión establecida' })
  @ApiResponse({ status: 401, description: 'Código inválido' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Código de conexión MCP' },
        businessId: { type: 'string', description: 'ID del negocio' },
        platform: { type: 'string', enum: ['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'custom'], description: 'Plataforma IA' }
      },
      required: ['code', 'businessId']
    }
  })
  async connect(@Body() body: { code: string; businessId: string; platform?: string }) {
    const { code, businessId, platform = 'chatgpt' } = body;

    if (!code || !businessId) {
      throw new BadRequestException('Código y businessId son requeridos');
    }

    const connection = await this.mcpService.validateAndConnect(code, businessId, platform);
    
    if (!connection) {
      throw new UnauthorizedException('Código MCP inválido o expirado');
    }

    return {
      success: true,
      sessionId: connection.sessionId,
      businessId: connection.businessId,
      platform: connection.platform,
      capabilities: [
        'modify_publications',
        'generate_content',
        'schedule_posts',
        'analyze_performance'
      ],
      expiresAt: connection.expiresAt
    };
  }

  @Post('prompt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar prompt para modificar publicaciones' })
  @ApiResponse({ status: 200, description: 'Prompt procesado exitosamente' })
  @ApiResponse({ status: 401, description: 'Sesión inválida' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID de sesión MCP' },
        prompt: { type: 'string', description: 'Prompt de ChatGPT/IA' },
        context: { 
          type: 'object',
          properties: {
            targetPlatforms: { type: 'array', items: { type: 'string' } },
            currentCaption: { type: 'string' },
            businessName: { type: 'string' },
            industryType: { type: 'string' }
          }
        }
      },
      required: ['sessionId', 'prompt']
    }
  })
  async processPrompt(@Body() body: { 
    sessionId: string; 
    prompt: string; 
    context?: any;
  }) {
    const { sessionId, prompt, context } = body;

    if (!sessionId || !prompt) {
      throw new BadRequestException('sessionId y prompt son requeridos');
    }

    const result = await this.mcpService.processPrompt(sessionId, prompt, context);
    
    if (!result) {
      throw new UnauthorizedException('Sesión MCP inválida o expirada');
    }

    return {
      success: true,
      modifications: result.modifications,
      newCaption: result.newCaption,
    scheduledPosts: result.scheduledPosts,
      analysis: result.analysis,
      appliedAt: new Date().toISOString()
    };
  }

  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desconectar sesión MCP' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  async disconnect(@Body() body: { sessionId: string }) {
    const { sessionId } = body;

    if (!sessionId) {
      throw new BadRequestException('sessionId es requerido');
    }

    await this.mcpService.disconnect(sessionId);

    return {
      success: true,
      message: 'Sesión MCP cerrada exitosamente'
    };
  }

  @Post('generate-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar nuevo código de conexión MCP' })
  @ApiResponse({ status: 200, description: 'Código generado' })
  async generateCode(@Body() body: { businessId: string; expiresIn?: number }) {
    const { businessId, expiresIn = 3600 } = body; // 1 hora por defecto

    if (!businessId) {
      throw new BadRequestException('businessId es requerido');
    }

    const codeData = await this.mcpService.generateConnectionCode(businessId, expiresIn);

    return {
      success: true,
      code: codeData.code,
      expiresAt: codeData.expiresAt,
      instructions: {
        step1: "Copia este código",
        step2: "Pégalo en ChatGPT con el prompt de tu publicación",
        step3: "El sistema aplicará automáticamente los cambios",
        note: "El código expira en 1 hora por seguridad"
      }
    };
  }
}
