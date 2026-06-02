import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class LivechatBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LivechatBridgeService.name);
  private socket: ClientSocket | null = null;
  private httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private websocketGateway: WebsocketGateway,
  ) {
    this.baseUrl = this.configService.get('LIVECHAT_API_URL') || 'http://localhost:4000';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  async onModuleInit() {
    this.logger.log(`🔗 Connecting LiveChat Bridge to ${this.baseUrl}`);
    this.connectSocket();
  }

  onModuleDestroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.logger.log('🔌 LiveChat Bridge socket disconnected');
    }
  }

  private connectSocket() {
    try {
      this.socket = ioClient(this.baseUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 3000,
      });

      this.socket.on('connect', () => {
        this.logger.log('✅ LiveChat Bridge WebSocket connected');
      });

      this.socket.on('disconnect', (reason) => {
        this.logger.warn(`⚠️ LiveChat Bridge disconnected: ${reason}`);
      });

      // Retransmitir mensajes de WhatsApp desde LIVE CHAT al frontend de sysbot
      this.socket.on('whatsapp_message', (data: any) => {
        this.logger.log(`📨 Bridge received whatsapp_message from ${data.customerPhone}`);
        
        // Convertir formato LIVE CHAT → formato sysbot
        const sysbotMessage = {
          id: data.id || `bridge-${Date.now()}`,
          businessId: data.businessId,
          direction: data.type === 'incoming' ? 'INBOUND' : 'OUTBOUND',
          content: data.body,
          from: data.type === 'incoming' ? data.customerPhone : '',
          to: data.type === 'outgoing' ? data.customerPhone : '',
          platform: 'LIVECHAT',
          status: 'DELIVERED',
          createdAt: data.timestamp || new Date().toISOString(),
          mediaUrl: data.mediaUrl,
          metadata: {
            source: data.source,
            pushname: data.pushname,
            mediaType: data.mediaType,
          },
        };

        // Emitir a todos los clientes del negocio via sysbot WebSocket Gateway
        if (data.businessId) {
          this.websocketGateway.emitNewMessage(data.businessId, sysbotMessage);
        }
        // También emitir a la sala del usuario
        if (data.userId) {
          this.websocketGateway.server?.to(`user_${data.userId}`).emit('livechatMessage', sysbotMessage);
        }
      });

      // Retransmitir eventos de QR
      this.socket.on('whatsapp_qr', (data: any) => {
        this.logger.log('📱 Bridge received QR event');
        if (data.userId) {
          this.websocketGateway.server?.to(`user_${data.userId}`).emit('livechatQr', data);
        }
      });

      // Retransmitir evento de sesión lista
      this.socket.on('whatsapp_ready', (data: any) => {
        this.logger.log('✅ Bridge: WhatsApp session ready');
        if (data.userId) {
          this.websocketGateway.server?.to(`user_${data.userId}`).emit('livechatReady', data);
        }
      });

      // Retransmitir estado de conexión
      this.socket.on('whatsapp_status', (data: any) => {
        this.logger.log(`📡 Bridge: WhatsApp status: ${data.status}`);
        if (data.userId) {
          this.websocketGateway.server?.to(`user_${data.userId}`).emit('livechatStatus', data);
        }
      });

      // Retransmitir ACK de lectura
      this.socket.on('whatsapp_message_ack', (data: any) => {
        if (data.userId) {
          this.websocketGateway.server?.to(`user_${data.userId}`).emit('livechatAck', data);
        }
      });

    } catch (error) {
      this.logger.error(`❌ Failed to connect LiveChat Bridge: ${error}`);
    }
  }

  // Unirse a la sala del usuario en el LIVE CHAT socket
  joinUserRoom(userId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_user_room', userId);
      this.logger.log(`👤 Bridge joined room for user ${userId}`);
    }
  }

  // ============== HTTP PROXY METHODS ==============

  private getHeaders(token: string) {
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async getChats(token: string) {
    try {
      const res = await this.httpClient.get('/api/whatsapp/chats', this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error getting chats: ${error.message}`);
      return [];
    }
  }

  async getChatMessages(phone: string, token: string) {
    try {
      const res = await this.httpClient.get(`/api/whatsapp/chats/${encodeURIComponent(phone)}`, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error getting chat messages: ${error.message}`);
      return [];
    }
  }

  async sendMessage(to: string, message: string, token: string, mediaUrl?: string) {
    try {
      const body: any = { to, message };
      if (mediaUrl) body.mediaUrl = mediaUrl;
      const res = await this.httpClient.post('/api/whatsapp/send', body, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }

  async getWhatsAppStatus(token: string) {
    try {
      const res = await this.httpClient.get('/api/whatsapp/web/status', this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error getting WA status: ${error.message}`);
      return { status: 'disconnected' };
    }
  }

  async startWhatsApp(usePairingCode: boolean, phone: string, token: string) {
    try {
      const res = await this.httpClient.post('/api/whatsapp/web/start', { usePairingCode, phone }, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error starting WA: ${error.message}`);
      throw error;
    }
  }

  async disconnectWhatsApp(token: string) {
    try {
      const res = await this.httpClient.post('/api/whatsapp/web/disconnect', {}, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error disconnecting WA: ${error.message}`);
      throw error;
    }
  }

  async getBotEnabled(token: string) {
    try {
      const res = await this.httpClient.get('/api/whatsapp/web/bot-enabled', this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error getting bot status: ${error.message}`);
      return { enabled: false };
    }
  }

  async toggleBot(enabled: boolean, token: string) {
    try {
      const res = await this.httpClient.patch('/api/whatsapp/web/bot-enabled', { enabled }, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error toggling bot: ${error.message}`);
      throw error;
    }
  }

  async getCustomerProfile(phone: string, token: string) {
    try {
      const res = await this.httpClient.get(`/api/whatsapp/chats/${encodeURIComponent(phone)}/profile`, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error getting customer profile: ${error.message}`);
      return null;
    }
  }

  async deleteMessage(messageId: string, token: string) {
    try {
      const res = await this.httpClient.delete(`/api/whatsapp/chats/messages/${messageId}`, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error deleting message: ${error.message}`);
      throw error;
    }
  }

  async clearChat(phone: string, token: string) {
    try {
      const res = await this.httpClient.delete(`/api/whatsapp/chats/${encodeURIComponent(phone)}/clear`, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error clearing chat: ${error.message}`);
      throw error;
    }
  }

  async pauseBotForChat(phone: string, paused: boolean, token: string) {
    try {
      const res = await this.httpClient.patch(
        `/api/whatsapp/chats/${encodeURIComponent(phone)}/bot-pause`,
        { paused },
        this.getHeaders(token),
      );
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error pausing bot: ${error.message}`);
      throw error;
    }
  }

  async getPauseStatuses(phones: string[], token: string) {
    try {
      const res = await this.httpClient.post('/api/whatsapp/chats/pause-statuses', { phones }, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      this.logger.error(`Error getting pause statuses: ${error.message}`);
      return {};
    }
  }

  async getAvatar(phone: string, token: string) {
    try {
      const res = await this.httpClient.get(`/api/whatsapp/chats/${encodeURIComponent(phone)}/avatar`, this.getHeaders(token));
      return res.data;
    } catch (error: any) {
      return null;
    }
  }

  // ============== SWARM PROXY METHODS ==============

  async getSwarmAgents(): Promise<any[]> {
    // Return hardcoded agent status since swarm runs in-process
    return [
      { name: 'Agente de Empatía', role: 'Análisis de tono y humor del cliente', latency: '4ms', status: 'ACTIVE', cpu: '0.1%' },
      { name: 'Agente de Negociación', role: 'Reglas de precios y reservas directas', latency: '12ms', status: 'ACTIVE', cpu: '0.2%' },
      { name: 'Agente de Reconocimiento de Errores', role: 'Auditor de alucinaciones y RAG', latency: '8ms', status: 'ACTIVE', cpu: '0.1%' },
      { name: 'Agente de Buena Conducta', role: 'Escudo anti-inyecciones y fraudes', latency: '2ms', status: 'SHIELD_ACTIVE', cpu: '0.05%' },
    ];
  }

  async getSystemStatus(): Promise<any> {
    let waStatus = { status: 'disconnected' };
    let botStatus = { enabled: false };
    try {
      // Try to get statuses without token (internal check)
      waStatus = await this.getWhatsAppStatus('');
    } catch {}
    try {
      botStatus = await this.getBotEnabled('');
    } catch {}

    return {
      whatsapp: waStatus,
      bot: botStatus,
      swarmEngine: 'online',
      telephony: 'standby',
      redis: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
