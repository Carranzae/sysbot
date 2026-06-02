import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.patch('/auth/me', data),
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getOnboardingStatus: () => api.get('/auth/me/onboarding-status'),
}

export const businessApi = {
  getAll: () => api.get('/businesses'),
  getOne: (id: string) => api.get(`/businesses/${id}`),
  create: (data: any) => api.post('/businesses', data),
  createOnboarding: (data: any) => api.post('/businesses/onboarding', data),
  getIndustryPresets: () => api.get('/businesses/industry-presets'),
  update: (id: string, data: any) => api.patch(`/businesses/${id}`, data),
  delete: (id: string) => api.delete(`/businesses/${id}`),
  getMetrics: (id: string) => api.get(`/businesses/${id}/metrics`),
  getRecentActivity: (id: string) => api.get(`/businesses/${id}/activity`),
  getBotConfig: (id: string) => api.get(`/businesses/${id}/bot-config`),
  updateBotConfig: (id: string, data: any) => api.patch(`/businesses/${id}/bot-config`, data),
  connectTelegram: (id: string, data: { botToken: string; webhookUrl?: string }) =>
    api.post(`/businesses/${id}/telegram/connect`, data),
  disconnectTelegram: (id: string) => api.delete(`/businesses/${id}/telegram/connect`),
  startTelegramPersonal: (id: string, data: { apiId: string; apiHash: string; phone: string }) =>
    api.post(`/businesses/${id}/telegram/personal/start`, data),
  verifyTelegramPersonal: (id: string, data: { code: string; password?: string }) =>
    api.post(`/businesses/${id}/telegram/personal/verify`, data),
  disconnectTelegramPersonal: (id: string) => api.delete(`/businesses/${id}/telegram/personal`),
  getBotRules: (id: string) => api.get(`/businesses/${id}/bot-rules`),
  createBotRule: (id: string, data: any) => api.post(`/businesses/${id}/bot-rules`, data),
  updateBotRule: (businessId: string, ruleId: string, data: any) =>
    api.patch(`/businesses/${businessId}/bot-rules/${ruleId}`, data),
  deleteBotRule: (businessId: string, ruleId: string) =>
    api.delete(`/businesses/${businessId}/bot-rules/${ruleId}`),
  getPaymentSettings: (id: string) => api.get(`/businesses/${id}/payment-settings`),
  updatePaymentSettings: (id: string, data: any) => api.patch(`/businesses/${id}/payment-settings`, data),
  getContactSettings: (id: string) => api.get(`/businesses/${id}/contact-settings`),
  updateContactSettings: (id: string, data: any) => api.patch(`/businesses/${id}/contact-settings`, data),
  getPreferences: (id: string) => api.get(`/businesses/${id}/business-preferences`),
  updatePreferences: (id: string, data: any) => api.patch(`/businesses/${id}/business-preferences`, data),
  testAiApi: (provider: string, apiKey: string, model?: string, baseUrl?: string) =>
    api.post('/ai/test-api', { provider, apiKey, model, baseUrl }),
  getSocialSettings: (id: string) => api.get(`/businesses/${id}/social-settings`),
  updateSocialSettings: (id: string, data: any) => api.patch(`/businesses/${id}/bot-config`, data),
  updateSocialChannels: (id: string, data: { channels: any[] }) => api.patch(`/businesses/${id}/social-channels`, data),
}

export const contactsApi = {
  getAll: (businessId: string, params?: { search?: string; source?: string; tag?: string }) =>
    api.get('/contacts', {
      params: {
        businessId,
        ...(params || {}),
      },
    }),
  create: (
    businessId: string,
    data: { name?: string; phone: string; email?: string; source?: string; tags?: string[] }
  ) =>
    api.post(
      '/contacts',
      {
        ...data,
        tags: data.tags?.length ? data.tags.map((label) => ({ label })) : undefined,
      },
      {
        params: { businessId },
      }
    ),
}

