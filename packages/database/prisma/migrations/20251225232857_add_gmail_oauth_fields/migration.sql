-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "gmailAccessToken" TEXT,
ADD COLUMN     "gmailClientId" TEXT,
ADD COLUMN     "gmailClientSecret" TEXT,
ADD COLUMN     "gmailRefreshToken" TEXT,
ADD COLUMN     "gmailTokenExpiry" TIMESTAMP(3);
