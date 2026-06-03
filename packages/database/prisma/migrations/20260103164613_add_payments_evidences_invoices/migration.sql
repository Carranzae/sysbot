-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'REVIEWED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('YAPE', 'PLIN', 'TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentReceiptStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "specialist" TEXT,
ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "businessLogoFileId" TEXT,
ADD COLUMN     "businessRUC" TEXT,
ADD COLUMN     "invoicePrefix" TEXT DEFAULT 'B001-',
ADD COLUMN     "lastInvoiceNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentEmail" TEXT,
ADD COLUMN     "paymentEmailPassword" TEXT,
ADD COLUMN     "paymentEmailProvider" TEXT;

-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "evidenceType" "EvidenceType" NOT NULL,
    "description" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerDestination" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "expectedAmount" DECIMAL(10,2),
    "securityCode" TEXT,
    "paymentMethod" "PaymentMethod",
    "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "ocrData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "receiptFileId" TEXT NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "paymentReceiptId" TEXT NOT NULL,
    "invoiceFileId" TEXT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidences_businessId_status_idx" ON "evidences"("businessId", "status");

-- CreateIndex
CREATE INDEX "evidences_businessId_createdAt_idx" ON "evidences"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_receipts_businessId_status_idx" ON "payment_receipts"("businessId", "status");

-- CreateIndex
CREATE INDEX "payment_receipts_businessId_createdAt_idx" ON "payment_receipts"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_receipts_customerPhone_idx" ON "payment_receipts"("customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_businessId_createdAt_idx" ON "invoices"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "appointments_businessId_specialty_idx" ON "appointments"("businessId", "specialty");

-- CreateIndex
CREATE INDEX "appointments_businessId_specialist_idx" ON "appointments"("businessId", "specialist");

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentReceiptId_fkey" FOREIGN KEY ("paymentReceiptId") REFERENCES "payment_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoiceFileId_fkey" FOREIGN KEY ("invoiceFileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
