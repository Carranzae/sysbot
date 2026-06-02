import { Controller, Post, Get, Patch, Req, Res, Query, Body, Param, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { MetaRouterService } from './meta-router.service';

@Controller('meta')
export class MetaController {
  private readonly logger = new Logger(MetaController.name);

  constructor(
    private metaService: MetaService,
    private metaRouterService: MetaRouterService,
  ) {}

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
        const platform = entry.id ? 'INSTAGRAM' : 'MESSENGER';
        const businessId = await this.metaService.getBusinessIdFromPageId(entry.id || entry.messaging?.[0]?.recipient?.id);

        if (!businessId) {
          this.logger.warn(`[MetaWebhook] Business not found for pageId: ${entry.id}`);
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
  async getConnection(@Param('businessId') businessId: string) {
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
  async updateConnection(
    @Param('businessId') businessId: string,
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

