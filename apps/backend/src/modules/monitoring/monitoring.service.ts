import { Injectable, Logger, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';

export interface APIMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  userId?: string;
  businessId?: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  errorMessage?: string;
}

export interface RateLimitRule {
  endpoint: string;
  method: string;
  limit: number; // requests per window
  windowMs: number; // time window in milliseconds
  userRoles?: string[]; // apply only to specific roles
  businessPlans?: string[]; // apply only to specific plans
  blockDurationMs?: number; // how long to block after exceeding limit
}

export interface CircuitBreakerState {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  successCount: number;
  totalRequests: number;
  totalFailures: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string; // e.g., 'responseTime > 5000', 'errorRate > 0.1'
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  cooldownMs: number; // minimum time between alerts
  lastTriggered?: Date;
  channels: string[]; // ['EMAIL', 'SLACK', 'WEBHOOK']
  recipients?: string[];
}

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private redis: Redis;
  private metrics: APIMetrics[] = [];
  private rateLimits: Map<string, RateLimitRule[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private alertRules: AlertRule[] = [];
  private metricsInterval: NodeJS.Timeout;
  private alertCheckInterval: NodeJS.Timeout;

  // Circuit breaker defaults
  private readonly CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    successThreshold: 3,
    timeoutMs: 60000, // 1 minute
    monitoringPeriodMs: 120000, // 2 minutes
  };

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {
    // Initialize Redis client
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      reconnectOnError: (err: any) => {
        console.log('Redis reconnect on error', err);
        return true;
      },
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for monitoring');
    });
  }

  async onModuleInit() {
    // Initialize rate limiting rules
    await this.initializeRateLimits();

    // Initialize circuit breakers for external services
    await this.initializeCircuitBreakers();

    // Initialize alert rules
    await this.initializeAlertRules();

    // Start metrics collection
    this.startMetricsCollection();

    // Start alert checking
    this.startAlertChecking();

    this.logger.log('🚀 Monitoring service initialized');
  }

  async onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }

  // ===== METRICS COLLECTION =====

  async recordAPIMetric(metric: APIMetrics) {
    // Store in memory for real-time access
    this.metrics.push(metric);

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Store in Redis for persistence (last 24 hours)
    try {
      const key = `api_metrics:${Date.now()}`;
      await this.redis.set(key, JSON.stringify(metric), 'EX', 86400); // 24 hours
    } catch (error) {
      this.logger.warn('Failed to store metric in Redis', error);
    }

    // Check for immediate alerts
    await this.checkImmediateAlerts(metric);
  }

  getRealtimeMetrics(timeRangeMs: number = 300000) { // 5 minutes default
    const cutoff = Date.now() - timeRangeMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);

    const stats = {
      totalRequests: recentMetrics.length,
      avgResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length || 0,
      errorRate: recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length || 0,
      requestsPerSecond: recentMetrics.length / (timeRangeMs / 1000),
      statusCodes: {} as Record<number, number>,
      endpoints: {} as Record<string, number>,
      slowestEndpoints: [] as Array<{ endpoint: string; avgTime: number; count: number }>,
    };

    // Calculate distributions
    recentMetrics.forEach(metric => {
      stats.statusCodes[metric.statusCode] = (stats.statusCodes[metric.statusCode] || 0) + 1;
      stats.endpoints[metric.endpoint] = (stats.endpoints[metric.endpoint] || 0) + 1;
    });

    // Calculate slowest endpoints
    const endpointStats = Object.entries(stats.endpoints).map(([endpoint, count]) => {
      const endpointMetrics = recentMetrics.filter(m => m.endpoint === endpoint);
      const avgTime = endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0) / endpointMetrics.length;
      return { endpoint, avgTime, count };
    });

    stats.slowestEndpoints = endpointStats
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    return stats;
  }

  // ===== RATE LIMITING =====

  private async initializeRateLimits() {
    // Default rate limiting rules
    const defaultRules: RateLimitRule[] = [
      {
        endpoint: '/api/v1/ai/chat',
        method: 'POST',
        limit: 50,
        windowMs: 60000, // 1 minute
        blockDurationMs: 300000, // 5 minutes
      },
      {
        endpoint: '/api/v1/files/upload',
        method: 'POST',
        limit: 10,
        windowMs: 300000, // 5 minutes
        blockDurationMs: 600000, // 10 minutes
      },
      {
        endpoint: '/api/v1/whatsapp/send',
        method: 'POST',
        limit: 100,
        windowMs: 3600000, // 1 hour
      },
      // Business plan specific limits
      {
        endpoint: '/api/v1/ai/chat',
        method: 'POST',
        limit: 200,
        windowMs: 60000,
        businessPlans: ['ENTERPRISE', 'PREMIUM'],
      },
    ];

    this.rateLimits.set('default', defaultRules);

    // Load custom rules from database
    try {
      const customRules = await this.prisma.systemConfig.findMany({
        where: {
          key: { startsWith: 'RATE_LIMIT_' }
        }
      });

      // Parse and add custom rules
      customRules.forEach(config => {
        try {
          const rule = JSON.parse(config.value);
          const existingRules = this.rateLimits.get(rule.endpoint) || [];
          existingRules.push(rule);
          this.rateLimits.set(rule.endpoint, existingRules);
        } catch (error) {
          this.logger.warn(`Failed to parse rate limit rule: ${config.key}`, error);
        }
      });
    } catch (error) {
      this.logger.warn('Failed to load custom rate limit rules', error);
    }
  }

  async checkRateLimit(
    endpoint: string,
    method: string,
    userId: string,
    userRole?: string,
    businessPlan?: string
  ): Promise<{ allowed: boolean; remainingRequests: number; resetTime: Date }> {
    const applicableRules = this.getApplicableRules(endpoint, method, userRole, businessPlan);

    if (applicableRules.length === 0) {
      return { allowed: true, remainingRequests: -1, resetTime: new Date() };
    }

    // Check the most restrictive rule
    const strictestRule = applicableRules.reduce((prev, current) =>
      current.limit < prev.limit ? current : prev
    );

    const key = `rate_limit:${userId}:${endpoint}:${method}`;
    const now = Date.now();
    const windowStart = now - strictestRule.windowMs;

    try {
      // Check if user is currently blocked
      const blockKey = `rate_limit_block:${userId}`;
      const blockUntil = await this.redis.get(blockKey);

      if (blockUntil && parseInt(blockUntil) > now) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: new Date(parseInt(blockUntil))
        };
      }

      // Get request count for current window
      const requests = await this.redis.lrange(key, 0, -1);
      const currentWindowRequests = requests.filter(timestamp =>
        parseInt(timestamp) > windowStart
      ).length;

      const remaining = Math.max(0, strictestRule.limit - currentWindowRequests);

      if (currentWindowRequests >= strictestRule.limit) {
        // Block user if configured
        if (strictestRule.blockDurationMs) {
          await this.redis.set(
            blockKey,
            (now + strictestRule.blockDurationMs).toString(),
            'EX',
            Math.ceil(strictestRule.blockDurationMs / 1000)
          );
        }

        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: new Date(now + strictestRule.windowMs)
        };
      }

      // Add current request timestamp
      await this.redis.lpush(key, now.toString());
      await this.redis.expire(key, Math.ceil(strictestRule.windowMs / 1000));

      return {
        allowed: true,
        remainingRequests: remaining - 1,
        resetTime: new Date(now + strictestRule.windowMs)
      };
    } catch (error) {
      this.logger.warn('Rate limit check failed, allowing request', error);
      return { allowed: true, remainingRequests: -1, resetTime: new Date() };
    }
  }

  private getApplicableRules(endpoint: string, method: string, userRole?: string, businessPlan?: string): RateLimitRule[] {
    const allRules: RateLimitRule[] = [];

    // Add rules for all endpoints
    const defaultRules = this.rateLimits.get('default') || [];
    allRules.push(...defaultRules);

    // Add endpoint-specific rules
    const endpointRules = this.rateLimits.get(endpoint) || [];
    allRules.push(...endpointRules);

    // Filter by user role and business plan
    return allRules.filter(rule => {
      if (rule.method && rule.method !== method) return false;
      if (rule.userRoles && userRole && !rule.userRoles.includes(userRole)) return false;
      if (rule.businessPlans && businessPlan && !rule.businessPlans.includes(businessPlan)) return false;
      return true;
    });
  }

  // ===== CIRCUIT BREAKERS =====

  private async initializeCircuitBreakers() {
    // Initialize circuit breakers for external services
    const services = ['openai', 'anthropic', 'groq', 'google-ai', 'whatsapp', 'email'];

    services.forEach(service => {
      this.circuitBreakers.set(service, {
        service,
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
      });
    });
  }

  async checkCircuitBreaker(service: string): Promise<boolean> {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return true;

    const now = Date.now();

    switch (breaker.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (breaker.nextRetryTime && now >= breaker.nextRetryTime.getTime()) {
          breaker.state = 'HALF_OPEN';
          breaker.successCount = 0;
          this.logger.log(`🔄 Circuit breaker for ${service} moved to HALF_OPEN`);
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return true;
    }
  }

  async recordCircuitBreakerResult(service: string, success: boolean) {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return;

    breaker.totalRequests++;

    if (success) {
      breaker.successCount++;
      breaker.failureCount = 0;

      if (breaker.state === 'HALF_OPEN' && breaker.successCount >= this.CIRCUIT_BREAKER_CONFIG.successThreshold) {
        breaker.state = 'CLOSED';
        this.logger.log(`✅ Circuit breaker for ${service} closed after ${breaker.successCount} successes`);
      }
    } else {
      breaker.failureCount++;
      breaker.totalFailures++;
      breaker.lastFailureTime = new Date();

      if (breaker.failureCount >= this.CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        breaker.state = 'OPEN';
        breaker.nextRetryTime = new Date(Date.now() + this.CIRCUIT_BREAKER_CONFIG.timeoutMs);
        this.logger.warn(`🚫 Circuit breaker for ${service} opened after ${breaker.failureCount} failures`);

        // Trigger alert
        await this.triggerAlert('CIRCUIT_BREAKER_OPEN', {
          service,
          failureCount: breaker.failureCount,
          totalFailures: breaker.totalFailures,
        });
      }
    }
  }

  getCircuitBreakerStates(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  // ===== ALERT SYSTEM =====

  private async initializeAlertRules() {
    // Default alert rules
    this.alertRules = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        condition: 'avgResponseTime > 5000',
        threshold: 5000,
        severity: 'HIGH',
        enabled: true,
        cooldownMs: 300000, // 5 minutes
        channels: ['EMAIL'],
        recipients: ['admin@syst.com'],
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: 'errorRate > 0.1',
        threshold: 0.1,
        severity: 'CRITICAL',
        enabled: true,
        cooldownMs: 600000, // 10 minutes
        channels: ['EMAIL', 'SLACK'],
        recipients: ['admin@syst.com'],
      },
      {
        id: 'circuit_breaker_open',
        name: 'Circuit Breaker Open',
        condition: 'circuitBreakerOpen',
        threshold: 1,
        severity: 'CRITICAL',
        enabled: true,
        cooldownMs: 300000,
        channels: ['EMAIL', 'SLACK'],
      },
      {
        id: 'rate_limit_exceeded',
        name: 'Rate Limit Exceeded',
        condition: 'rateLimitExceeded',
        threshold: 10,
        severity: 'MEDIUM',
        enabled: true,
        cooldownMs: 60000, // 1 minute
        channels: ['EMAIL'],
      },
      {
        id: 'budget_threshold_exceeded',
        name: 'Budget Threshold Exceeded',
        condition: 'budgetThresholdExceeded',
        threshold: 80,
        severity: 'MEDIUM',
        enabled: true,
        cooldownMs: 3600000, // 1 hour
        channels: ['EMAIL'],
      },
      {
        id: 'budget_exceeded',
        name: 'Budget Exceeded',
        condition: 'budgetExceeded',
        threshold: 100,
        severity: 'HIGH',
        enabled: true,
        cooldownMs: 1800000, // 30 minutes
        channels: ['EMAIL', 'SLACK'],
      },
    ];
  }

  private async checkImmediateAlerts(metric: APIMetrics) {
    // Check for immediate alerts based on single metrics
    if (metric.responseTime > 10000) { // 10 seconds
      await this.triggerAlert('HIGH_RESPONSE_TIME_SINGLE', {
        endpoint: metric.endpoint,
        responseTime: metric.responseTime,
        userId: metric.userId,
        timestamp: metric.timestamp,
      });
    }

    if (metric.statusCode >= 500) {
      await this.triggerAlert('SERVER_ERROR', {
        endpoint: metric.endpoint,
        statusCode: metric.statusCode,
        errorMessage: metric.errorMessage,
        userId: metric.userId,
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  private async checkBudgetAlertsScheduled() {
    try {
      await this.checkBudgetAlerts();
    } catch (error) {
      this.logger.error('Error checking budget alerts', error);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  private async checkPeriodicAlerts() {
    try {
      const metrics = this.getRealtimeMetrics(300000); // Last 5 minutes

      for (const rule of this.alertRules) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (rule.lastTriggered) {
          const timeSinceLastAlert = Date.now() - rule.lastTriggered.getTime();
          if (timeSinceLastAlert < rule.cooldownMs) continue;
        }

        let shouldTrigger = false;
        const alertData: any = { rule: rule.name };

        switch (rule.condition) {
          case 'avgResponseTime > 5000':
            if (metrics.avgResponseTime > rule.threshold) {
              shouldTrigger = true;
              alertData.avgResponseTime = metrics.avgResponseTime;
            }
            break;

          case 'errorRate > 0.1':
            if (metrics.errorRate > rule.threshold) {
              shouldTrigger = true;
              alertData.errorRate = metrics.errorRate;
              alertData.totalRequests = metrics.totalRequests;
            }
            break;
        }

        if (shouldTrigger) {
          await this.triggerAlert(rule.id, alertData);
          rule.lastTriggered = new Date();
        }
      }
    } catch (error) {
      this.logger.error('Error checking periodic alerts', error);
    }
  }

  private async triggerAlert(alertType: string, data: any) {
    try {
      const rule = this.alertRules.find(r => r.id === alertType);
      if (!rule) return;

      const subject = `🚨 SYST Alert: ${rule.name}`;
      const message = `
Alert Details:
- Type: ${rule.name}
- Severity: ${rule.severity}
- Time: ${new Date().toISOString()}
- Data: ${JSON.stringify(data, null, 2)}

Please check the admin dashboard for more details.
      `.trim();

      // Send notifications based on channels
      if (rule.channels.includes('EMAIL') && rule.recipients) {
        // TODO: Implement email notifications
        this.logger.warn(`EMAIL notification would be sent to ${rule.recipients.join(', ')}: ${subject}`);
      }

      // Log to database
      await this.prisma.systemAlert.create({
        data: {
          type: alertType,
          severity: rule.severity,
          message: subject,
          data,
          resolved: false,
        },
      });

      this.logger.warn(`🚨 Alert triggered: ${alertType}`, data);
    } catch (error) {
      this.logger.error('Failed to trigger alert', error);
    }
  }

  // ===== COST MANAGEMENT =====

  async getAPICosts(timeRange: 'hour' | 'day' | 'week' | 'month' = 'month'): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get cost data from database (assuming we store API usage)
    const costData = await this.prisma.apiUsage.aggregate({
      where: {
        timestamp: { gte: startDate }
      },
      _sum: {
        tokensUsed: true,
        cost: true,
      },
      _count: true,
    });

    // Get cost by provider
    const costByProvider = await this.prisma.apiUsage.groupBy({
      by: ['provider'],
      where: { timestamp: { gte: startDate } },
      _sum: {
        tokensUsed: true,
        cost: true,
      },
      _count: true,
    });

    // Get cost by business
    const costByBusiness = await this.prisma.apiUsage.groupBy({
      by: ['businessId'],
      where: { timestamp: { gte: startDate } },
      _sum: {
        tokensUsed: true,
        cost: true,
      },
    });

    // Get business details separately
    const businessDetails = await this.prisma.business.findMany({
      where: {
        id: { in: costByBusiness.map(item => item.businessId) }
      },
      select: {
        id: true,
        name: true,
        owner: { select: { email: true } }
      }
    });

    // Combine the data
    const costByBusinessWithDetails = costByBusiness.map(item => ({
      ...item,
      business: businessDetails.find(b => b.id === item.businessId)
    }));

    return {
      timeRange,
      startDate,
      endDate: now,
      totalCost: costData._sum.cost || 0,
      totalTokens: costData._sum.tokensUsed || 0,
      totalRequests: costData._count || 0,
      costByProvider,
      costByBusiness: costByBusinessWithDetails,
      averageCostPerToken: costData._sum.tokensUsed ?
        Number(costData._sum.cost || 0) / Number(costData._sum.tokensUsed) : 0,
    };
  }

  async setCostBudget(businessId: string, monthlyBudget: number, alertThreshold: number = 0.8): Promise<void> {
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        budget: {
          upsert: {
            create: { monthlyBudget },
            update: { monthlyBudget }
          }
        },
        budgetAlertThreshold: alertThreshold,
      },
    });
  }

  async checkBudgetAlerts(): Promise<void> {
    // Get current month's usage for all businesses with budgets
    const businessesWithBudgets = await this.prisma.business.findMany({
      where: {
        budget: { isNot: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        budget: { select: { monthlyBudget: true } },
        budgetAlertThreshold: true,
        owner: { select: { email: true } },
      },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const business of businessesWithBudgets) {
      if (!business.budget) continue;
      const monthlyUsage = await this.prisma.apiUsage.aggregate({
        where: {
          businessId: business.id,
          timestamp: { gte: startOfMonth },
        },
        _sum: { cost: true },
      });

      const currentCost = monthlyUsage._sum.cost || 0;
      const budget = business.budget.monthlyBudget;
      const usagePercentage = (Number(currentCost) / Number(budget)) * 100;

      // Check if we should trigger an alert
      if (business.budgetAlertThreshold && usagePercentage >= (Number(business.budgetAlertThreshold) * 100)) {
        await this.triggerAlert('BUDGET_THRESHOLD_EXCEEDED', {
          businessId: business.id,
          businessName: business.name,
          currentCost,
          budget,
          usagePercentage,
          threshold: business.budgetAlertThreshold * 100,
          ownerEmail: business.owner.email,
        });
      }

      // Critical alert if over budget
      if (currentCost > budget) {
        await this.triggerAlert('BUDGET_EXCEEDED', {
          businessId: business.id,
          businessName: business.name,
          currentCost,
          budget,
          overBy: Number(currentCost) - Number(budget),
          ownerEmail: business.owner.email,
        });
      }
    }
  }

  async recordAPICost(
    businessId: string,
    provider: string,
    tokensUsed: number,
    cost: number,
    endpoint?: string,
    model?: string
  ): Promise<void> {
    await this.prisma.apiUsage.create({
      data: {
        businessId,
        provider,
        tokensUsed,
        cost,
        endpoint,
        model,
      },
    });

    // Update business token usage
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        totalTokensUsed: {
          increment: tokensUsed,
        },
        totalApiCost: {
          increment: cost,
        },
      },
    });
  }

  // ===== DASHBOARD DATA =====

  async getDashboardData(): Promise<any> {
    const realtimeMetrics = this.getRealtimeMetrics(300000); // 5 minutes
    const circuitBreakers = this.getCircuitBreakerStates();
    const recentAlerts = await this.prisma.systemAlert.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { resolved: false },
    });

    const costData = await this.getAPICosts('month');

    return {
      realtime: realtimeMetrics,
      circuitBreakers,
      alerts: recentAlerts,
      costs: costData,
      systemHealth: this.calculateSystemHealth(realtimeMetrics, circuitBreakers),
    };
  }

  private calculateSystemHealth(metrics: any, circuitBreakers: CircuitBreakerState[]): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
    let score = 100;

    // Deduct points for high error rate
    if (metrics.errorRate > 0.1) score -= 30;
    else if (metrics.errorRate > 0.05) score -= 15;

    // Deduct points for high response time
    if (metrics.avgResponseTime > 5000) score -= 25;
    else if (metrics.avgResponseTime > 2000) score -= 10;

    // Deduct points for open circuit breakers
    const openBreakers = circuitBreakers.filter(cb => cb.state === 'OPEN').length;
    score -= openBreakers * 20;

    if (score >= 80) return 'HEALTHY';
    if (score >= 50) return 'WARNING';
    return 'CRITICAL';
  }

  // ===== UTILITY METHODS =====

  private startMetricsCollection() {
    // Clean up old metrics every 5 minutes
    this.metricsInterval = setInterval(() => {
      const cutoff = Date.now() - 3600000; // 1 hour ago
      this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
    }, 300000); // 5 minutes
  }

  private startAlertChecking() {
    // This is handled by the @Cron decorator
    this.alertCheckInterval = setInterval(() => {}, 30000); // Dummy interval for cleanup
  }

  // Public methods for external access
  getMetrics() {
    return this.getRealtimeMetrics();
  }

  getCircuitBreakers() {
    return this.getCircuitBreakerStates();
  }

  getAlerts() {
    return this.alertRules;
  }
}
