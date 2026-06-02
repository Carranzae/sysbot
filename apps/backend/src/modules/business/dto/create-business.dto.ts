import { IsString, IsNotEmpty, IsEmail, MaxLength, IsEnum, IsOptional } from 'class-validator';

export enum IndustryType {
  RESTAURANT = 'RESTAURANT',
  CLINIC = 'CLINIC',
  REAL_ESTATE = 'REAL_ESTATE',
  ACADEMY = 'ACADEMY',
  RETAIL = 'RETAIL',
  SERVICES = 'SERVICES',
  OTHER = 'OTHER',
}

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(IndustryType)
  @IsNotEmpty()
  industryType: IndustryType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  logoUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  whatsappNumber?: string;
}
