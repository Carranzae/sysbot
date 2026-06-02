import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class AdminStatsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  metric?: string;
}
