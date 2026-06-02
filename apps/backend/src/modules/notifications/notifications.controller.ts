import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post(':businessId')
  create(@Param('businessId') businessId: string, @Body() data: any) {
    return this.notificationsService.create(businessId, data);
  }

  @Get('business/:businessId')
  findAll(@Param('businessId') businessId: string) {
    return this.notificationsService.findAll(businessId);
  }

  @Get('business/:businessId/pending')
  findPending(@Param('businessId') businessId: string) {
    return this.notificationsService.findPending(businessId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
