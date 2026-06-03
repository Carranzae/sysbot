-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
