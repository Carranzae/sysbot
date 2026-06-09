import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { PrismaService } from '../database/prisma.service';

type GoogleOAuthState = {
  businessId: string;
  ts: number;
};

function encodeState(state: GoogleOAuthState) {
  const json = JSON.stringify(state);
  return Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeState(state: string): GoogleOAuthState {
  const padded = state.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);
  private readonly stateMaxAgeMs = 10 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getOAuth2Client() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET;
    
    // Redirect URI must match what is configured in Google Cloud Console
    const redirectUri = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI') || 
      `${this.config.get<string>('BACKEND_PUBLIC_URL') || 'http://localhost:3001'}/api/v1/oauth/google/callback`;

    if (!clientId || !clientSecret) {
      this.logger.error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured in environment');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  buildAuthUrl(businessId: string): string {
    const oauth2Client = this.getOAuth2Client();
    const state = encodeState({ businessId, ts: Date.now() });

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
      prompt: 'consent', // Force refresh token retrieval
    });
  }

  async handleCallback(code: string, encodedState: string) {
    let state: GoogleOAuthState;
    try {
      state = decodeState(encodedState);
    } catch (e) {
      throw new BadRequestException('Estado de OAuth de Google inválido');
    }

    if (!state?.businessId || !state?.ts) {
      throw new BadRequestException('Estado de OAuth de Google incompleto');
    }

    if (Date.now() - state.ts > this.stateMaxAgeMs) {
      throw new BadRequestException('Sesión de autenticación expirada. Reintenta.');
    }

    const oauth2Client = this.getOAuth2Client();
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      // Save tokens in BotConfig
      await this.prisma.botConfig.upsert({
        where: { businessId: state.businessId },
        update: {
          gmailAccessToken: tokens.access_token,
          gmailRefreshToken: tokens.refresh_token || undefined, // refresh_token might be undefined if not prompted
          gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
        create: {
          businessId: state.businessId,
          gmailAccessToken: tokens.access_token,
          gmailRefreshToken: tokens.refresh_token,
          gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });

      this.logger.log(`[GoogleOAuth] Guardados tokens exitosamente para negocio ${state.businessId}`);

      return {
        businessId: state.businessId,
        success: true,
      };
    } catch (err: any) {
      this.logger.error(`[GoogleOAuth] Error al intercambiar token: ${err.message}`);
      throw new BadRequestException(`Fallo en el intercambio de tokens de Google: ${err.message}`);
    }
  }

  async getValidClientForBusiness(businessId: string) {
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
    });

    if (!config || !config.gmailAccessToken) {
      return null;
    }

    const oauth2Client = this.getOAuth2Client();
    
    oauth2Client.setCredentials({
      access_token: config.gmailAccessToken,
      refresh_token: config.gmailRefreshToken || undefined,
      expiry_date: config.gmailTokenExpiry ? config.gmailTokenExpiry.getTime() : undefined,
    });

    // Check if token needs refreshing
    const isExpired = config.gmailTokenExpiry ? config.gmailTokenExpiry.getTime() < Date.now() : true;
    
    if (isExpired && config.gmailRefreshToken) {
      try {
        this.logger.log(`[GoogleOAuth] Refrescando token para negocio ${businessId}`);
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        await this.prisma.botConfig.update({
          where: { businessId },
          data: {
            gmailAccessToken: credentials.access_token,
            gmailTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });

        oauth2Client.setCredentials(credentials);
      } catch (err: any) {
        this.logger.error(`[GoogleOAuth] Fallo al refrescar token para negocio ${businessId}: ${err.message}`);
        return null;
      }
    }

    return oauth2Client;
  }
}
