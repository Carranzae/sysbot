import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
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
    data: { name?: string; phone: string; email?: string; source?: string; autoCreated?: boolean; tags?: string[] }
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
  update: (id: string, data: any) => api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
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
  create: (businessId: string, data: any) => api.post(`/leads?businessId=${businessId}`, data),
  update: (id: string, data: any) => api.patch(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
}

export const paymentsApi = {
  getAll: (businessId: string) => api.get(`/payments/automation/business/${businessId}`),
  create: (data: any) => api.post('/payments/automation', data),
  verify: (paymentId: string) => api.get(`/payments/automation/verify/${paymentId}`),
  refund: (paymentId: string, data?: { amount?: number; reason?: string }) =>
    api.post(`/payments/automation/${paymentId}/refund`, data || {}),
  getStats: (businessId: string, startDate?: string, endDate?: string) =>
    api.get(`/payments/automation/business/${businessId}/stats`, {
      params: { startDate, endDate },
    }),
  testGateway: (businessId: string, gateway: string) =>
    api.post(`/payments/automation/business/${businessId}/test-gateway`, { gateway }),
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
  initWeb: (businessId: string, phoneNumber?: string) => api.post('/whatsapp/web/init', { businessId, phoneNumber }),
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
  getMetaStartUrl: (platform: 'facebook' | 'instagram', businessId: string) =>
    api.get(`/oauth/${platform}/start-url`, { params: { businessId } }),
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
  getChannelMappings: async (businessId: string) => {
    try {
      return await api.get(`/crm/connection/${businessId}/channels`)
    } catch (error: any) {
      if (error.response?.status === 404) {
        return api.get(`/crm/channels/${businessId}`)
      }
      throw error
    }
  },
  saveChannelMappings: (businessId: string, channelKeys: string[]) =>
    api.post(`/crm/connection/${businessId}/channels`, { channelKeys }).catch((error) => {
      if (error.response?.status === 404) {
        return api.post(`/crm/channels/${businessId}`, { channelKeys })
      }
      throw error
    }),
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
// Endpoints legacy compatibles; hoy se resuelven desde el puente nativo NestJS.
export const livechatApi = {
  // Chats
  getChats: (businessId?: string) => api.get('/livechat/chats', { params: { businessId } }),
  getChatMessages: (phone: string, businessId?: string) =>
    api.get(`/livechat/chats/${encodeURIComponent(phone)}`, { params: { businessId } }),
  getCustomerProfile: (phone: string, businessId?: string) =>
    api.get(`/livechat/chats/${encodeURIComponent(phone)}/profile`, { params: { businessId } }),
  getAvatar: (phone: string, businessId?: string) =>
    api.get(`/livechat/chats/${encodeURIComponent(phone)}/avatar`, { params: { businessId } }),
  
  // Mensajería
  sendMessage: (to: string, message: string, mediaUrl?: string, businessId?: string) => 
    api.post('/livechat/send', { to, message, mediaUrl, businessId }),
  deleteMessage: (messageId: string, businessId?: string) =>
    api.delete(`/livechat/messages/${messageId}`, { params: { businessId } }),
  clearChat: (phone: string, businessId?: string) =>
    api.delete(`/livechat/chats/${encodeURIComponent(phone)}/clear`, { params: { businessId } }),
  
  // WhatsApp Web Control
  getStatus: (businessId?: string) => api.get('/livechat/status', { params: { businessId } }),
  startWhatsApp: (usePairingCode: boolean, phone: string, businessId?: string) => 
    api.post('/livechat/start', { usePairingCode, phone, businessId }),
  disconnectWhatsApp: (businessId?: string) => api.post('/livechat/disconnect', { businessId }),
  
  // Bot IA Control
  getBotEnabled: (businessId?: string) => api.get('/livechat/bot-enabled', { params: { businessId } }),
  toggleBot: (enabled: boolean, businessId?: string) => api.patch('/livechat/bot-enabled', { enabled, businessId }),
  pauseBotForChat: (phone: string, paused: boolean, businessId?: string) => 
    api.patch(`/livechat/chats/${encodeURIComponent(phone)}/bot-pause`, { paused, businessId }),
  getPauseStatuses: (phones: string[], businessId?: string) =>
    api.post('/livechat/chats/pause-statuses', { phones, businessId }),
}

// ============== OMNICHANNEL API ==============
export const omnichannelApi = {
  getConversations: (businessId: string, params?: { channel?: string; search?: string; limit?: number }) =>
    api.get('/omnichannel/conversations', { params: { businessId, ...(params || {}) } }),
  getConversation: (businessId: string, conversationId: string, limit = 100) =>
    api.get(`/omnichannel/conversations/${encodeURIComponent(conversationId)}`, { params: { businessId, limit } }),
  sendMessage: (businessId: string, conversationId: string, message: string, subject?: string) =>
    api.post(`/omnichannel/conversations/${encodeURIComponent(conversationId)}/messages`, { message, subject }, { params: { businessId } }),
  saveCrmContext: (businessId: string, conversationId: string, data: any) =>
    api.post(`/omnichannel/conversations/${encodeURIComponent(conversationId)}/crm`, data, { params: { businessId } }),
  syncEmail: (businessId: string, limit = 25) =>
    api.post('/omnichannel/email/sync', null, { params: { businessId, limit } }),
}

// ============== CRM CALL CENTER API ==============
export const crmCallApi = {
  getLogs: () => api.get('/crm-call/logs'),
  getAnalytics: () => api.get('/crm-call/analytics'),
  createLog: (data: {
    contactId?: string;
    contactPhone?: string;
    contactName?: string;
    duration: number;
    status: 'COMPLETED' | 'MISSED' | 'BUSY' | 'FAILED';
    recordingUrl?: string;
    transcription?: string;
    sentiment?: string;
    queryResolved: boolean;
  }) => api.post('/crm-call/log', data),
  submitSurvey: (callId: string, score: number, feedback?: string) =>
    api.post(`/crm-call/survey/${callId}`, { score, feedback }),
}

// ============== CLINIC MANAGEMENT API ==============
export const clinicApi = {
  getContracts: (businessId: string) => api.get(`/clinic/contracts?businessId=${businessId}`),
  configureContract: (businessId: string, data: any) => api.post(`/clinic/contracts?businessId=${businessId}`, data),
  getDoctorsWallet: (businessId: string) => api.get(`/clinic/doctors/wallet?businessId=${businessId}`),
  registerInvoice: (businessId: string, data: any) => api.post(`/clinic/integrations/invoices?businessId=${businessId}`, data),
  getInventory: (businessId: string) => api.get(`/clinic/inventory?businessId=${businessId}`),
  configureInventoryItem: (businessId: string, data: any) => api.post(`/clinic/inventory?businessId=${businessId}`, data),
  getProcedureSupplies: (businessId: string) => api.get(`/clinic/supplies?businessId=${businessId}`),
  configureProcedureSupplies: (businessId: string, data: any) => api.post(`/clinic/supplies?businessId=${businessId}`, data),
  deductInventory: (businessId: string, procedureName: string) => api.post(`/clinic/inventory/deduct?businessId=${businessId}`, { procedureName }),
  getPatientDocuments: (businessId: string, phone: string) => api.get(`/clinic/patients/documents?businessId=${businessId}&customerPhone=${phone}`),
  getAvailableSlots: (businessId: string, date: string, specialty: string, duration = 60) => 
    api.get(`/clinic/slots/disponibles?businessId=${businessId}&date=${date}&specialty=${specialty}&duration=${duration}`),
  registerAppointmentFromIntegration: (businessId: string, data: any) => 
    api.post(`/clinic/integrations/appointments?businessId=${businessId}`, data),
  notifyLabResult: (businessId: string, fileId: string) => 
    api.post(`/clinic/notify-lab?businessId=${businessId}`, { fileId }),
}
