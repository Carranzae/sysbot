import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(@Query('businessId') businessId: string, @Body() data: any) {
    return this.appointmentsService.create(businessId, data);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    console.log(`[AppointmentsController] findAll called with businessId: ${businessId}`);
    return this.appointmentsService.findAll(businessId);
  }

  @Get('upcoming')
  findUpcoming(@Query('businessId') businessId: string) {
    return this.appointmentsService.findUpcoming(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.appointmentsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }
}
