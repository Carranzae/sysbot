import { getAuthToken, clearAuthSession } from '../lib/authStorage'

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const token = getAuthToken()
    const headers = new Headers(options.headers || {})
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const response = await fetch(url, { ...options, headers })
    const raw = await response.text()
    let data: any = null
    if (raw) {
      try { data = JSON.parse(raw) } catch { data = raw }
    }

    if (response.status === 401) {
      clearAuthSession()
      throw new Error((data && data.error) || 'Sesión expirada.')
    }
    if (!response.ok) {
      throw new Error((data && data.error) || `HTTP error! status: ${response.status}`)
    }
    return data as T
  }

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/api/auth/me')
  }

  // ─── WHATSAPP WEB STATUS ────────────────────────────────────────────────────
  async getWhatsAppWebStatus(): Promise<{ status: string; qr?: string }> {
    return this.request<{ status: string; qr?: string }>('/api/whatsapp/web/status')
  }

  async disconnectWhatsAppWeb(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/whatsapp/web/disconnect', { method: 'POST' })
  }

  async getWhatsAppBotEnabled(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/api/whatsapp/web/bot-enabled')
  }

  async setWhatsAppBotEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/api/whatsapp/web/bot-enabled', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  }

  // ─── WHATSAPP CHATS ─────────────────────────────────────────────────────────
  async getWhatsAppChats(): Promise<{ success: boolean; chats: any[] }> {
    return this.request<{ success: boolean; chats: any[] }>('/api/whatsapp/chats')
  }

  async getWhatsAppMessages(phone: string): Promise<{ success: boolean; messages: any[] }> {
    return this.request<{ success: boolean; messages: any[] }>(`/api/whatsapp/chats/${phone}`)
  }

  async getWhatsAppCustomerProfile(phone: string): Promise<{ success: boolean; profile: any }> {
    return this.request<{ success: boolean; profile: any }>(`/api/whatsapp/chats/${phone}/profile`)
  }

  async getWhatsAppAvatar(phone: string): Promise<{ success: boolean; avatarUrl: string | null }> {
    return this.request<{ success: boolean; avatarUrl: string | null }>(`/api/whatsapp/chats/${phone}/avatar`)
  }

  async deleteWhatsAppMessage(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/whatsapp/chats/messages/${id}`, { method: 'DELETE' })
  }

  async clearWhatsAppChat(phone: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/whatsapp/chats/${phone}/clear`, { method: 'DELETE' })
  }

  async sendWhatsAppMessage(to: string, message: string, mediaUrl?: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ to, message, mediaUrl }),
    })
  }

  async toggleWhatsAppBotPause(phone: string, pause: boolean): Promise<{ success: boolean; paused: boolean }> {
    return this.request<{ success: boolean; paused: boolean }>(`/api/whatsapp/chats/${phone}/bot-pause`, {
      method: 'PATCH',
      body: JSON.stringify({ pause }),
    })
  }

  async getWhatsAppChatPauseStatuses(phones: string[]): Promise<{ success: boolean; statuses: Record<string, boolean> }> {
    return this.request<{ success: boolean; statuses: Record<string, boolean> }>('/api/whatsapp/chats/pause-statuses', {
      method: 'POST',
      body: JSON.stringify({ phones }),
    })
  }
}

export const apiClient = new ApiClient(API_URL)
