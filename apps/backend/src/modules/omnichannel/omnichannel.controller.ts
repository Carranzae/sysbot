import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OmnichannelService } from './omnichannel.service';

@Controller('omnichannel')
@UseGuards(JwtAuthGuard)
export class OmnichannelController {
  constructor(private readonly omnichannelService: OmnichannelService) {}

  @Get('conversations')
  getConversations(
    @Query('businessId') businessId: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.omnichannelService.getConversations(businessId, { channel, search, limit });
  }

  @Get('conversations/:id')
  getConversation(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.omnichannelService.getConversationTimeline(businessId, id, limit ? Number(limit) : 100);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @Body() body: { message: string; subject?: string },
  ) {
    return this.omnichannelService.sendMessage(businessId, id, body);
  }

  @Post('conversations/:id/crm')
  upsertCrm(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.omnichannelService.upsertCrmContext(businessId, id, body);
  }

  @Post('email/sync')
  syncEmail(@Query('businessId') businessId: string, @Query('limit') limit?: string) {
    return this.omnichannelService.syncEmailInbox(businessId, limit ? Number(limit) : 25);
  }
}
