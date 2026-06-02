import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum PlanType {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
  ULTIMATE = 'ULTIMATE'
}

export class CreateSubscriptionDto {
  @IsEnum(PlanType)
  planType: PlanType;
}

export class UpdateSubscriptionDto {
  @IsEnum(PlanType)
  planType: PlanType;
}

export class CheckFeatureDto {
  @IsString()
  feature: string;
}

export class CheckLimitsDto {
  @IsString()
  resource: string;

  @IsString()
  amount: string;
}
