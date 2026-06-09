import { BadRequestException, Body, Controller, Get, Post, Query, Res, Param } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { MetaOauthService } from './meta-oauth.service';
import { GoogleOauthService } from './google-oauth.service';

@Controller('oauth')
export class OauthController {
  constructor(
    private readonly metaOauth: MetaOauthService,
    private readonly googleOauth: GoogleOauthService,
    private readonly config: ConfigService,
  ) {}

  @Get('google/start')
  startGoogle(
    @Query('businessId') businessId: string,
    @Res() res: Response,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }
    const url = this.googleOauth.buildAuthUrl(businessId);
    return res.redirect(url);
  }

  @Get('google/callback')
  async callbackGoogle(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.googleOauth.handleCallback(code, state);

    const frontendBase = this.config.get<string>('FRONTEND_PUBLIC_URL') || 'http://localhost:3000';
    const redirect = `${frontendBase}/appointments?connected=google&businessId=${encodeURIComponent(result.businessId)}`;
    return res.redirect(redirect);
  }

  @Get(':platform/start')
  start(
    @Param('platform') platform: 'facebook' | 'instagram',
    @Query('businessId') businessId: string,
    @Res() res: Response,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }
    try {
      const url = this.metaOauth.buildMetaAuthUrl(businessId, platform);
      return res.redirect(url);
    } catch (error: any) {
      const frontendBase = this.config.get<string>('FRONTEND_PUBLIC_URL') || 'http://localhost:3000';
      const message = error?.response?.message || error?.message || 'No se pudo iniciar Meta OAuth';
      return res.redirect(
        `${frontendBase}/redes?oauthError=${encodeURIComponent(message)}&businessId=${encodeURIComponent(businessId)}`
      );
    }
  }

  @Get(':platform/start-url')
  getStartUrl(
    @Param('platform') platform: 'facebook' | 'instagram',
    @Query('businessId') businessId: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }
    return {
      url: this.metaOauth.buildMetaAuthUrl(businessId, platform),
    };
  }

  @Get('meta/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.metaOauth.handleCallback(code, state);

    const frontendBase = this.config.get<string>('FRONTEND_PUBLIC_URL') || 'http://localhost:3000';
    const redirect = (result as any)?.needsSelection
      ? `${frontendBase}/redes?metaSelect=1&sessionId=${encodeURIComponent((result as any).sessionId)}&businessId=${encodeURIComponent(result.businessId)}`
      : `${frontendBase}/redes?connected=${encodeURIComponent(result.platform)}&businessId=${encodeURIComponent(result.businessId)}`;
    return res.redirect(redirect);
  }

  @Get('meta/pages')
  async listMetaPages(@Query('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    return this.metaOauth.listPages(sessionId);
  }

  @Post('meta/select-page')
  async selectMetaPage(@Body() body: { sessionId?: string; pageId?: string }) {
    const sessionId = body?.sessionId;
    const pageId = body?.pageId;
    if (!sessionId || !pageId) {
      throw new BadRequestException('sessionId and pageId are required');
    }
    return this.metaOauth.selectPage(sessionId, pageId);
  }

  @Get('meta/health')
  async health(@Query('businessId') businessId: string) {
    return this.metaOauth.getHealth(businessId);
  }
}
