-- CreateEnum
CREATE TYPE "WhatsAppIntegrationType" AS ENUM ('WHATSAPP_API', 'WHATSAPP_WEB');

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiBaseUrl" TEXT,
ADD COLUMN     "aiFallbackProvider" TEXT,
ADD COLUMN     "aiModel" TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN     "aiProvider" TEXT DEFAULT 'OPENAI',
ADD COLUMN     "whatsappApiKey" TEXT,
ADD COLUMN     "whatsappBusinessId" TEXT,
ADD COLUMN     "whatsappMode" "WhatsAppIntegrationType" NOT NULL DEFAULT 'WHATSAPP_API',
ADD COLUMN     "whatsappPhoneNumberId" TEXT,
ADD COLUMN     "whatsappWebInstructions" TEXT,
ADD COLUMN     "whatsappWebNumber" TEXT,
ADD COLUMN     "whatsappWebhookSecret" TEXT;
