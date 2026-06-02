import { google } from 'googleapis'
import { config } from '../config/env'

type GmailClient = ReturnType<typeof google.gmail>

export function createGmailClient(options?: {
  clientId?: string,
  clientSecret?: string,
  refreshToken?: string
}): GmailClient {
  const clientId = options?.clientId || config.gmail.clientId
  const clientSecret = options?.clientSecret || config.gmail.clientSecret
  const refreshToken = options?.refreshToken || config.gmail.refreshToken

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail API no configurada (GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN)')
  }

  const oauth2Client = new google.auth.OAuth2({
    clientId,
    clientSecret,
  })

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export async function ensureLabelId(gmail: GmailClient, userId: string, labelName: string): Promise<string> {
  const list = await gmail.users.labels.list({ userId })
  const existing = (list.data.labels || []).find((l) => l.name === labelName)
  if (existing?.id) return existing.id

  const created = await gmail.users.labels.create({
    userId,
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  })

  if (!created.data.id) {
    throw new Error('No se pudo crear label Gmail')
  }

  return created.data.id
}

export function decodeGmailBody(data: string): string {
  const normalized = (data || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

export function extractPlainTextFromMessage(msg: any): string {
  const payload = msg?.payload
  if (!payload) return msg?.snippet || ''

  const walk = (part: any): string[] => {
    if (!part) return []

    const mimeType = (part.mimeType || '').toLowerCase()
    const bodyData = part.body?.data

    if (bodyData && (mimeType === 'text/plain' || mimeType === 'text/html' || !mimeType)) {
      const decoded = decodeGmailBody(bodyData)
      return [decoded]
    }

    const parts = part.parts || []
    return parts.flatMap((p: any) => walk(p))
  }

  const texts = walk(payload)
  if (texts.length > 0) return texts.join('\n')
  return msg?.snippet || ''
}
