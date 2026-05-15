ALTER TABLE "Post" ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Post"
SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL
  AND "status" = 'PUBLISHED'
  AND "threadsId" IS NOT NULL;

CREATE INDEX "Post_brandId_publishedAt_idx" ON "Post"("brandId", "publishedAt");
