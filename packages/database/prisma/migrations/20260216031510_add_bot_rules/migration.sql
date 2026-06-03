-- CreateEnum
CREATE TYPE "BotRuleTriggerType" AS ENUM ('EXACT', 'KEYWORDS', 'REGEX');

-- CreateEnum
CREATE TYPE "BotRuleScope" AS ENUM ('CHANNEL', 'ALL');

-- CreateEnum
CREATE TYPE "BotRuleEngine" AS ENUM ('MANUAL', 'RAG');

-- CreateTable
CREATE TABLE "bot_rules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "BotRuleTriggerType" NOT NULL DEFAULT 'KEYWORDS',
    "triggerValue" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseText" TEXT,
    "responseMedia" JSONB,
    "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" "BotRuleScope" NOT NULL DEFAULT 'CHANNEL',
    "engine" "BotRuleEngine" NOT NULL DEFAULT 'MANUAL',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_rules_businessId_active_priority_idx" ON "bot_rules"("businessId", "active", "priority");

-- AddForeignKey
ALTER TABLE "bot_rules" ADD CONSTRAINT "bot_rules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
