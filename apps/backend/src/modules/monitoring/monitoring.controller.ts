import { Controller, Get, Query, UseGuards, Request, Post, Body, Put, Delete, Param } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RateLimitRuleDto, AlertRuleDto, SetBudgetDto } from './dto/monitoring.dto';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.monitoringService.getDashboardData();
  }

  @Get('metrics')
  async getMetrics(@Query('range') timeRangeMs?: string) {
    const range = timeRangeMs ? parseInt(timeRangeMs) : 300000; // 5 minutes default
    return this.monitoringService.getRealtimeMetrics(range);
  }

  @Get('circuit-breakers')
  async getCircuitBreakers() {
    return this.monitoringService.getCircuitBreakers();
  }

  @Get('alerts')
  async getAlerts() {
    return this.monitoringService.getAlerts();
  }

  @Get('costs')
  async getCosts(@Query('range') timeRange: 'hour' | 'day' | 'week' | 'month' = 'month') {
    return this.monitoringService.getAPICosts(timeRange);
  }

  @Get('health')
  async getHealth() {
    const metrics = this.monitoringService.getMetrics();
    const circuitBreakers = this.monitoringService.getCircuitBreakers();

    const openBreakers = circuitBreakers.filter(cb => cb.state === 'OPEN').length;
    const errorRate = metrics.errorRate || 0;
    const avgResponseTime = metrics.avgResponseTime || 0;

    let status = 'healthy';
    if (openBreakers > 0 || errorRate > 0.1 || avgResponseTime > 5000) {
      status = 'unhealthy';
    } else if (errorRate > 0.05 || avgResponseTime > 2000) {
      status = 'warning';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      metrics: {
        totalRequests: metrics.totalRequests,
        avgResponseTime,
        errorRate,
        requestsPerSecond: metrics.requestsPerSecond,
      },
      circuitBreakers: {
        total: circuitBreakers.length,
        open: openBreakers,
        closed: circuitBreakers.filter(cb => cb.state === 'CLOSED').length,
        halfOpen: circuitBreakers.filter(cb => cb.state === 'HALF_OPEN').length,
      },
      uptime: process.uptime(),
    };
  }

  // ===== RATE LIMITING MANAGEMENT =====

  @Get('rate-limits')
  async getRateLimits() {
    // This would return current rate limit rules
    return { message: 'Rate limits management endpoint' };
  }

  @Post('rate-limits')
  async createRateLimit(@Body() rule: RateLimitRuleDto) {
    // This would create a new rate limit rule
    return { message: 'Rate limit rule created', rule };
  }

  @Put('rate-limits/:id')
  async updateRateLimit(@Param('id') id: string, @Body() rule: RateLimitRuleDto) {
    // This would update an existing rate limit rule
    return { message: 'Rate limit rule updated', id, rule };
  }

  @Delete('rate-limits/:id')
  async deleteRateLimit(@Param('id') id: string) {
    // This would delete a rate limit rule
    return { message: 'Rate limit rule deleted', id };
  }

  // ===== ALERT MANAGEMENT =====

  @Get('alerts/config')
  async getAlertConfig() {
    return this.monitoringService.getAlerts();
  }

  @Post('alerts/config')
  async createAlertRule(@Body() rule: AlertRuleDto) {
    // This would create a new alert rule
    return { message: 'Alert rule created', rule };
  }

  @Put('alerts/config/:id')
  async updateAlertRule(@Param('id') id: string, @Body() rule: AlertRuleDto) {
    // This would update an alert rule
    return { message: 'Alert rule updated', id, rule };
  }

  @Delete('alerts/config/:id')
  async deleteAlertRule(@Param('id') id: string) {
    // This would delete an alert rule
    return { message: 'Alert rule deleted', id };
  }

  // ===== COST MANAGEMENT =====

  @Post('budgets/:businessId')
  async setBudget(@Param('businessId') businessId: string, @Body() budget: SetBudgetDto) {
    await this.monitoringService.setCostBudget(businessId, budget.monthlyBudget, budget.alertThreshold);
    return { message: 'Budget set successfully', businessId, budget };
  }

  @Get('budgets/:businessId')
  async getBudget(@Param('businessId') businessId: string) {
    // This would return the current budget for a business
    return { message: 'Budget endpoint', businessId };
  }
}
