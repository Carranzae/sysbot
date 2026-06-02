import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class StartTelegramPersonalDto {
  @IsString()
  @IsNotEmpty()
  apiId!: string

  @IsString()
  @IsNotEmpty()
  apiHash!: string

  @IsString()
  @IsNotEmpty()
  phone!: string
}

export class VerifyTelegramPersonalCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsOptional()
  password?: string
}
