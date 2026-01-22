-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "defaultRatePlanId" TEXT;

-- AlterTable
ALTER TABLE "RatePlan" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RatePlanRoomType" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "nightlyRateCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatePlanRoomType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RatePlanRoomType_propertyId_idx" ON "RatePlanRoomType"("propertyId");

-- CreateIndex
CREATE INDEX "RatePlanRoomType_ratePlanId_idx" ON "RatePlanRoomType"("ratePlanId");

-- CreateIndex
CREATE INDEX "RatePlanRoomType_roomTypeId_idx" ON "RatePlanRoomType"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlanRoomType_ratePlanId_roomTypeId_key" ON "RatePlanRoomType"("ratePlanId", "roomTypeId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_defaultRatePlanId_fkey" FOREIGN KEY ("defaultRatePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlanRoomType" ADD CONSTRAINT "RatePlanRoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlanRoomType" ADD CONSTRAINT "RatePlanRoomType_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlanRoomType" ADD CONSTRAINT "RatePlanRoomType_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
