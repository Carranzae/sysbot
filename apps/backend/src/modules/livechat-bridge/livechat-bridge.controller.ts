import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, Query } from '@nestjs/common';
import { LivechatBridgeService } from './livechat-bridge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('livechat')
@UseGuards(JwtAuthGuard)
export class LivechatBridgeController {
  constructor(private readonly bridgeService: LivechatBridgeService) {}

  private extractToken(req: any): string {
    return req.headers.authorization?.replace('Bearer ', '') || '';
  }

  @Get('chats')
  async getChats(@Req() req: any) {
    const token = this.extractToken(req);
    // Unirse a la sala del usuario en el LIVE CHAT socket
    if (req.user?.userId) {
      this.bridgeService.joinUserRoom(req.user.userId);
    }
    return this.bridgeService.getChats(token);
  }

  @Get('chats/:phone')
  async getChatMessages(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.getChatMessages(phone, this.extractToken(req));
  }

  @Get('chats/:phone/profile')
  async getCustomerProfile(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.getCustomerProfile(phone, this.extractToken(req));
  }

  @Get('chats/:phone/avatar')
  async getAvatar(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.getAvatar(phone, this.extractToken(req));
  }

  @Post('send')
  async sendMessage(@Body() body: { to: string; message: string; mediaUrl?: string }, @Req() req: any) {
    return this.bridgeService.sendMessage(body.to, body.message, this.extractToken(req), body.mediaUrl);
  }

  @Get('status')
  async getWhatsAppStatus(@Req() req: any) {
    return this.bridgeService.getWhatsAppStatus(this.extractToken(req));
  }

  @Post('start')
  async startWhatsApp(@Body() body: { usePairingCode?: boolean; phone?: string }, @Req() req: any) {
    if (req.user?.userId) {
      this.bridgeService.joinUserRoom(req.user.userId);
    }
    return this.bridgeService.startWhatsApp(body.usePairingCode || false, body.phone || '', this.extractToken(req));
  }

  @Post('disconnect')
  async disconnectWhatsApp(@Req() req: any) {
    return this.bridgeService.disconnectWhatsApp(this.extractToken(req));
  }

  @Get('bot-enabled')
  async getBotEnabled(@Req() req: any) {
    return this.bridgeService.getBotEnabled(this.extractToken(req));
  }

  @Patch('bot-enabled')
  async toggleBot(@Body() body: { enabled: boolean }, @Req() req: any) {
    return this.bridgeService.toggleBot(body.enabled, this.extractToken(req));
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string, @Req() req: any) {
    return this.bridgeService.deleteMessage(id, this.extractToken(req));
  }

  @Delete('chats/:phone/clear')
  async clearChat(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.clearChat(phone, this.extractToken(req));
  }

  @Patch('chats/:phone/bot-pause')
  async pauseBotForChat(@Param('phone') phone: string, @Body() body: { paused: boolean }, @Req() req: any) {
    return this.bridgeService.pauseBotForChat(phone, body.paused, this.extractToken(req));
  }

  @Post('chats/pause-statuses')
  async getPauseStatuses(@Body() body: { phones: string[] }, @Req() req: any) {
    return this.bridgeService.getPauseStatuses(body.phones, this.extractToken(req));
  }

  @Get('swarm/agents')
  async getSwarmAgents() {
    return this.bridgeService.getSwarmAgents();
  }

  @Get('system/status')
  async getSystemStatus() {
    return this.bridgeService.getSystemStatus();
  }
}
