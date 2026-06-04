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

  private extractBusinessId(req: any): string | undefined {
    return (
      req.query?.businessId ||
      req.body?.businessId ||
      req.headers['x-business-id'] ||
      req.user?.businessId
    );
  }

  @Get('chats')
  async getChats(@Req() req: any) {
    const token = this.extractToken(req);
    const businessId = this.extractBusinessId(req);
    // Unirse a la sala del negocio en el LIVE CHAT socket
    if (businessId) {
      this.bridgeService.joinUserRoom(businessId);
    } else if (req.user?.userId) {
      this.bridgeService.joinUserRoom(req.user.userId);
    }
    return this.bridgeService.getChats(token, businessId);
  }

  @Get('chats/:phone')
  async getChatMessages(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.getChatMessages(phone, this.extractToken(req), this.extractBusinessId(req));
  }

  @Get('chats/:phone/profile')
  async getCustomerProfile(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.getCustomerProfile(phone, this.extractToken(req), this.extractBusinessId(req));
  }

  @Get('chats/:phone/avatar')
  async getAvatar(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.getAvatar(phone, this.extractToken(req), this.extractBusinessId(req));
  }

  @Post('send')
  async sendMessage(@Body() body: { to: string; message: string; mediaUrl?: string; businessId?: string }, @Req() req: any) {
    return this.bridgeService.sendMessage(body.to, body.message, this.extractToken(req), body.mediaUrl, this.extractBusinessId(req));
  }

  @Get('status')
  async getWhatsAppStatus(@Req() req: any) {
    return this.bridgeService.getWhatsAppStatus(this.extractToken(req), this.extractBusinessId(req));
  }

  @Post('start')
  async startWhatsApp(@Body() body: { usePairingCode?: boolean; phone?: string; businessId?: string }, @Req() req: any) {
    const businessId = this.extractBusinessId(req);
    if (businessId) {
      this.bridgeService.joinUserRoom(businessId);
    } else if (req.user?.userId) {
      this.bridgeService.joinUserRoom(req.user.userId);
    }
    return this.bridgeService.startWhatsApp(body.usePairingCode || false, body.phone || '', this.extractToken(req), this.extractBusinessId(req));
  }

  @Post('disconnect')
  async disconnectWhatsApp(@Req() req: any) {
    return this.bridgeService.disconnectWhatsApp(this.extractToken(req), this.extractBusinessId(req));
  }

  @Get('bot-enabled')
  async getBotEnabled(@Req() req: any) {
    return this.bridgeService.getBotEnabled(this.extractToken(req), this.extractBusinessId(req));
  }

  @Patch('bot-enabled')
  async toggleBot(@Body() body: { enabled: boolean; businessId?: string }, @Req() req: any) {
    return this.bridgeService.toggleBot(body.enabled, this.extractToken(req), this.extractBusinessId(req));
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string, @Req() req: any) {
    return this.bridgeService.deleteMessage(id, this.extractToken(req), this.extractBusinessId(req));
  }

  @Delete('chats/:phone/clear')
  async clearChat(@Param('phone') phone: string, @Req() req: any) {
    return this.bridgeService.clearChat(phone, this.extractToken(req), this.extractBusinessId(req));
  }

  @Patch('chats/:phone/bot-pause')
  async pauseBotForChat(@Param('phone') phone: string, @Body() body: { paused: boolean; businessId?: string }, @Req() req: any) {
    return this.bridgeService.pauseBotForChat(phone, body.paused, this.extractToken(req), this.extractBusinessId(req));
  }

  @Post('chats/pause-statuses')
  async getPauseStatuses(@Body() body: { phones: string[]; businessId?: string }, @Req() req: any) {
    return this.bridgeService.getPauseStatuses(body.phones, this.extractToken(req), this.extractBusinessId(req));
  }

  @Get('swarm/agents')
  async getSwarmAgents() {
    return this.bridgeService.getSwarmAgents();
  }

  @Get('system/status')
  async getSystemStatus() {
    return this.bridgeService.getSystemStatus();
  }

  @Get('system/health')
  async getDetailedHealth() {
    return this.bridgeService.getDetailedHealth();
  }
}
