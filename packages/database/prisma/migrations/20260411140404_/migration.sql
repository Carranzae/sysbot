/*
  Warnings:

  - The `paymentGateway` column on the `businesses` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'IZIPAY', 'MERCADOPAGO', 'PAYPAL', 'YAPE_PLIN', 'MANUAL', 'NONE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_CONFIRMED';

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "existe" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialAllowedEnd" TEXT DEFAULT '22:00',
ADD COLUMN     "socialAllowedStart" TEXT DEFAULT '08:00',
ADD COLUMN     "socialFrequency" TEXT DEFAULT '3_week',
ADD COLUMN     "socialMinSpacing" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "socialNotifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialNotifyPush" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialNotifyWhatsapp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialStagger" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialTimezone" TEXT DEFAULT 'America/Bogota';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "crmProvider" "CRMProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "izipayMerchantId" TEXT,
ADD COLUMN     "paymentConfig" JSONB,
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "webhookSecret" TEXT,
DROP COLUMN "paymentGateway",
ADD COLUMN     "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "meta_oauth_sessions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userAccessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_oauth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automated_payments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "gateway" "PaymentGateway" NOT NULL,
    "gatewayPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentUrl" TEXT,
    "qrCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "automated_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhooks" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "gateway" "PaymentGateway" NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_oauth_sessions_businessId_idx" ON "meta_oauth_sessions"("businessId");

-- CreateIndex
CREATE INDEX "meta_oauth_sessions_expiresAt_idx" ON "meta_oauth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "automated_payments_businessId_status_idx" ON "automated_payments"("businessId", "status");

-- CreateIndex
CREATE INDEX "automated_payments_gatewayPaymentId_idx" ON "automated_payments"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "payment_webhooks_gateway_processed_idx" ON "payment_webhooks"("gateway", "processed");

-- AddForeignKey
ALTER TABLE "meta_oauth_sessions" ADD CONSTRAINT "meta_oauth_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automated_payments" ADD CONSTRAINT "automated_payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhooks" ADD CONSTRAINT "payment_webhooks_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
