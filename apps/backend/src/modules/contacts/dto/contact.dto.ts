import { ContactSource } from '@syst/database';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ContactTagDto {
  @IsString()
  @MaxLength(50)
  label: string;
}

export class CreateContactDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(ContactSource)
  @IsOptional()
  source?: ContactSource;

  @IsBoolean()
  @IsOptional()
  autoCreated?: boolean;

  @IsBoolean()
  @IsOptional()
  isAiPaused?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactTagDto)
  @IsOptional()
  tags?: ContactTagDto[];

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(ContactSource)
  @IsOptional()
  source?: ContactSource;

  @IsBoolean()
  @IsOptional()
  autoCreated?: boolean;

  @IsBoolean()
  @IsOptional()
  isAiPaused?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactTagDto)
  @IsOptional()
  tags?: ContactTagDto[];

  @IsOptional()
  metadata?: Record<string, any>;
}
