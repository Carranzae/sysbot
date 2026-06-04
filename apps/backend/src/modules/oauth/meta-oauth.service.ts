import axios from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetaService } from '../meta/meta.service';
import { PrismaService } from '../database/prisma.service';

type MetaOAuthState = {
  businessId: string;
  platform: 'facebook' | 'instagram';
  ts: number;
};

function encodeState(state: MetaOAuthState) {
  const json = JSON.stringify(state);
  return Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeState(state: string): MetaOAuthState {
  const padded = state.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

@Injectable()
export class MetaOauthService {
  private readonly logger = new Logger(MetaOauthService.name);
  private readonly stateMaxAgeMs = 10 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly metaService: MetaService,
    private readonly prisma: PrismaService,
  ) {}

  getRedirectUri() {
    // Must match exactly the value configured in Meta Developer Console.
    return (
      this.config.get<string>('META_OAUTH_REDIRECT_URI') ||
      `${this.config.get<string>('BACKEND_PUBLIC_URL') || 'http://localhost:3003'}/api/v1/oauth/meta/callback`
    );
  }

  buildMetaAuthUrl(businessId: string, platform: 'facebook' | 'instagram') {
    const appId = this.config.get<string>('META_APP_ID');
    if (!appId) {
      throw new Error('META_APP_ID is not configured');
    }

    const redirectUri = this.getRedirectUri();
    const state = encodeState({ businessId, platform, ts: Date.now() });

    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_metadata',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ].join(',');

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
    });

    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  async handleCallback(code: string, encodedState: string) {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appId || !appSecret) {
      throw new Error('META_APP_ID or META_APP_SECRET is not configured');
    }

    let state: MetaOAuthState;
    try {
      state = decodeState(encodedState);
    } catch (e) {
      this.logger.warn(`Invalid OAuth state: ${String(e)}`);
      throw new Error('Invalid OAuth state');
    }

    if (!state?.businessId || !state?.platform || !state?.ts) {
      throw new Error('Invalid OAuth state');
    }

    if (Date.now() - state.ts > this.stateMaxAgeMs) {
      throw new Error('OAuth session expired. Please try again.');
    }
    const redirectUri = this.getRedirectUri();

    // 1) Exchange code for short-lived token
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const shortToken = tokenRes.data?.access_token as string | undefined;
    if (!shortToken) {
      throw new Error('Meta token exchange failed (no access_token)');
    }

    // 2) Exchange for long-lived token
    const longRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
    });

    const longToken = (longRes.data?.access_token as string | undefined) || shortToken;

    // 3) Get pages list
    const accountsRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: longToken,
        fields: 'id,name,access_token',
      },
    });

    const pages: Array<{ id: string; name: string; access_token?: string }> = accountsRes.data?.data || [];

    // Enterprise UX: if multiple pages, let the user select which one to link.
    if (pages.length > 1) {
      const expiresAt = new Date(Date.now() + this.stateMaxAgeMs);

      const session = await this.prisma.metaOauthSession.create({
        data: {
          businessId: state.businessId,
          platform: state.platform,
          userAccessToken: longToken,
          expiresAt,
        },
      });

      return {
        businessId: state.businessId,
        platform: state.platform,
        needsSelection: true,
        sessionId: session.id,
        pagesCount: pages.length,
      };
    }

    const page = pages.find((p) => p.access_token) || pages[0];

    if (!page?.id || !page?.access_token) {
      // Persist partial connection: token exists but no page selected/available
      await this.metaService.createOrUpdateMetaConnection(state.businessId, {
        messengerEnabled: true,
        messengerConnected: false,
        instagramEnabled: true,
        instagramConnected: false,
      });

      return {
        businessId: state.businessId,
        platform: state.platform,
        messengerConnected: false,
        instagramConnected: false,
        reason: 'NO_PAGES_AVAILABLE',
      };
    }

    // 4) Resolve IG business account linked to that page
    const pageRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
      params: {
        access_token: page.access_token,
        fields: 'id,name,instagram_business_account',
      },
    });

    const igId: string | undefined = pageRes.data?.instagram_business_account?.id;

    // 5) Persist Meta connection
    await this.metaService.createOrUpdateMetaConnection(state.businessId, {
      messengerEnabled: true,
      messengerConnected: true,
      messengerPageId: page.id,
      messengerAccessToken: page.access_token,

      instagramEnabled: true,
      instagramConnected: Boolean(igId),
      instagramAccountId: igId || null,
      instagramAccessToken: igId ? page.access_token : null,
    });

    // 6) Update social channels snapshot (frontend reads allowedSocials)
    // Note: This is a transitional approach until SocialConnection table exists.
    const business = await this.prisma.business.findUnique({ where: { id: state.businessId } });
    const allowed = (business?.allowedSocials as any) || [];
    const filtered = Array.isArray(allowed)
      ? allowed.filter((s: any) => {
          try {
            const obj = typeof s === 'string' ? JSON.parse(s) : s;
            return obj?.key !== 'facebook' && obj?.key !== 'instagram';
          } catch {
            return true;
          }
        })
      : [];

    const now = new Date().toISOString();
    const facebookChannel = {
      key: 'facebook',
      title: 'Facebook',
      mode: 'AUTO',
      status: 'connected',
      accountLabel: page.name,
      connectedAt: now,
    };

    const instagramChannel = {
      key: 'instagram',
      title: 'Instagram',
      mode: 'ASISTIDO',
      status: igId ? 'needs_action' : 'disconnected',
      accountLabel: igId ? page.name : undefined,
      connectedAt: igId ? now : undefined,
    };

    await this.prisma.business.update({
      where: { id: state.businessId },
      data: {
        allowedSocials: [
          ...filtered.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x))),
          JSON.stringify(facebookChannel),
          JSON.stringify(instagramChannel),
        ],
      },
    });

    return {
      businessId: state.businessId,
      platform: state.platform,
      messengerConnected: true,
      instagramConnected: Boolean(igId),
      pageId: page.id,
      pageName: page.name,
      instagramAccountId: igId || null,
    };
  }

  async listPages(sessionId: string) {
    const session = await this.prisma.metaOauthSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error('OAuth session not found');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new Error('OAuth session expired');
    }

    const accountsRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: session.userAccessToken,
        fields: 'id,name',
      },
    });

    const pages: Array<{ id: string; name: string }> = accountsRes.data?.data || [];
    return {
      businessId: session.businessId,
      platform: session.platform,
      pages,
    };
  }

  async selectPage(sessionId: string, pageId: string) {
    const session = await this.prisma.metaOauthSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error('OAuth session not found');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new Error('OAuth session expired');
    }

    // Get page details including page token and IG business account (if linked)
    const pageRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
      params: {
        access_token: session.userAccessToken,
        fields: 'id,name,access_token,instagram_business_account',
      },
    });

    const pageToken: string | undefined = pageRes.data?.access_token;
    const pageName: string | undefined = pageRes.data?.name;
    const igId: string | undefined = pageRes.data?.instagram_business_account?.id;

    if (!pageToken) {
      throw new Error('Unable to retrieve page access token');
    }

    await this.metaService.createOrUpdateMetaConnection(session.businessId, {
      messengerEnabled: true,
      messengerConnected: true,
      messengerPageId: pageId,
      messengerAccessToken: pageToken,

      instagramEnabled: true,
      instagramConnected: Boolean(igId),
      instagramAccountId: igId || null,
      instagramAccessToken: igId ? pageToken : null,
    });

    // Update allowedSocials snapshot
    const business = await this.prisma.business.findUnique({ where: { id: session.businessId } });
    const allowed = (business?.allowedSocials as any) || [];
    const filtered = Array.isArray(allowed)
      ? allowed.filter((s: any) => {
          try {
            const obj = typeof s === 'string' ? JSON.parse(s) : s;
            return obj?.key !== 'facebook' && obj?.key !== 'instagram';
          } catch {
            return true;
          }
        })
      : [];

    const now = new Date().toISOString();
    const facebookChannel = {
      key: 'facebook',
      title: 'Facebook',
      mode: 'AUTO',
      status: 'connected',
      accountLabel: pageName,
      connectedAt: now,
    };

    const instagramChannel = {
      key: 'instagram',
      title: 'Instagram',
      mode: 'ASISTIDO',
      status: igId ? 'needs_action' : 'disconnected',
      accountLabel: igId ? pageName : undefined,
      connectedAt: igId ? now : undefined,
    };

    await this.prisma.business.update({
      where: { id: session.businessId },
      data: {
        allowedSocials: [
          ...filtered.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x))),
          JSON.stringify(facebookChannel),
          JSON.stringify(instagramChannel),
        ],
      },
    });

    await this.prisma.metaOauthSession.delete({ where: { id: sessionId } });

    return {
      businessId: session.businessId,
      platform: session.platform,
      messengerConnected: true,
      instagramConnected: Boolean(igId),
      pageId,
      pageName,
      instagramAccountId: igId || null,
    };
  }

  async getHealth(businessId: string) {
    const conn = await this.metaService.getMetaConnection(businessId);
    if (!conn) {
      return { status: 'red', reason: 'NO_CONNECTION' };
    }

    const fbOk = Boolean(conn.messengerAccessToken && conn.messengerPageId && conn.messengerConnected);
    const igOk = Boolean(conn.instagramAccessToken && conn.instagramAccountId && conn.instagramConnected);

    if (!fbOk) {
      return { status: 'red', reason: 'TOKEN_OR_PAGE_MISSING' };
    }

    // Active Token Validation via Facebook Graph API
    try {
      await axios.get(`https://graph.facebook.com/v19.0/me`, {
        params: { access_token: conn.messengerAccessToken },
        timeout: 5000,
      });
    } catch (err: any) {
      this.logger.warn(`[MetaOAuth Health] Active token validation failed: ${err.message}`);
      return { 
        status: 'red', 
        reason: 'TOKEN_EXPIRED_OR_INVALID', 
        details: err.response?.data?.error?.message || err.message 
      };
    }

    if (fbOk && igOk) {
      return { status: 'green', reason: 'OK' };
    }

    if (fbOk && !igOk) {
      return { status: 'orange', reason: 'FACEBOOK_OK_INSTAGRAM_MISSING_OR_NEEDS_ACTION' };
    }

    return { status: 'red', reason: 'TOKEN_OR_PAGE_INVALID' };
  }
}
