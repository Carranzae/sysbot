-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('BOT', 'MANUAL', 'ADMIN');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "origin" "AppointmentOrigin" NOT NULL DEFAULT 'BOT';

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "telegramBotId" TEXT,
ADD COLUMN     "telegramBotToken" TEXT,
ADD COLUMN     "telegramBotUsername" TEXT,
ADD COLUMN     "telegramConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "telegramWebhookSecret" TEXT,
ADD COLUMN     "telegramWebhookUrl" TEXT;

-- CreateTable
CREATE TABLE "telegram_connections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "botToken" TEXT,
    "botUsername" TEXT,
    "botId" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "lastError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_connections_businessId_key" ON "telegram_connections"("businessId");

-- AddForeignKey
ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
