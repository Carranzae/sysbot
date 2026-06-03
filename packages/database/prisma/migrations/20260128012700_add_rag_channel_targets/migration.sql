-- CreateEnum
CREATE TYPE "ConfigScope" AS ENUM ('GLOBAL', 'BUSINESS', 'USER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ragChannelTargets" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "allowAnalytics" BOOLEAN DEFAULT true,
ADD COLUMN     "allowedFeatures" TEXT[] DEFAULT ARRAY['CRM', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM']::TEXT[],
ADD COLUMN     "allowedSocials" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "budgetAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "canSetDestination" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "currency" TEXT DEFAULT 'CLP',
ADD COLUMN     "dataRetentionDays" INTEGER DEFAULT 365,
ADD COLUMN     "emailNotifications" BOOLEAN DEFAULT true,
ADD COLUMN     "language" TEXT DEFAULT 'es',
ADD COLUMN     "monthlyApiBudget" DECIMAL(65,30),
ADD COLUMN     "paymentEmail" TEXT,
ADD COLUMN     "paymentGateway" TEXT,
ADD COLUMN     "paymentWebhookUrl" TEXT,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pushNotifications" BOOLEAN DEFAULT true,
ADD COLUMN     "shareData" BOOLEAN DEFAULT false,
ADD COLUMN     "smsNotifications" BOOLEAN DEFAULT false,
ADD COLUMN     "storageUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "supportPhone" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'America/Santiago',
ADD COLUMN     "totalApiCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalMessagesSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "scope" "ConfigScope" NOT NULL DEFAULT 'GLOBAL',
    "entityId" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "details" JSONB,
    "performedBy" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetRole" "UserRole",
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "mediaUrl" TEXT,
    "mediaType" TEXT,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "endpoint" TEXT,
    "tokensUsed" INTEGER NOT NULL,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_metrics" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "userId" TEXT,
    "businessId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_breakers" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailureTime" TIMESTAMP(3),
    "nextRetryTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuit_breakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMs" INTEGER NOT NULL,
    "lastTriggered" TIMESTAMP(3),
    "channels" TEXT[],
    "recipients" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_rules" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "windowMs" INTEGER NOT NULL,
    "userRoles" TEXT[],
    "businessPlans" TEXT[],
    "blockDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_budgets" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "monthlyBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "alertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "currentMonth" INTEGER NOT NULL,
    "currentSpend" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_configs_key_scope_idx" ON "system_configs"("key", "scope");

-- CreateIndex
CREATE INDEX "system_configs_entityId_idx" ON "system_configs"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_scope_entityId_key" ON "system_configs"("key", "scope", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_performedBy_idx" ON "audit_logs"("performedBy");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "api_usage_businessId_idx" ON "api_usage"("businessId");

-- CreateIndex
CREATE INDEX "api_usage_provider_idx" ON "api_usage"("provider");

-- CreateIndex
CREATE INDEX "api_usage_timestamp_idx" ON "api_usage"("timestamp");

-- CreateIndex
CREATE INDEX "system_alerts_type_idx" ON "system_alerts"("type");

-- CreateIndex
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts"("severity");

-- CreateIndex
CREATE INDEX "system_alerts_resolved_idx" ON "system_alerts"("resolved");

-- CreateIndex
CREATE INDEX "api_metrics_endpoint_idx" ON "api_metrics"("endpoint");

-- CreateIndex
CREATE INDEX "api_metrics_statusCode_idx" ON "api_metrics"("statusCode");

-- CreateIndex
CREATE INDEX "api_metrics_timestamp_idx" ON "api_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "api_metrics_businessId_idx" ON "api_metrics"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_breakers_service_key" ON "circuit_breakers"("service");

-- CreateIndex
CREATE INDEX "circuit_breakers_service_idx" ON "circuit_breakers"("service");

-- CreateIndex
CREATE INDEX "circuit_breakers_state_idx" ON "circuit_breakers"("state");

-- CreateIndex
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules"("enabled");

-- CreateIndex
CREATE INDEX "alert_rules_severity_idx" ON "alert_rules"("severity");

-- CreateIndex
CREATE INDEX "rate_limit_rules_endpoint_idx" ON "rate_limit_rules"("endpoint");

-- CreateIndex
CREATE INDEX "rate_limit_rules_method_idx" ON "rate_limit_rules"("method");

-- CreateIndex
CREATE UNIQUE INDEX "business_budgets_businessId_key" ON "business_budgets"("businessId");

-- CreateIndex
CREATE INDEX "business_budgets_businessId_idx" ON "business_budgets"("businessId");

-- CreateIndex
CREATE INDEX "business_budgets_currentMonth_idx" ON "business_budgets"("currentMonth");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_budgets" ADD CONSTRAINT "business_budgets_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
