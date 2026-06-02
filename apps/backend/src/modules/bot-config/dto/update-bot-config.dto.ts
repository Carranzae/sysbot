import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsNotEmpty, Min, Max, MaxLength } from 'class-validator';

export class UpdateBotConfigDto {
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
  @IsBoolean()
  autoReply?: boolean;

  @IsOptional()
  @IsObject()
  businessHours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  customPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  aiProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  aiModel?: string;

  @IsOptional()
  @IsBoolean()
  enableRAG?: boolean;

  @IsOptional()
  @IsBoolean()
  enableVoice?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  voiceLanguage?: string;

  @IsOptional()
  @IsBoolean()
  enableAnalytics?: boolean;

  @IsOptional()
  @IsBoolean()
  enableLogging?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  responseDelay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsBoolean()
  upsellingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sentimentAnalysisEnabled?: boolean;
}
