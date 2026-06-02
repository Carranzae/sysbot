import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ChannelConfigService } from './channel-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@syst/database';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelConfigController {
  constructor(private readonly channelConfigService: ChannelConfigService) {}

  @Get(':businessId/status')
  getStatus(@Req() req: any, @Param('businessId') businessId: string) {
    return this.channelConfigService.getChannelStatus(businessId, {
      ownerId: req.user?.userId,
      role: req.user?.role as UserRole | undefined,
    });
  }
}
