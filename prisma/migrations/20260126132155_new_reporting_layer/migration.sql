-- CreateEnum
CREATE TYPE "ChargeLineType" AS ENUM ('ROOM', 'FEE', 'TAX', 'DISCOUNT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReportingPaymentStatus" AS ENUM ('PENDING', 'CAPTURED', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReportingPaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "ChargeLine" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ChargeLineType" NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ReportingPaymentStatus" NOT NULL,
    "method" "ReportingPaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "refundCents" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargeLine_propertyId_date_idx" ON "ChargeLine"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Payment_propertyId_date_idx" ON "Payment"("propertyId", "date");

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
