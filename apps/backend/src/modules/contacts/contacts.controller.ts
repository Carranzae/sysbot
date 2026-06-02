import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(
    @Query('businessId') businessId: string,
    @Query('whatsappAccountId') whatsappAccountId: string | undefined,
    @Body() dto: CreateContactDto,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId query param is required');
    }
    return this.contactsService.create(businessId, whatsappAccountId, dto);
  }

  @Get()
  findAll(
    @Query('businessId') businessId: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('tag') tag?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId query param is required');
    }
    return this.contactsService.findAll(businessId, { search, source, tag });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
