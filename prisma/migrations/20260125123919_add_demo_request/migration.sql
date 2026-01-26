-- CreateTable
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT,
    "phone" TEXT,
    "jobRole" TEXT,
    "propertyName" TEXT NOT NULL,
    "propertyType" TEXT,
    "roomsCount" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);
