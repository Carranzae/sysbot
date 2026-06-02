import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType, PlanInterval } from '../entities/plan.entity';

export class CreateSubscriptionDto {
  @ApiProperty({
    enum: PlanType,
    description: 'Tipo de plan a suscribir',
    example: PlanType.PROFESSIONAL,
  })
  @IsEnum(PlanType)
  planType: PlanType;

  @ApiProperty({
    enum: PlanInterval,
    description: 'Intervalo de facturación',
    example: PlanInterval.MONTHLY,
  })
  @IsEnum(PlanInterval)
  interval: PlanInterval;

  @ApiPropertyOptional({
    description: 'Días de prueba gratuita (solo para planes pagos)',
    minimum: 0,
    maximum: 30,
    example: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  trialDays?: number;
}
