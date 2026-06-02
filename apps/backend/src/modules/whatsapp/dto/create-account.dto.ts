import { IsString, IsOptional } from 'class-validator';

export class CreateWhatsappAccountDto {
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
