-- Brings a database built from these migrations in line with schema.prisma.
-- ConversionEvent and six Post columns were only ever in the schema (32980d9 changed the schema without a
-- migration), so a fresh `migrate deploy` produced a database every Post query failed on (P2022).
-- Production was synced outside migrations, so every statement is a no-op when its object already exists.
-- Fail fast instead of queueing behind the publish cron; rerun the deploy later.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConversionEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "postId" TEXT,
    "eventType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sessionId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversionEvent_idempotencyKey_key" ON "ConversionEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ConversionEvent_postId_eventType_idx" ON "ConversionEvent"("postId", "eventType");
CREATE INDEX IF NOT EXISTS "ConversionEvent_brandId_createdAt_idx" ON "ConversionEvent"("brandId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ThreadReply: the schema replaced these single-column indexes with brand-scoped ones (1730aea).
DROP INDEX IF EXISTS "ThreadReply_authorUsername_idx";
DROP INDEX IF EXISTS "ThreadReply_postThreadsId_idx";
CREATE INDEX IF NOT EXISTS "ThreadReply_brandId_postThreadsId_idx" ON "ThreadReply"("brandId", "postThreadsId");
CREATE INDEX IF NOT EXISTS "ThreadReply_brandId_createdAt_idx" ON "ThreadReply"("brandId", "createdAt");

-- Post last, so its exclusive lock is held only until this transaction commits.
ALTER TABLE "Post"
    ADD COLUMN IF NOT EXISTS "postCategory" TEXT NOT NULL DEFAULT 'GROWTH',
    ADD COLUMN IF NOT EXISTS "algorithmicScore" INTEGER,
    ADD COLUMN IF NOT EXISTS "algorithmicPass" BOOLEAN,
    ADD COLUMN IF NOT EXISTS "algorithmicDimensions" TEXT NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "algorithmicFixes" TEXT NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "rewriteCount" INTEGER NOT NULL DEFAULT 0;

-- The app already reads a NULL threadPartIds as "[]", so this backfill does not change behaviour.
UPDATE "Post" SET "threadPartIds" = '[]' WHERE "threadPartIds" IS NULL;
ALTER TABLE "Post" ALTER COLUMN "threadPartIds" SET DEFAULT '[]';
ALTER TABLE "Post" ALTER COLUMN "threadPartIds" SET NOT NULL;

DROP INDEX IF EXISTS "Post_status_idx";
CREATE INDEX IF NOT EXISTS "Post_brandId_status_idx" ON "Post"("brandId", "status");
CREATE INDEX IF NOT EXISTS "Post_brandId_postCategory_status_idx" ON "Post"("brandId", "postCategory", "status");
