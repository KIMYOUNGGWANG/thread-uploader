-- Production got five Post columns outside migrations, with looser NULL/DEFAULT settings than schema.prisma
-- (algorithmicPass even defaulted to false, so posts saved without a score read as failed in PostCard).
-- 20261116000100 adds these columns with ADD COLUMN IF NOT EXISTS, which skips existing ones, so this aligns them.
-- A no-op on a database built from migrations: the columns already match there.
-- SET NOT NULL fails, and this migration rolls back whole, if any row is NULL; production had none (2026-11-20).
-- Fail fast instead of queueing behind the publish cron; rerun the deploy later.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "Post" ALTER COLUMN "postCategory" SET NOT NULL,
ALTER COLUMN "algorithmicPass" DROP DEFAULT,
ALTER COLUMN "algorithmicDimensions" SET NOT NULL,
ALTER COLUMN "algorithmicDimensions" SET DEFAULT '{}',
ALTER COLUMN "algorithmicFixes" SET NOT NULL,
ALTER COLUMN "algorithmicFixes" SET DEFAULT '[]',
ALTER COLUMN "rewriteCount" SET NOT NULL,
ALTER COLUMN "rewriteCount" SET DEFAULT 0;
