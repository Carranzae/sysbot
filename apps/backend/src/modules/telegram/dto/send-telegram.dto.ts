import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class SendTelegramMessageDto {
  @IsString()
  @IsOptional()
  businessId?: string

  @IsString()
  @IsNotEmpty()
  chatId!: string

  @IsString()
  @IsNotEmpty()
  text!: string
}
