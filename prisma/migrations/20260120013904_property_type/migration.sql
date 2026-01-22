-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOTEL', 'GUESTHOUSE', 'RESORT', 'APARTMENT');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "type" "PropertyType" NOT NULL DEFAULT 'HOTEL';
