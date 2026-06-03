-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('WHATSAPP', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "whatsapp_accounts" ADD COLUMN     "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAutoSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastManualSyncAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "source" "ContactSource" NOT NULL DEFAULT 'WHATSAPP',
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "lastIncomingAt" TIMESTAMP(3),
    "lastOutgoingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,
    "whatsappAccountId" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_businessId_phone_idx" ON "contacts"("businessId", "phone");

-- CreateIndex
CREATE INDEX "contact_tags_label_idx" ON "contact_tags"("label");

-- CreateIndex
CREATE INDEX "campaigns_businessId_status_idx" ON "campaigns"("businessId", "status");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_status_idx" ON "campaign_recipients"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "whatsapp_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
