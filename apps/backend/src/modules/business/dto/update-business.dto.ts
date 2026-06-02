import { IsString, IsOptional, IsEmail, MaxLength, IsEnum, IsNotEmpty, IsBoolean } from 'class-validator';

export enum IndustryType {
  RESTAURANT = 'RESTAURANT',
  CLINIC = 'CLINIC',
  REAL_ESTATE = 'REAL_ESTATE',
  ACADEMY = 'ACADEMY',
  RETAIL = 'RETAIL',
  SERVICES = 'SERVICES',
  OTHER = 'OTHER',
}

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(IndustryType)
  industryType?: IndustryType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  whatsappNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
