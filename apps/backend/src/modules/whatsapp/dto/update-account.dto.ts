import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateWhatsappAccountDto {
  @IsBoolean()
  @IsOptional()
  autoSyncEnabled?: boolean;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsUrl({}, { message: 'webhookUrl must be a valid URL' })
  @IsOptional()
  webhookUrl?: string;
}
