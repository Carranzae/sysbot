export const APP_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // File Upload
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  
  // AI
  DEFAULT_AI_CONFIDENCE_THRESHOLD: 0.7,
  MAX_CONTEXT_LENGTH: 4000,
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  
  // Cache TTL (seconds)
  CACHE_TTL_SHORT: 300, // 5 minutes
  CACHE_TTL_MEDIUM: 1800, // 30 minutes
  CACHE_TTL_LONG: 3600, // 1 hour
  
  // Rate Limiting
  RATE_LIMIT_TTL: 60, // 1 minute
  RATE_LIMIT_MAX: 100, // requests per TTL
  
  // Business Hours
  DEFAULT_BUSINESS_HOURS_START: '09:00',
  DEFAULT_BUSINESS_HOURS_END: '18:00',
  
  // WhatsApp
  WHATSAPP_MESSAGE_MAX_LENGTH: 4096,
  
  // Timeouts
  HTTP_TIMEOUT: 30000, // 30 seconds
  AI_TIMEOUT: 60000, // 60 seconds
};
