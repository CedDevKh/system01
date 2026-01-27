-- Backfill the new reporting-friendly day bucket columns from postedAt
-- (postedAt is a TIMESTAMP(3) without timezone; application writes UTC timestamps).
UPDATE "FolioLine"
SET
	"date" = ("postedAt")::date,
	"dateKey" = to_char(("postedAt")::date, 'YYYY-MM-DD');

-- Keep the default in sync with the Prisma schema
ALTER TABLE "FolioLine" ALTER COLUMN "dateKey" SET DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD');
