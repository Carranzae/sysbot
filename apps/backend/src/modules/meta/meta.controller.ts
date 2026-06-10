import { Controller, Post, Get, Patch, Req, Res, Query, Body, Param, Logger, NotFoundException, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { MetaRouterService } from './meta-router.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../database/prisma.service';

@Controller('meta')
export class MetaController {
  private readonly logger = new Logger(MetaController.name);

  constructor(
    private metaService: MetaService,
    private metaRouterService: MetaRouterService,
    private prisma: PrismaService,
  ) {}

  private async ensureBusinessOwnership(ownerId: string | undefined, businessId: string) {
    if (!ownerId) {
      throw new NotFoundException(`Business with ID ${businessId} not found for this user`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { role: true },
    });

    const business = user?.role === 'SUPER_ADMIN'
      ? await this.prisma.business.findUnique({
          where: { id: businessId },
          select: { id: true },
        })
      : await this.prisma.business.findFirst({
          where: { id: businessId, ownerId },
          select: { id: true },
        });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found for this user`);
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    // Verificación de webhook
    if (mode === 'subscribe' && token) {
      const verifyToken = process.env.META_VERIFY_TOKEN;
      if (token === verifyToken) {
        this.logger.log('[MetaWebhook] Webhook verified successfully');
        return res.status(200).send(challenge);
      }
      this.logger.warn('[MetaWebhook] Invalid verify token');
      return res.status(403).send('Forbidden');
    }

    // Procesar eventos
    const body = req.body;
    this.logger.log(`[MetaWebhook] Received webhook event: ${body.object}`);

    if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry || []) {
        const platform = body.object === 'instagram' ? 'INSTAGRAM' : 'MESSENGER';
        const pageOrAccountId = body.object === 'instagram'
          ? entry.id
          : entry.messaging?.[0]?.recipient?.id || entry.id;
        const businessId = await this.metaService.getBusinessIdFromPageId(pageOrAccountId);

        if (!businessId) {
          this.logger.warn(`[MetaWebhook] Business not found for page/account id: ${pageOrAccountId}`);
          continue;
        }

        for (const event of entry.messaging || []) {
          try {
            await this.metaRouterService.routeIncomingMessage(
              businessId,
              platform,
              event,
            );
          } catch (error) {
            this.logger.error(`[MetaWebhook] Error processing message: ${error.message}`, error.stack);
          }
        }
      }
    }

    return res.status(200).send('OK');
  }

  @Get('connection/:businessId')
  @UseGuards(JwtAuthGuard)
  async getConnection(@Param('businessId') businessId: string, @Req() req: any) {
    await this.ensureBusinessOwnership(req.user?.userId, businessId);
    const connection = await this.metaService.getMetaConnection(businessId);
    return connection || {
      businessId,
      messengerEnabled: false,
      instagramEnabled: false,
      messengerConnected: false,
      instagramConnected: false,
    };
  }

  @Patch('connection/:businessId')
  @UseGuards(JwtAuthGuard)
  async updateConnection(
    @Param('businessId') businessId: string,
    @Req() req: any,
    @Body() data: {
      messengerEnabled?: boolean;
      messengerPageId?: string;
      messengerAccessToken?: string;
      messengerVerifyToken?: string;
      instagramEnabled?: boolean;
      instagramAccountId?: string;
      instagramAccessToken?: string;
      webhookUrl?: string;
    },
  ) {
    await this.ensureBusinessOwnership(req.user?.userId, businessId);
    return this.metaService.createOrUpdateMetaConnection(businessId, data);
  }

  @Get('webhook')
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }
}
