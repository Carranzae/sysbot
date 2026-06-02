import { Controller, Get, Post, Body, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('config')
  async createConfig(
    @Request() req,
    @Body() data: { url: string; events: string[]; secret?: string }
  ) {
    const businessId = req.user.businessId;
    return this.webhooksService.create(businessId, data);
  }

  @Get('config')
  async findAll(@Request() req) {
    const businessId = req.user.businessId;
    return this.webhooksService.findAll(businessId);
  }

  @Delete('config/:id')
  async remove(@Request() req, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.webhooksService.remove(id, businessId);
  }
}
