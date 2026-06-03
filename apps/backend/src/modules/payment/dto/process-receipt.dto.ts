import { IsString, IsNotEmpty, IsUUID, IsNumber, IsOptional, IsEnum, MaxLength } from 'class-validator';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  OTHER = 'OTHER',
}

export class ProcessReceiptDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  businessId: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

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
  description?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  transactionId?: string;

  @IsString()
  @IsNotEmpty()
  receiptFileId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  currency?: string;
}
