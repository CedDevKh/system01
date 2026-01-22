-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateIndex
CREATE INDEX "Guest_propertyId_email_idx" ON "Guest"("propertyId", "email");

-- CreateIndex
CREATE INDEX "Guest_propertyId_phone_idx" ON "Guest"("propertyId", "phone");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_status_idx" ON "Reservation"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_paymentStatus_idx" ON "Reservation"("propertyId", "paymentStatus");

-- CreateIndex
CREATE INDEX "ReservationStay_propertyId_roomId_startDate_endDate_idx" ON "ReservationStay"("propertyId", "roomId", "startDate", "endDate");
