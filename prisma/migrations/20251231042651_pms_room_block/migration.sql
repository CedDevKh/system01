/*
  Warnings:

  - You are about to drop the column `code` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `floor` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `baseOccupancy` on the `RoomType` table. All the data in the column will be lost.
  - You are about to drop the column `maxOccupancy` on the `RoomType` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[propertyId,name]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'OUT_OF_ORDER');

-- DropIndex
DROP INDEX "Room_propertyId_code_key";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "code",
DROP COLUMN "floor",
DROP COLUMN "label",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "RoomType" DROP COLUMN "baseOccupancy",
DROP COLUMN "maxOccupancy",
ADD COLUMN     "defaultOccupancy" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Block_propertyId_startDate_idx" ON "Block"("propertyId", "startDate");

-- CreateIndex
CREATE INDEX "Block_roomId_startDate_idx" ON "Block"("roomId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_name_key" ON "Room"("propertyId", "name");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
