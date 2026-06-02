import { IsString, IsNotEmpty, IsOptional, MaxLength, IsArray } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  messageType?: string;

  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;
}
