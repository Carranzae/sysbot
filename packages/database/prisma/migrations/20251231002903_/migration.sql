/*
  Warnings:

  - Made the column `whatsappApiEnabled` on table `bot_configs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `whatsappWebEnabled` on table `bot_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "reviewerDestination" TEXT,
ADD COLUMN     "whatsappWebQr" TEXT,
ADD COLUMN     "whatsappWebSession" TEXT,
ADD COLUMN     "whatsappWebStatus" TEXT,
ALTER COLUMN "whatsappApiEnabled" SET NOT NULL,
ALTER COLUMN "whatsappWebEnabled" SET NOT NULL;
