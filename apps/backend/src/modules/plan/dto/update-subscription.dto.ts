import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType, PlanInterval } from '../entities/plan.entity';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    enum: PlanType,
    description: 'Nuevo tipo de plan (upgrade/downgrade)',
    example: PlanType.BUSINESS,
  })
  @IsOptional()
  @IsEnum(PlanType)
  planType?: PlanType;

  @ApiPropertyOptional({
    enum: PlanInterval,
    description: 'Nuevo intervalo de facturación',
    example: PlanInterval.YEARLY,
  })
  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval;

  @ApiPropertyOptional({
    description: 'Cancelar al final del período actual',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
