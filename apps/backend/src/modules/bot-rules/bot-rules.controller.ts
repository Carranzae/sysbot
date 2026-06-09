import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotRulesService } from './bot-rules.service';

@Controller('bot-rules')
@UseGuards(JwtAuthGuard)
export class BotRulesController {
  constructor(private readonly botRulesService: BotRulesService) {}

  @Post()
  create(@Body() createBotRuleDto: any, @Query('businessId') businessId?: string) {
    return this.botRulesService.create(businessId || createBotRuleDto.businessId, createBotRuleDto);
  }

  @Get()
  findAll(@Query('businessId') businessId?: string) {
    return this.botRulesService.findAll(businessId as string);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId?: string) {
    return this.botRulesService.findOne(id, businessId as string);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateBotRuleDto: any, @Query('businessId') businessId?: string) {
    return this.botRulesService.update(id, businessId || updateBotRuleDto.businessId, updateBotRuleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId?: string) {
    return this.botRulesService.remove(id, businessId as string);
  }
}
