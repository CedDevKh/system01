-- Add composite indexes to improve report query performance

CREATE INDEX IF NOT EXISTS "FolioLine_propertyId_date_type_idx"
ON "FolioLine" ("propertyId", "date", "type");

CREATE INDEX IF NOT EXISTS "FolioLine_propertyId_date_chargeType_idx"
ON "FolioLine" ("propertyId", "date", "chargeType");
