import { IsOptional, IsIn, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMetricsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(60000) // 1 minute minimum
  @Max(3600000) // 1 hour maximum
  range?: number = 300000; // 5 minutes default
}

export class GetCostsDto {
  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month'])
  range?: 'hour' | 'day' | 'week' | 'month' = 'month';
}

export class SetBudgetDto {
  @IsNumber()
  @Min(0)
  monthlyBudget: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  alertThreshold?: number = 0.8;
}

export class RateLimitRuleDto {
  endpoint: string;
  method: string;
  limit: number;
  windowMs: number;
  userRoles?: string[];
  businessPlans?: string[];
  blockDurationMs?: number;
}

export class AlertRuleDto {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  cooldownMs: number;
  channels: string[];
  recipients?: string[];
}


