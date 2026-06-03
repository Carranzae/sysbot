-- CreateEnum
CREATE TYPE "TelegramIntegrationMode" AS ENUM ('BOT', 'PERSONAL');

-- CreateEnum
CREATE TYPE "TelegramAuthStatus" AS ENUM ('NOT_CONFIGURED', 'CODE_REQUIRED', 'PENDING_CODE', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "CRMChannelType" AS ENUM ('WHATSAPP_API', 'WHATSAPP_WEB', 'TELEGRAM_BOT', 'TELEGRAM_PERSONAL', 'MESSENGER', 'INSTAGRAM');

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "telegramApiHash" TEXT,
ADD COLUMN     "telegramApiId" TEXT,
ADD COLUMN     "telegramAuthStatus" "TelegramAuthStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN     "telegramLastError" TEXT,
ADD COLUMN     "telegramMode" "TelegramIntegrationMode" NOT NULL DEFAULT 'BOT',
ADD COLUMN     "telegramPendingCode" TEXT,
ADD COLUMN     "telegramPhone" TEXT,
ADD COLUMN     "telegramSessionData" TEXT,
ADD COLUMN     "telegramTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "crm_channel_mappings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "crmConnectionId" TEXT NOT NULL,
    "channelType" "CRMChannelType" NOT NULL,
    "channelKey" TEXT NOT NULL,
    "whatsappAccountId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "syncDirection" TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_channel_mappings_crmConnectionId_channelKey_key" ON "crm_channel_mappings"("crmConnectionId", "channelKey");

-- AddForeignKey
ALTER TABLE "crm_channel_mappings" ADD CONSTRAINT "crm_channel_mappings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_channel_mappings" ADD CONSTRAINT "crm_channel_mappings_crmConnectionId_fkey" FOREIGN KEY ("crmConnectionId") REFERENCES "crm_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_channel_mappings" ADD CONSTRAINT "crm_channel_mappings_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "whatsapp_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
