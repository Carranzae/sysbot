import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotRulesService } from './bot-rules.service';

@Controller('bot-rules')
@UseGuards(JwtAuthGuard)
export class BotRulesController {
  constructor(private readonly botRulesService: BotRulesService) {}

  @Post()
  create(@Body() createBotRuleDto: any) {
    return this.botRulesService.create(createBotRuleDto);
  }

  @Get()
  findAll(@Query('businessId') businessId?: string) {
    return this.botRulesService.findAll(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.botRulesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateBotRuleDto: any) {
    return this.botRulesService.update(id, updateBotRuleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.botRulesService.remove(id);
  }
}
