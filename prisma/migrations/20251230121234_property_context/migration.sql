/*
  Warnings:

  - Added the required column `propertyId` to the `FolioLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyId` to the `PosOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyId` to the `PosOrderItemModifier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyId` to the `RateRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyId` to the `ReservationStay` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FolioLine" ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PosOrderItem" ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PosOrderItemModifier" ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RateRule" ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ReservationStay" ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activePropertyId" TEXT;

-- CreateIndex
CREATE INDEX "FolioLine_propertyId_postedAt_idx" ON "FolioLine"("propertyId", "postedAt");

-- CreateIndex
CREATE INDEX "MenuModifierItem_propertyId_idx" ON "MenuModifierItem"("propertyId");

-- CreateIndex
CREATE INDEX "PosOrderItem_propertyId_idx" ON "PosOrderItem"("propertyId");

-- CreateIndex
CREATE INDEX "PosOrderItemModifier_propertyId_idx" ON "PosOrderItemModifier"("propertyId");

-- CreateIndex
CREATE INDEX "RateRule_propertyId_idx" ON "RateRule"("propertyId");

-- CreateIndex
CREATE INDEX "ReservationStay_propertyId_idx" ON "ReservationStay"("propertyId");

-- CreateIndex
CREATE INDEX "Session_activePropertyId_idx" ON "Session"("activePropertyId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activePropertyId_fkey" FOREIGN KEY ("activePropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStay" ADD CONSTRAINT "ReservationStay_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuModifierItem" ADD CONSTRAINT "MenuModifierItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderItem" ADD CONSTRAINT "PosOrderItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderItemModifier" ADD CONSTRAINT "PosOrderItemModifier_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
