import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@syst/database';

@Controller('social')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post(':businessId/posts')
  @Roles(UserRole.BUSINESS_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createPost(
    @Param('businessId') businessId: string,
    @Body() data: {
      caption: string;
      mediaUrl?: string;
      mediaType?: string;
      scheduledAt?: string;
      targetPlatforms: string[];
    }
  ) {
    return this.socialService.createPost(businessId, data);
  }

  @Get(':businessId/posts')
  @Roles(UserRole.BUSINESS_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPosts(@Param('businessId') businessId: string) {
    return this.socialService.getPosts(businessId);
  }
}
