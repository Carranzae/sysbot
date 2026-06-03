-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "emailDailyQuota" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "emailDailyQuotaUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailQuotaResetAt" TIMESTAMP(3),
ADD COLUMN     "emailSenderAddress" TEXT,
ADD COLUMN     "emailSenderName" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpPort" INTEGER DEFAULT 587,
ADD COLUMN     "smtpUser" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "subject" TEXT;
