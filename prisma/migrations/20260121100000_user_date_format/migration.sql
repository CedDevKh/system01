-- Add user-level date format preference (display only)
ALTER TABLE "User" ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'ISO';
