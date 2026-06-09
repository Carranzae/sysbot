import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private prisma: PrismaService) {}
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBusiness')
  handleJoinBusiness(client: Socket, businessId: string) {
    client.join(`business_${businessId}`);
    console.log(`Client ${client.id} joined business ${businessId}`);
  }

  @SubscribeMessage('leaveBusiness')
  handleLeaveBusiness(client: Socket, businessId: string) {
    client.leave(`business_${businessId}`);
    console.log(`Client ${client.id} left business ${businessId}`);
  }

  @SubscribeMessage('joinUser')
  handleJoinUser(client: Socket, userId: string) {
    client.join(`user_${userId}`);
    console.log(`Client ${client.id} joined user ${userId}`);
  }

  @SubscribeMessage('leaveUser')
  handleLeaveUser(client: Socket, userId: string) {
    client.leave(`user_${userId}`);
    console.log(`Client ${client.id} left user ${userId}`);
  }

  async emitNewMessage(businessId: string, message: any) {
    this.server.to(`business_${businessId}`).emit('newMessage', message);

    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });

      const payload = {
        id: message.id,
        content: message.content,
        from: message.from,
        to: message.to,
        direction: message.direction,
        createdAt: message.createdAt,
        status: message.status,
        mediaUrl: message.mediaUrl,
        metadata: {
          mediaType: (message.metadata as any)?.mediaType,
          source: message.platform ? message.platform.toLowerCase() : 'whatsapp',
          ...message.metadata,
        },
      };

      this.server.to(`business_${businessId}`).emit('livechatMessage', payload);
      if (business?.ownerId) {
        this.server.to(`user_${business.ownerId}`).emit('livechatMessage', payload);
      }
    } catch (err) {
      console.error('Error emitting livechatMessage:', err);
    }
  }

  async emitLivechatQr(businessId: string, qr: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      if (!business?.ownerId) return;

      const payload = { qr };
      this.server.to(`business_${businessId}`).emit('livechatQr', payload);
      this.server.to(`user_${business.ownerId}`).emit('livechatQr', payload);
    } catch (err) {
      console.error('Error emitting livechatQr:', err);
    }
  }

  async emitLivechatStatus(businessId: string, status: string, qrCode?: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      if (!business?.ownerId) return;

      let frontendStatus = 'disconnected';
      if (status === 'READY' || status === 'CONNECTED') {
        frontendStatus = 'connected';
      } else if (status === 'QR_READY' || status === 'WAITING_QR_SCAN' || status === 'INITIALIZING') {
        frontendStatus = 'connecting';
      }

      const payload = {
        status: frontendStatus,
        qr: qrCode || undefined,
      };

      this.server.to(`business_${businessId}`).emit('livechatStatus', payload);
      this.server.to(`user_${business.ownerId}`).emit('livechatStatus', payload);

      if (frontendStatus === 'connected') {
        this.server.to(`business_${businessId}`).emit('livechatReady');
        this.server.to(`user_${business.ownerId}`).emit('livechatReady');
      }
    } catch (err) {
      console.error('Error emitting livechatStatus:', err);
    }
  }

  emitNewOrder(businessId: string, order: any) {
    this.server.to(`business_${businessId}`).emit('newOrder', order);
  }

  emitNewAppointment(businessId: string, appointment: any) {
    this.server.to(`business_${businessId}`).emit('newAppointment', appointment);
  }

  emitNewLead(businessId: string, lead: any) {
    this.server.to(`business_${businessId}`).emit('newLead', lead);
  }

  emitBusinessNotification(businessId: string, notification: any) {
    this.server.to(`business_${businessId}`).emit('adminNotification', notification);
  }

  emitUserNotification(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('adminNotification', notification);
  }

  emitBotRuleEvent(businessId: string, payload: { action: 'created' | 'updated' | 'deleted'; rule: any }) {
    this.server.to(`business_${businessId}`).emit('botRuleEvent', {
      businessId,
      ...payload,
    });
  }
}
