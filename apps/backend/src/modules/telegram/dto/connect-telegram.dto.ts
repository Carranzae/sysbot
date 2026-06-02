import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class ConnectTelegramDto {
  @IsString()
  @IsOptional()
  businessId?: string

  @IsString()
  @IsNotEmpty()
  botToken!: string

  /**
   * Optional custom webhook URL (use {businessId} placeholder if needed)
   */
  @IsString()
  @IsOptional()
  webhookUrl?: string
}
