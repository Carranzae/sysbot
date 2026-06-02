import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsArray,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';

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
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IndustryType)
  industryType: IndustryType;

  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @IsString()
  @IsOptional()
  phone?: string;

  @ValidateIf((obj) => obj.email !== undefined && obj.email !== '')
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  website?: string;
}

export class UpdateBusinessDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IndustryType)
  @IsOptional()
  industryType?: IndustryType;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categories?: string[];

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
