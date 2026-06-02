import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SwarmOrchestratorService } from './swarm-orchestrator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('swarm')
@UseGuards(JwtAuthGuard)
export class SwarmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly swarmService: SwarmOrchestratorService,
  ) {}

  /**
   * Obtiene la lista de IPs/Teléfonos bloqueados por seguridad perimetral de un negocio.
   */
  @Get('blocklist')
  async getBlockList(@Request() req) {
    const businessId = req.user.businessId;
    return this.prisma.securityBlocklist.findMany({
      where: { businessId },
      orderBy: { blockedAt: 'desc' },
    });
  }

  /**
   * Bloquea manualmente un objetivo sospechoso (IP o Teléfono).
   */
  @Post('block')
  async blockTarget(@Request() req, @Body() body: { type: 'IP' | 'PHONE'; value: string; reason: string }) {
    const businessId = req.user.businessId;
    return this.prisma.securityBlocklist.create({
      data: {
        businessId,
        targetType: body.type,
        targetValue: body.value,
        reason: body.reason,
        severity: 'HIGH',
      },
    });
  }

  /**
   * Desbloquea un objetivo manualmente.
   */
  @Delete('block/:id')
  async unblockTarget(@Request() req, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.prisma.securityBlocklist.deleteMany({
      where: {
        id,
        businessId,
      },
    });
  }

  /**
   * Endpoint de prueba para pasar un mensaje de simulación a través de los sub-agentes del enjambre.
   */
  @Post('test-message')
  async testSwarmMessage(
    @Request() req,
    @Body() body: { content: string; phone: string; ip?: string },
  ) {
    const businessId = req.user.businessId;
    const clientIp = body.ip || '127.0.0.1';
    return this.swarmService.processIncomingMessage(
      businessId,
      body.phone || '51999999999',
      clientIp,
      body.content,
    );
  }
}
