// Configuración de variables de entorno para el backend
// Este archivo centraliza todas las variables de entorno

export const config = {
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Email
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  },

  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    user: process.env.GMAIL_USER || 'me',
    query: process.env.GMAIL_QUERY || 'is:unread',
    processedLabel: process.env.GMAIL_PROCESSED_LABEL || 'APP_NEGOCIO_PROCESSED',
    pollIntervalMs: parseInt(process.env.GMAIL_POLL_INTERVAL_MS || '120000', 10),
    enabled: process.env.GMAIL_BOT_ENABLED === 'true',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000',
  },

  // API
  api: {
    url: process.env.VITE_API_URL || 'http://localhost:3001',
  },

  admin: {
    apiKey: process.env.ADMIN_API_KEY || '',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // AI Keys Rotation (Infinite Pool Support)
  ai: {
    geminiKeys: Object.keys(process.env)
      .filter(key => key.startsWith('GEMINI_API_KEY'))
      .map(key => (process.env[key] || '').replace(/"/g, '').split(','))
      .flat()
      .map(k => k.trim())
      .filter(k => k.length >= 30 && !k.includes('<') && !k.toLowerCase().includes('pendiente')),
  }
}

// Validar configuración crítica
export const validateConfig = () => {
  const errors: string[] = []

  if (!config.auth.jwtSecret) {
    errors.push('JWT_SECRET no configurado')
  }

  if (config.email.user && !config.email.password) {
    errors.push('EMAIL_PASSWORD requerida cuando EMAIL_USER está configurado')
  }

  if (config.gmail.enabled) {
    if (!config.gmail.clientId) errors.push('GMAIL_CLIENT_ID no configurado (bot Gmail habilitado)')
    if (!config.gmail.clientSecret) errors.push('GMAIL_CLIENT_SECRET no configurado (bot Gmail habilitado)')
    if (!config.gmail.refreshToken) errors.push('GMAIL_REFRESH_TOKEN no configurado (bot Gmail habilitado)')
    if (!config.admin.apiKey) errors.push('ADMIN_API_KEY no configurado (para proteger /payments/gmail/scan)')
  }

  if (!process.env.REDIS_URL) {
    console.warn('💡 Tip: Configura REDIS_URL para activar el Caché de Clase Mundial (Fallback a memoria RAM activado)')
  }

  if (errors.length > 0) {
    console.warn('⚠️ Advertencias de configuración:')
    errors.forEach(error => console.warn(`  - ${error}`))
  }

  return errors.length === 0
}

// Validar al cargar el módulo
if (process.env.NODE_ENV !== 'test') {
  validateConfig()
}

