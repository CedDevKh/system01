/*
  Warnings:

  - The `source` column on the `Reservation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `guestName` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Made the column `roomId` on table `ReservationStay` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('MANUAL', 'DIRECT');

-- DropForeignKey
ALTER TABLE "ReservationStay" DROP CONSTRAINT "ReservationStay_roomId_fkey";

-- AlterTable
ALTER TABLE "Folio" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT NOT NULL,
DROP COLUMN "source",
ADD COLUMN     "source" "ReservationSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "ReservationStay" ALTER COLUMN "roomId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Reservation_createdByUserId_idx" ON "Reservation"("createdByUserId");

-- CreateIndex
CREATE INDEX "ReservationStay_propertyId_startDate_idx" ON "ReservationStay"("propertyId", "startDate");

-- CreateIndex
CREATE INDEX "ReservationStay_propertyId_roomId_startDate_idx" ON "ReservationStay"("propertyId", "roomId", "startDate");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStay" ADD CONSTRAINT "ReservationStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
