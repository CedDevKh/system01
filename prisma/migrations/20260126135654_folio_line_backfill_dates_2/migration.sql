-- AlterTable
ALTER TABLE "FolioLine" ALTER COLUMN "dateKey" SET DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD');
