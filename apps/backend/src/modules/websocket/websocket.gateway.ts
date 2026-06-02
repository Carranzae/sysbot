import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
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

  emitNewMessage(businessId: string, message: any) {
    this.server.to(`business_${businessId}`).emit('newMessage', message);
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
