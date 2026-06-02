import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignStatusDto } from './dto/campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignStatus } from '@syst/database';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Query('businessId') businessId: string, @Body() dto: CreateCampaignDto) {
    if (!businessId) {
      throw new BadRequestException('businessId query param is required');
    }
    return this.campaignsService.create(businessId, dto);
  }

  @Get()
  findAll(@Query('businessId') businessId: string, @Query('status') status?: CampaignStatus) {
    if (!businessId) {
      throw new BadRequestException('businessId query param is required');
    }
    return this.campaignsService.findAll(businessId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.campaignsService.updateStatus(id, dto);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.campaignsService.duplicate(id);
  }

  @Post(':id/resend')
  resend(@Param('id') id: string) {
    return this.campaignsService.resend(id);
  }
}
