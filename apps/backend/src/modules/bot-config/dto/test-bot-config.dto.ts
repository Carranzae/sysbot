import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber } from 'class-validator';

export class TestBotConfigDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fallbackMessage?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  testMessage?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  customPrompt?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  aiProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  aiModel?: string;
}
