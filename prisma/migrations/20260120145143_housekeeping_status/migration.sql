-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('CLEAN', 'DIRTY', 'INSPECT', 'OUT_OF_SERVICE');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "housekeepingStatus" "HousekeepingStatus" NOT NULL DEFAULT 'CLEAN';
