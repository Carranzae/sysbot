import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessIsolationGuard } from '../auth/guards/business-isolation.guard';

@Controller('leads')
@UseGuards(JwtAuthGuard, BusinessIsolationGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  create(@Query('businessId') businessId: string, @Body() data: any) {
    return this.leadsService.create(businessId, data);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    return this.leadsService.findAll(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.leadsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}
