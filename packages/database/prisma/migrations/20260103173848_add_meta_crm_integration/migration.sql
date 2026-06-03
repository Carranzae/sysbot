-- CreateEnum
CREATE TYPE "CRMProvider" AS ENUM ('META_CRM', 'HUBSPOT', 'SALESFORCE', 'ZOHO', 'PIPEDRIVE', 'MONDAY', 'CUSTOM', 'NONE');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "platform" TEXT,
ADD COLUMN     "platformMessageId" TEXT,
ADD COLUMN     "platformSenderId" TEXT;

-- CreateTable
CREATE TABLE "meta_platform_connections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "messengerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "messengerPageId" TEXT,
    "messengerAccessToken" TEXT,
    "messengerVerifyToken" TEXT,
    "instagramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "instagramAccountId" TEXT,
    "instagramAccessToken" TEXT,
    "messengerConnected" BOOLEAN NOT NULL DEFAULT false,
    "instagramConnected" BOOLEAN NOT NULL DEFAULT false,
    "webhookUrl" TEXT,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_connections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "CRMProvider" NOT NULL DEFAULT 'NONE',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "baseUrl" TEXT,
    "config" JSONB,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncDirection" TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
    "lastSyncAt" TIMESTAMP(3),
    "syncInterval" INTEGER NOT NULL DEFAULT 5,
    "accountId" TEXT,
    "accountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_label_mappings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "crmConnectionId" TEXT NOT NULL,
    "systemLabel" TEXT NOT NULL,
    "crmLabel" TEXT NOT NULL,
    "crmLabelId" TEXT,
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_label_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sync_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "crmConnectionId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "crmEntityId" TEXT,
    "errorMessage" TEXT,
    "syncedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_platforms" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "phone" TEXT,
    "messengerId" TEXT,
    "instagramId" TEXT,
    "whatsappId" TEXT,
    "unifiedName" TEXT,
    "unifiedEmail" TEXT,
    "unifiedPhone" TEXT,
    "contactId" TEXT,
    "preferredPlatform" TEXT,
    "lastActivePlatform" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_platform_connections_businessId_key" ON "meta_platform_connections"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_connections_businessId_key" ON "crm_connections"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_label_mappings_businessId_crmConnectionId_systemLabel_key" ON "crm_label_mappings"("businessId", "crmConnectionId", "systemLabel");

-- CreateIndex
CREATE INDEX "crm_sync_logs_businessId_crmConnectionId_idx" ON "crm_sync_logs"("businessId", "crmConnectionId");

-- CreateIndex
CREATE INDEX "crm_sync_logs_businessId_syncType_idx" ON "crm_sync_logs"("businessId", "syncType");

-- CreateIndex
CREATE INDEX "customer_platforms_businessId_unifiedPhone_idx" ON "customer_platforms"("businessId", "unifiedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_platforms_businessId_phone_key" ON "customer_platforms"("businessId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_platforms_businessId_messengerId_key" ON "customer_platforms"("businessId", "messengerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_platforms_businessId_instagramId_key" ON "customer_platforms"("businessId", "instagramId");

-- CreateIndex
CREATE INDEX "messages_businessId_platform_idx" ON "messages"("businessId", "platform");

-- AddForeignKey
ALTER TABLE "meta_platform_connections" ADD CONSTRAINT "meta_platform_connections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_label_mappings" ADD CONSTRAINT "crm_label_mappings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_label_mappings" ADD CONSTRAINT "crm_label_mappings_crmConnectionId_fkey" FOREIGN KEY ("crmConnectionId") REFERENCES "crm_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sync_logs" ADD CONSTRAINT "crm_sync_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sync_logs" ADD CONSTRAINT "crm_sync_logs_crmConnectionId_fkey" FOREIGN KEY ("crmConnectionId") REFERENCES "crm_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_platforms" ADD CONSTRAINT "customer_platforms_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_platforms" ADD CONSTRAINT "customer_platforms_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
