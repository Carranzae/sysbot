-- Add boolean fields for dual WhatsApp mode support
ALTER TABLE "bot_configs" ADD COLUMN IF NOT EXISTS "whatsappApiEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN IF NOT EXISTS "whatsappWebEnabled" BOOLEAN DEFAULT false;

-- Update existing records based on whatsappMode
UPDATE "bot_configs" 
SET "whatsappApiEnabled" = true 
WHERE "whatsappMode" = 'WHATSAPP_API';

UPDATE "bot_configs" 
SET "whatsappWebEnabled" = true 
WHERE "whatsappMode" = 'WHATSAPP_WEB';


















