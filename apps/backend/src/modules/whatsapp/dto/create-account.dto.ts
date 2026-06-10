import { IsString, IsOptional } from 'class-validator';

export class CreateWhatsappAccountDto {
  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  whatsappBusinessId?: string;

  @IsString()
  phoneNumberId: string;

  @IsString()
  phoneNumber: string;

  @IsString()
  displayName: string;

  @IsString()
  verifyToken: string;

  @IsString()
  accessToken: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
