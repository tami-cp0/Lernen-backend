-- Delete existing documents if this is test data (optional)
-- DELETE FROM "documents";

-- Add column as nullable first
ALTER TABLE "documents" ADD COLUMN "s3_key" text;

-- Update existing rows with a placeholder value
UPDATE "documents" SET "s3_key" = 'migration-placeholder/' || "id" WHERE "s3_key" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "documents" ALTER COLUMN "s3_key" SET NOT NULL;