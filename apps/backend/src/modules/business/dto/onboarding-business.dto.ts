import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  IsArray,
  Matches,
  Length,
  MaxLength,
} from 'class-validator';
import { IndustryType } from './business.dto';

export class OnboardingBusinessDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;

  @IsEnum(IndustryType)
  industryType: IndustryType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9\s-]{7,20}$/)
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  businessRUC?: string;

  @IsOptional()
  businessHours?: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  services?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialties?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  staff?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paymentMethods?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  paymentQrNotes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1500)
  availabilityNotes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1500)
  catalogNotes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1500)
  policies?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  welcomeMessage?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  fallbackMessage?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  customPrompt?: string;
}













