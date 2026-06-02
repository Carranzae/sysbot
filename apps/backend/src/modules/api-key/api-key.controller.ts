import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(@Request() req, @Body() body: { name: string }) {
    const businessId = req.user.businessId;
    return this.apiKeyService.createKey(businessId, body.name);
  }

  @Get()
  async findAll(@Request() req) {
    const businessId = req.user.businessId;
    return this.apiKeyService.findAll(businessId);
  }

  @Delete(':id')
  async revoke(@Request() req, @Param('id') id: string) {
    const businessId = req.user.businessId;
    return this.apiKeyService.revoke(id, businessId);
  }
}
