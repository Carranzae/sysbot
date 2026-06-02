import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/subscription.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Post()
  async createSubscription(@Req() req: any, @Body() createDto: CreateSubscriptionDto) {
    return this.subscriptionService.createSubscription(req.user.userId, createDto.planType);
  }

  @Get('current')
  async getCurrentSubscription(@Req() req: any) {
    return this.subscriptionService.getSubscription(req.user.userId);
  }

  @Put('upgrade')
  async upgradeSubscription(@Req() req: any, @Body() updateDto: UpdateSubscriptionDto) {
    return this.subscriptionService.upgradeSubscription(req.user.userId, updateDto.planType);
  }

  @Delete()
  async cancelSubscription(@Req() req: any) {
    return this.subscriptionService.cancelSubscription(req.user.userId);
  }

  @Get('check-feature/:feature')
  async checkFeature(@Req() req: any, @Param('feature') feature: string) {
    const canUse = await this.subscriptionService.canUseFeature(req.user.userId, feature);
    return { canUse, feature };
  }

  @Post('check-limits')
  async checkLimits(@Req() req: any, @Body() body: { resource: string; amount: number }) {
    const withinLimit = await this.subscriptionService.checkLimits(req.user.userId, body.resource, body.amount);
    return { withinLimit, resource: body.resource, amount: body.amount };
  }
}
