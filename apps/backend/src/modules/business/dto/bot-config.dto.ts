import { IsArray, IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum WhatsAppIntegrationType {
  WHATSAPP_API = 'WHATSAPP_API',
  WHATSAPP_WEB = 'WHATSAPP_WEB',
}

export class UpdateBotConfigDto {
  @IsString()
  @IsOptional()
  welcomeMessage?: string;

  @IsString()
  @IsOptional()
  fallbackMessage?: string;

  @IsBoolean()
  @IsOptional()
  autoReply?: boolean;

  @IsBoolean()
  @IsOptional()
  audioEnabled?: boolean;

  @IsString()
  @IsOptional()
  customPrompt?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @IsEnum(WhatsAppIntegrationType)
  @IsOptional()
  whatsappMode?: WhatsAppIntegrationType;

  @IsBoolean()
  @IsOptional()
  whatsappApiEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  whatsappWebEnabled?: boolean;

  @IsString()
  @IsOptional()
  whatsappApiKey?: string;

  @IsString()
  @IsOptional()
  whatsappBusinessId?: string;

  @IsString()
  @IsOptional()
  whatsappPhoneNumberId?: string;

  @IsString()
  @IsOptional()
  whatsappWebhookSecret?: string;

  @IsString()
  @IsOptional()
  destinationNumber?: string;

  @IsString()
  @IsOptional()
  whatsappWebNumber?: string;

  @IsString()
  @IsOptional()
  whatsappWebInstructions?: string;

  @IsString()
  @IsOptional()
  whatsappPhoneNumber?: string;

  @IsString()
  @IsOptional()
  whatsappDisplayName?: string;

  @IsString()
  @IsOptional()
  whatsappVerifyToken?: string;

  @IsString()
  @IsOptional()
  whatsappWebhookUrl?: string;

  @IsString()
  @IsOptional()
  aiProvider?: string;

  @IsString()
  @IsOptional()
  aiModel?: string;

  @IsString()
  @IsOptional()
  aiApiKey?: string;

  @IsString()
  @IsOptional()
  aiBaseUrl?: string;

  @IsString()
  @IsOptional()
  aiFallbackProvider?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ragChannelTargets?: string[];

  @IsOptional()
  businessHours?: Record<string, any>;

  @IsString()
  @IsOptional()
  emailSenderName?: string;

  @IsEmail()
  @IsOptional()
  emailSenderAddress?: string;

  @IsString()
  @IsOptional()
  smtpHost?: string;

  @IsNumber()
  @IsOptional()
  smtpPort?: number;

  @IsString()
  @IsOptional()
  smtpUser?: string;

  @IsString()
  @IsOptional()
  smtpPassword?: string;

  @IsNumber()
  @IsOptional()
  emailDailyQuota?: number;

  @IsNumber()
  @IsOptional()
  emailDailyQuotaUsed?: number;

  @IsString()
  @IsOptional()
  gmailClientId?: string;

  @IsString()
  @IsOptional()
  gmailClientSecret?: string;

  @IsString()
  @IsOptional()
  reviewerDestination?: string;

  @IsBoolean()
  @IsOptional()
  respondInGroups?: boolean;

  // Telegram configuration
  @IsBoolean()
  @IsOptional()
  telegramEnabled?: boolean;

  @IsString()
  @IsOptional()
  telegramBotToken?: string;

  @IsString()
  @IsOptional()
  telegramBotUsername?: string;

  @IsString()
  @IsOptional()
  telegramBotId?: string;

  @IsString()
  @IsOptional()
  telegramWebhookSecret?: string;

  @IsString()
  @IsOptional()
  telegramWebhookUrl?: string;

  @IsBoolean()
  @IsOptional()
  telegramConnected?: boolean;

  @IsString()
  @IsOptional()
  telegramStatus?: string;

  @IsEmail()
  @IsOptional()
  paymentEmail?: string;

  @IsString()
  @IsOptional()
  paymentEmailPassword?: string;

  @IsString()
  @IsOptional()
  paymentEmailProvider?: string;

  @IsString()
  @IsOptional()
  businessLogoFileId?: string;

  @IsString()
  @IsOptional()
  businessRUC?: string;

  @IsString()
  @IsOptional()
  businessAddress?: string;

  @IsString()
  @IsOptional()
  invoicePrefix?: string;

  @IsNumber()
  @IsOptional()
  lastInvoiceNumber?: number;

  // Social Media Configuration
  @IsString()
  @IsOptional()
  socialFrequency?: string;

  @IsString()
  @IsOptional()
  socialTimezone?: string;

  @IsString()
  @IsOptional()
  socialAllowedStart?: string;

  @IsString()
  @IsOptional()
  socialAllowedEnd?: string;

  @IsNumber()
  @IsOptional()
  socialMinSpacing?: number;

  @IsBoolean()
  @IsOptional()
  socialStagger?: boolean;

  @IsBoolean()
  @IsOptional()
  socialNotifyEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  socialNotifyWhatsapp?: boolean;

  @IsBoolean()
  @IsOptional()
  socialNotifyPush?: boolean;
}
