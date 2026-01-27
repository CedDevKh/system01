/*
  Warnings:

  - You are about to drop the `ChargeLine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChargeLine" DROP CONSTRAINT "ChargeLine_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_propertyId_fkey";

-- AlterTable
ALTER TABLE "FolioLine" ADD COLUMN     "chargeType" "ChargeLineType",
ADD COLUMN     "date" DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN     "dateKey" TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD'),
ADD COLUMN     "paymentMethod" "ReportingPaymentMethod",
ADD COLUMN     "paymentStatus" "ReportingPaymentStatus";

-- DropTable
DROP TABLE "ChargeLine";

-- DropTable
DROP TABLE "Payment";

-- CreateIndex
CREATE INDEX "FolioLine_propertyId_date_idx" ON "FolioLine"("propertyId", "date");