export const campaignsApi = {
  getAll: (businessId: string, status?: string) =>
    api.get('/campaigns', {
      params: {
        businessId,
        ...(status ? { status } : {}),
      },
    }),
  create: (businessId: string, data: any) => api.post(`/campaigns?businessId=${businessId}`, data),
  duplicate: (id: string) => api.post(`/campaigns/${id}/duplicate`),
  resend: (id: string) => api.post(`/campaigns/${id}/resend`),
  updateStatus: (id: string, status: string) => api.patch(`/campaigns/${id}/status`, { status }),
}

export const filesApi = {
  getAll: (businessId: string) => api.get(`/files?businessId=${businessId}`),
  getOne: (id: string) => api.get(`/files/${id}`),
  download: (id: string) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
  upload: (businessId: string, file: File, description?: string, tags?: string[]) => {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    if (tags) formData.append('tags', JSON.stringify(tags))
    return api.post('/files/upload?businessId=' + businessId, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id: string, file: File, description?: string, tags?: string[]) => {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    if (tags) formData.append('tags', JSON.stringify(tags))
    return api.put(`/files/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getHistory: (id: string) => api.get(`/files/${id}/history`),
  delete: (id: string) => api.delete(`/files/${id}`),
}

export const messagesApi = {
  getAll: (businessId: string, page = 1, limit = 50) =>
    api.get(`/messages?businessId=${businessId}&page=${page}&limit=${limit}`),
  getConversation: (businessId: string, phoneNumber: string) =>
    api.get(`/messages/conversation?businessId=${businessId}&phoneNumber=${phoneNumber}`),
  sendWebMessage: (data: { businessId: string; to: string; message: string }) =>
    api.post('/whatsapp/web/send-message', data),
}



export const appointmentsApi = {
  getAll: (businessId: string) => api.get(`/appointments?businessId=${businessId}`),
  create: (businessId: string, data: any) => api.post(`/appointments?businessId=${businessId}`, data),
  update: (id: string, data: any) => api.patch(`/appointments/${id}`, data),
  delete: (id: string) => api.delete(`/appointments/${id}`),
}

export const ordersApi = {
  getAll: (businessId: string) => api.get(`/orders?businessId=${businessId}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.patch(`/orders/${id}`, data),
}

export const leadsApi = {
  getAll: (businessId: string) => api.get(`/leads?businessId=${businessId}`),
  update: (id: string, data: any) => api.patch(`/leads/${id}`, data),
}

export const notificationsApi = {
  getAll: (businessId: string) => api.get(`/notifications/business/${businessId}`),
  create: (businessId: string, data: any) => api.post(`/notifications/${businessId}`, data),
  delete: (id: string) => api.delete(`/notifications/${id}`),
}

export const emailApi = {
  getAuthUrl: (businessId: string) => api.post('/email/auth/gmail', { businessId }),
  handleCallback: (code: string, businessId: string) => api.post('/email/auth/gmail/callback', { code, businessId }),
}

export const whatsappApi = {
  getContacts: () => api.get('/whatsapp/web/contacts'),
  getGroups: () => api.get('/whatsapp/web/groups'),
  sendAudioLive: (data: FormData) => 
    api.post('/whatsapp/web/send-audio-live', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createAccount: (data: any) => api.post('/whatsapp/accounts', data),
  sendMessage: (data: { phoneNumberId: string; to: string; message: string }) => api.post('/whatsapp/send-message', data),
  initWeb: (businessId: string) => api.post('/whatsapp/web/init', { businessId }),
  getQr: (businessId: string) => api.get('/whatsapp/web/qr', { params: { businessId } }),
  getStatus: (businessId: string) => api.get('/whatsapp/web/status', { params: { businessId } }),
  sendWebMessage: (businessId: string, to: string, message: string) => api.post('/whatsapp/web/send-message', { businessId, to, message }),
  sendWebImage: (businessId: string, to: string, fileId?: string, filePath?: string, caption?: string) =>
    api.post('/whatsapp/web/send-image', { businessId, to, fileId, filePath, caption }),
  sendWebVideo: (businessId: string, to: string, fileId?: string, filePath?: string, caption?: string) =>
    api.post('/whatsapp/web/send-video', { businessId, to, fileId, filePath, caption }),
  sendWebDocument: (businessId: string, to: string, fileId?: string, filePath?: string, caption?: string) =>
    api.post('/whatsapp/web/send-document', { businessId, to, fileId, filePath, caption }),
  sendWebAudio: (businessId: string, to: string, fileId?: string, filePath?: string, ptt?: boolean) =>
    api.post('/whatsapp/web/send-audio', { businessId, to, fileId, filePath, ptt }),
  deleteSession: (businessId: string) => api.delete('/whatsapp/web/session', { params: { businessId } }),
}

export const channelApi = {
  getStatus: (businessId: string) => api.get(`/channels/${businessId}/status`),
}

export const metaApi = {
  getConnection: (businessId: string) => api.get(`/meta/connection/${businessId}`),
  updateConnection: (businessId: string, data: any) => api.patch(`/meta/connection/${businessId}`, data),
}

export const oauthApi = {
  getMetaPages: (sessionId: string) => api.get('/oauth/meta/pages', { params: { sessionId } }),
  selectMetaPage: (sessionId: string, pageId: string) => api.post('/oauth/meta/select-page', { sessionId, pageId }),
}

export const crmApi = {
  getConnection: (businessId: string) => api.get(`/crm/connection/${businessId}`),
  createConnection: (businessId: string, data: any) => api.post(`/crm/connection/${businessId}`, data),
  updateConnection: (businessId: string, data: any) => api.patch(`/crm/connection/${businessId}`, data),
  testConnection: (businessId: string) => api.post(`/crm/connection/${businessId}/test`),
  triggerSync: (businessId: string) => api.post(`/crm/connection/${businessId}/sync`),
  getSyncLogs: (businessId: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/crm/connection/${businessId}/sync-logs`, { params }),
  getChannelMappings: (businessId: string) => api.get(`/crm/connection/${businessId}/channels`),
  saveChannelMappings: (businessId: string, channelKeys: string[]) =>
    api.post(`/crm/connection/${businessId}/channels`, { channelKeys }),
  deleteConnection: (businessId: string) => api.delete(`/crm/connection/${businessId}`),
}

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params?: { search?: string; rubro?: string }) => api.get('/admin/users', { params }),
  updateUserRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
  updateUserPermissions: (id: string, permissions: string[]) => api.patch(`/admin/users/${id}/permissions`, { permissions }),
  toggleUserStatus: (id: string, isActive: boolean) => api.patch(`/admin/users/${id}/status`, { isActive }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  deleteBusiness: (id: string) => api.delete(`/admin/businesses/${id}`),
  updateBusinessFeatures: (id: string, data: { 
    features: string[]; 
    ragChannelTargets?: string[];
    upsellingEnabled?: boolean;
    sentimentAnalysisEnabled?: boolean;
  }) =>
    api.patch(`/admin/businesses/${id}/features`, data).then(res => res.data),
  updateBusinessPlan: (id: string, data: { planExpiresAt: string | null; isActive: boolean; planType?: string }) => api.patch(`/admin/businesses/${id}/plan`, data).then(res => res.data),
  updateBusinessSocials: (id: string, data: { allowedSocials: string[]; canSetDestination: boolean }) => api.patch(`/admin/businesses/${id}/socials`, data).then(res => res.data),

  getAuditLogs: (limit = 50) => api.get(`/admin/audit-logs?limit=${limit}`).then(res => res.data),

  getNotifications: () => api.get('/admin/notifications').then(res => res.data),
  broadcastNotification: (data: any) => api.post('/admin/notifications', data).then(res => res.data),

  getAnalytics: () => api.get('/admin/analytics').then(res => res.data),

  // Config
  getAllConfigs: () => api.get('/admin/config').then(res => res.data),
  upsertConfig: (data: any) => api.put('/admin/config', data).then(res => res.data),

  // Monitoring & Observability
  getMonitoringDashboard: () => api.get('/monitoring/dashboard').then(res => res.data),
  getSystemHealth: () => api.get('/admin/system-health').then(res => res.data),

  // Smart Automation
  syncGlobalContacts: () => api.post('/admin/automation/sync-contacts').then(res => res.data),
  processAutomationTick: () => api.post('/admin/automation/tick').then(res => res.data),
  getAutomationStats: () => api.get('/admin/automation/stats').then(res => res.data),

  // AI Engine (Super Admin Only)
  testAllAIProviders: () => api.post('/admin/ai/test-providers').then(res => res.data),
  generateTestResponse: (data: any) => api.post('/admin/ai/generate-test', data).then(res => res.data),
  executeRAG: (data: any) => api.post('/admin/ai/execute-rag', data).then(res => res.data),
  getAIProvidersStatus: () => api.get('/admin/ai/providers-status').then(res => res.data),
  getAIUsageStats: (days: number) => api.get(`/admin/ai/usage-stats?days=${days}`).then(res => res.data),
}

export const plansApi = {
  getAll: () => api.get('/plans').then(res => res.data),
  getMySubscription: () => api.get('/plans/subscription/my').then(res => res.data),
  createCheckout: (planType: string, interval: string, businessId?: string) => 
    api.post('/plans/subscription/checkout', { planType, interval, businessId }).then(res => res.data),
  checkLimits: (resource: string, current: number) => 
    api.post(`/plans/limits/check-${resource}`, { current }).then(res => res.data),
}

export const socialApi = {
  getPosts: (businessId: string) => api.get(`/social/${businessId}/posts`),
  createPost: (businessId: string, data: {
    caption: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledAt?: string;
    targetPlatforms: string[];
  }) => api.post(`/social/${businessId}/posts`, data),
}

// ============== LIVE CHAT BRIDGE API ==============
// Proxy al microservicio LIVE CHAT (Express :4000) via el puente NestJS
export const livechatApi = {
  // Chats
  getChats: () => api.get('/livechat/chats'),
  getChatMessages: (phone: string) => api.get(`/livechat/chats/${encodeURIComponent(phone)}`),
  getCustomerProfile: (phone: string) => api.get(`/livechat/chats/${encodeURIComponent(phone)}/profile`),
  getAvatar: (phone: string) => api.get(`/livechat/chats/${encodeURIComponent(phone)}/avatar`),
  
  // Mensajería
  sendMessage: (to: string, message: string, mediaUrl?: string) => 
    api.post('/livechat/send', { to, message, mediaUrl }),
  deleteMessage: (messageId: string) => api.delete(`/livechat/messages/${messageId}`),
  clearChat: (phone: string) => api.delete(`/livechat/chats/${encodeURIComponent(phone)}/clear`),
  
  // WhatsApp Web Control
  getStatus: () => api.get('/livechat/status'),
  startWhatsApp: (usePairingCode: boolean, phone: string) => 
    api.post('/livechat/start', { usePairingCode, phone }),
  disconnectWhatsApp: () => api.post('/livechat/disconnect'),
  
  // Bot IA Control
  getBotEnabled: () => api.get('/livechat/bot-enabled'),
  toggleBot: (enabled: boolean) => api.patch('/livechat/bot-enabled', { enabled }),
  pauseBotForChat: (phone: string, paused: boolean) => 
    api.patch(`/livechat/chats/${encodeURIComponent(phone)}/bot-pause`, { paused }),
  getPauseStatuses: (phones: string[]) => api.post('/livechat/chats/pause-statuses', { phones }),
}

