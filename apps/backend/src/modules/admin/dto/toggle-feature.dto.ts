import { IsString, IsNotEmpty, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class ToggleFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  feature: string;

  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessId?: string;
}
