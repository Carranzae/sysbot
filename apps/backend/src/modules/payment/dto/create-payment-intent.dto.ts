import { IsString, IsNotEmpty, IsUUID, IsNumber, IsOptional, IsEnum, MaxLength, IsBoolean } from 'class-validator';

export enum PaymentIntentType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export enum PaymentIntentCurrency {
  USD = 'USD',
  EUR = 'EUR',
  MXN = 'MXN',
  COP = 'COP',
  PEN = 'PEN',
}

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  businessId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customerName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(PaymentIntentType)
  type?: PaymentIntentType;

  @IsOptional()
  @IsEnum(PaymentIntentCurrency)
  currency?: PaymentIntentCurrency;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cancelUrl?: string;

  @IsOptional()
  @IsBoolean()
  automaticConfirmation?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  metadata?: string;
}
