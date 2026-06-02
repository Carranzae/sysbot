import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() data: any, @Query('businessId') businessId: string) {
    return this.ordersService.create(businessId, data);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    return this.ordersService.findAll(businessId);
  }

  @Get('stats')
  getStats(@Query('businessId') businessId: string) {
    return this.ordersService.getStats(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.ordersService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
