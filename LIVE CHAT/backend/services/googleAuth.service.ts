import { google } from 'googleapis'
import { config } from '../config/env'
import { logger } from '../api/utils/logger'

export class GoogleAuthService {
  private getClient(redirectUri?: string) {
    // Corregimos la ruta por defecto incluyendo el prefijo /api que estaba ausente
    const defaultRedirect = `${config.api.url}/api/payments/gmail/callback`
    return new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      redirectUri || defaultRedirect
    )
  }

  getAuthUrl(state: string, redirectUri?: string) {
    const oauth2Client = this.getClient(redirectUri)
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels'
      ],
      state: state, // Pasamos el estado para saber a quién pertenece y a dónde redirigir
      prompt: 'consent'
    })
  }

  async getTokens(code: string, redirectUri?: string) {
    try {
      const oauth2Client = this.getClient(redirectUri)
      const { tokens } = await oauth2Client.getToken(code)
      return tokens
    } catch (error: any) {
      logger.error('Error obteniendo tokens de Google:', error.message)
      throw error
    }
  }
}

export const googleAuthService = new GoogleAuthService()
