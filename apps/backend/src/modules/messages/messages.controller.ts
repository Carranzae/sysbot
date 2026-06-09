import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(
    @Query('businessId') businessId: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.findAll(businessId, limit ? parseInt(limit) : 50);
  }

  @Get('stats')
  getStats(@Query('businessId') businessId: string) {
    return this.messagesService.getMessageStats(businessId);
  }

  @Get('conversation')
  getConversation(
    @Query('businessId') businessId: string,
    @Query('phoneNumber') phoneNumber: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getConversationHistory(
      businessId,
      phoneNumber,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messagesService.findOne(id);
  }
}
