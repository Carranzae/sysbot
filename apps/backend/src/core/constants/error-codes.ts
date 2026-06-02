export enum ErrorCode {
  // Authentication Errors (1000-1099)
  INVALID_CREDENTIALS = 'AUTH_1001',
  TOKEN_EXPIRED = 'AUTH_1002',
  TOKEN_INVALID = 'AUTH_1003',
  UNAUTHORIZED = 'AUTH_1004',
  FORBIDDEN = 'AUTH_1005',
  
  // User Errors (1100-1199)
  USER_NOT_FOUND = 'USER_1101',
  USER_ALREADY_EXISTS = 'USER_1102',
  USER_INACTIVE = 'USER_1103',
  
  // Business Errors (1200-1299)
  BUSINESS_NOT_FOUND = 'BUSINESS_1201',
  BUSINESS_ALREADY_EXISTS = 'BUSINESS_1202',
  BUSINESS_INACTIVE = 'BUSINESS_1203',
  
  // File Errors (1300-1399)
  FILE_NOT_FOUND = 'FILE_1301',
  FILE_TOO_LARGE = 'FILE_1302',
  FILE_INVALID_TYPE = 'FILE_1303',
  FILE_UPLOAD_FAILED = 'FILE_1304',
  
  // Message Errors (1400-1499)
  MESSAGE_NOT_FOUND = 'MESSAGE_1401',
  MESSAGE_SEND_FAILED = 'MESSAGE_1402',
  
  // WhatsApp Errors (1500-1599)
  WHATSAPP_NOT_CONFIGURED = 'WHATSAPP_1501',
  WHATSAPP_SEND_FAILED = 'WHATSAPP_1502',
  WHATSAPP_INVALID_NUMBER = 'WHATSAPP_1503',
  
  // AI Errors (1600-1699)
  AI_PROCESSING_FAILED = 'AI_1601',
  AI_CONFIDENCE_LOW = 'AI_1602',
  AI_TIMEOUT = 'AI_1603',
  
  // Validation Errors (1700-1799)
  VALIDATION_FAILED = 'VALIDATION_1701',
  INVALID_INPUT = 'VALIDATION_1702',
  MISSING_REQUIRED_FIELD = 'VALIDATION_1703',
  
  // Database Errors (1800-1899)
  DATABASE_ERROR = 'DB_1801',
  DUPLICATE_ENTRY = 'DB_1802',
  FOREIGN_KEY_CONSTRAINT = 'DB_1803',
  
  // General Errors (1900-1999)
  INTERNAL_SERVER_ERROR = 'GENERAL_1901',
  SERVICE_UNAVAILABLE = 'GENERAL_1902',
  NOT_FOUND = 'GENERAL_1903',
  BAD_REQUEST = 'GENERAL_1904',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.INVALID_CREDENTIALS]: 'Credenciales inválidas',
  [ErrorCode.TOKEN_EXPIRED]: 'Token expirado',
  [ErrorCode.TOKEN_INVALID]: 'Token inválido',
  [ErrorCode.UNAUTHORIZED]: 'No autorizado',
  [ErrorCode.FORBIDDEN]: 'Acceso prohibido',
  
  // User
  [ErrorCode.USER_NOT_FOUND]: 'Usuario no encontrado',
  [ErrorCode.USER_ALREADY_EXISTS]: 'El usuario ya existe',
  [ErrorCode.USER_INACTIVE]: 'Usuario inactivo',
  
  // Business
  [ErrorCode.BUSINESS_NOT_FOUND]: 'Negocio no encontrado',
  [ErrorCode.BUSINESS_ALREADY_EXISTS]: 'El negocio ya existe',
  [ErrorCode.BUSINESS_INACTIVE]: 'Negocio inactivo',
  
  // File
  [ErrorCode.FILE_NOT_FOUND]: 'Archivo no encontrado',
  [ErrorCode.FILE_TOO_LARGE]: 'Archivo demasiado grande',
  [ErrorCode.FILE_INVALID_TYPE]: 'Tipo de archivo inválido',
  [ErrorCode.FILE_UPLOAD_FAILED]: 'Error al subir archivo',
  
  // Message
  [ErrorCode.MESSAGE_NOT_FOUND]: 'Mensaje no encontrado',
  [ErrorCode.MESSAGE_SEND_FAILED]: 'Error al enviar mensaje',
  
  // WhatsApp
  [ErrorCode.WHATSAPP_NOT_CONFIGURED]: 'WhatsApp no configurado',
  [ErrorCode.WHATSAPP_SEND_FAILED]: 'Error al enviar mensaje de WhatsApp',
  [ErrorCode.WHATSAPP_INVALID_NUMBER]: 'Número de WhatsApp inválido',
  
  // AI
  [ErrorCode.AI_PROCESSING_FAILED]: 'Error al procesar con IA',
  [ErrorCode.AI_CONFIDENCE_LOW]: 'Confianza de IA muy baja',
  [ErrorCode.AI_TIMEOUT]: 'Timeout en procesamiento de IA',
  
  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Validación fallida',
  [ErrorCode.INVALID_INPUT]: 'Entrada inválida',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Campo requerido faltante',
  
  // Database
  [ErrorCode.DATABASE_ERROR]: 'Error de base de datos',
  [ErrorCode.DUPLICATE_ENTRY]: 'Entrada duplicada',
  [ErrorCode.FOREIGN_KEY_CONSTRAINT]: 'Violación de clave foránea',
  
  // General
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Error interno del servidor',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Servicio no disponible',
  [ErrorCode.NOT_FOUND]: 'No encontrado',
  [ErrorCode.BAD_REQUEST]: 'Solicitud incorrecta',
};
