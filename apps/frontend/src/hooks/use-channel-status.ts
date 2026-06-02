import { useCallback, useEffect, useState } from 'react'
import { channelApi, metaApi } from '@/lib/api'

export type TelegramMode = 'BOT' | 'PERSONAL'
export type TelegramAuthStatus = 'NOT_CONFIGURED' | 'CODE_REQUIRED' | 'CODE_SENT' | 'CONNECTED' | 'ERROR'

export interface ChannelStatusResponse {
  businessId: string
  generatedAt: string
  whatsapp: {
    mode: 'WHATSAPP_WEB' | 'WHATSAPP_API'
    api: {
      enabled: boolean
      businessId: string | null
      phoneNumberId: string | null
      webhookSecret: string | null
      accounts?: Array<{
        id: string
        phoneNumber: string | null
        phoneNumberId: string | null
        active: boolean
        createdAt?: string
        updatedAt?: string
      }>
    }
    web: {
      enabled: boolean
      number: string | null
      status: string | null
      qr: string | null
      lastSyncAt: string | null
    }
  }
  telegram: {
    mode: TelegramMode
    enabled: boolean
    authStatus: TelegramAuthStatus
    connected: boolean
    lastSyncAt: string | null
    bot: {
      username?: string | null
      webhookUrl?: string | null
      secretToken?: string | null
      status?: string | null
      connected?: boolean
      lastError?: string | null
    } | null
    personal: {
      phone: string | null
      twoFactorEnabled: boolean
      status: TelegramAuthStatus
    } | null
  }
  meta: {
    messenger: {
      enabled: boolean
      connected: boolean
      pageId: string | null
      verifyToken: string | null
      accessTokenConfigured: boolean
    }
    instagram: {
      enabled: boolean
      connected: boolean
      accountId: string | null
      accessTokenConfigured: boolean
    }
    webhook: {
      url: string | null
      verified: boolean
    }
  }
}

export interface MetaConnection {
  businessId: string
  messengerEnabled: boolean
  messengerPageId?: string | null
  messengerAccessToken?: string | null
  messengerVerifyToken?: string | null
  messengerConnected: boolean
  instagramEnabled: boolean
  instagramAccountId?: string | null
  instagramAccessToken?: string | null
  instagramConnected: boolean
  webhookUrl?: string | null
  webhookVerified: boolean
}

interface UseChannelStatusResult {
  channelStatus: ChannelStatusResponse | null
  metaConnection: MetaConnection | null
  statusLoading: boolean
  statusError: string | null
  manualRefreshing: boolean
  refreshStatus: () => Promise<void>
  lastUpdatedAt: Date | null
}

export function useChannelStatus(businessId?: string): UseChannelStatusResult {
  const [channelStatus, setChannelStatus] = useState<ChannelStatusResponse | null>(null)
  const [metaConnection, setMetaConnection] = useState<MetaConnection | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const fetchStatus = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!businessId) {
        setChannelStatus(null)
        setMetaConnection(null)
        setStatusError(null)
        setLastUpdatedAt(null)
        return
      }

      if (options?.manual) {
        setManualRefreshing(true)
      }

      setStatusLoading(true)
      setStatusError(null)

      try {
        const [channelResponse, metaResponse] = await Promise.all([
          channelApi.getStatus(businessId),
          metaApi.getConnection(businessId),
        ])

        const snapshot: ChannelStatusResponse = channelResponse.data
        setChannelStatus(snapshot)
        setMetaConnection(metaResponse.data)
        setLastUpdatedAt(new Date(snapshot.generatedAt || Date.now()))
      } catch (error: any) {
        console.error('Error fetching channel status', error)
        const apiMessage = error?.response?.data?.message
        setStatusError(apiMessage || 'No pudimos cargar el estado de los canales. Intenta nuevamente.')
        setChannelStatus(null)
        setMetaConnection(null)
        setLastUpdatedAt(null)
      } finally {
        setStatusLoading(false)
        if (options?.manual) {
          setManualRefreshing(false)
        }
      }
    },
    [businessId],
  )

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!businessId) {
      return
    }
    const interval = setInterval(() => {
      fetchStatus()
    }, 45000)

    return () => clearInterval(interval)
  }, [businessId, fetchStatus])

  const refreshStatus = useCallback(async () => {
    await fetchStatus({ manual: true })
  }, [fetchStatus])

  return { channelStatus, metaConnection, statusLoading, statusError, manualRefreshing, refreshStatus, lastUpdatedAt }
}
