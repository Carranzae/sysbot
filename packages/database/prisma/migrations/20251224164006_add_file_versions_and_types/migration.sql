-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO', 'OTHER');

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileType" "FileType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
