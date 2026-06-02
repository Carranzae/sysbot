/**
 * Channel Interface - Abstracción unificada para todos los canales de comunicación
 * Cada canal (WhatsApp, Telegram, Messenger, Instagram, Email, etc.) debe implementar esta interfaz
 */

export interface ChannelMessagePayload {
  to: string;
  content: string;
  businessId: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  replyToMessageId?: string;
  metadata?: Record<string, any>;
}

export interface ChannelIncomingPayload {
  from: string;
  content: string;
  businessId: string;
  platform: ChannelType;
  externalId?: string;
  mediaUrl?: string;
  mediaType?: string;
  senderId?: string;
  senderName?: string;
  isGroup?: boolean;
  metadata?: Record<string, any>;
}

export interface ChannelStatusResult {
  connected: boolean;
  platform: ChannelType;
  details?: string;
  lastActivity?: Date;
}

export type ChannelType = 
  | 'WHATSAPP_WEB'
  | 'WHATSAPP_API'
  | 'TELEGRAM'
  | 'MESSENGER'
  | 'INSTAGRAM'
  | 'EMAIL'
  | 'LIVECHAT';

export interface IChannelService {
  /**
   * Envía un mensaje por el canal
   */
  sendMessage(payload: ChannelMessagePayload): Promise<{ success: boolean; externalId?: string }>;

  /**
   * Procesa un mensaje entrante (guardar en BD, generar respuesta IA, enviar respuesta)
   */
  handleIncoming(payload: ChannelIncomingPayload): Promise<void>;

  /**
   * Obtiene el estado de conexión del canal para un negocio
   */
  getStatus(businessId: string): Promise<ChannelStatusResult>;

  /**
   * Nombre del canal para logging y UI
   */
  getChannelName(): string;
}
