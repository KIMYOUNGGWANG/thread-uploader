-- Six tables that older migrations created but schema.prisma no longer models
-- (account discovery engine 20260515020000, demo asset generator 20260620051509).
-- Left in "public", every later `migrate dev` would generate DROP TABLE for them.
-- They are moved, not dropped: rows stay readable in the "archive" schema, and Prisma only
-- manages "public", so the outcome is the same whether or not a database has data in them.
-- Kept apart from the Post changes so these locks end with this migration's transaction.
SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS "archive";

-- Unlink from Brand first: these were ON DELETE CASCADE, so deleting a brand would also delete archived rows.
ALTER TABLE IF EXISTS "AccountPattern" DROP CONSTRAINT IF EXISTS "AccountPattern_brandId_fkey";
ALTER TABLE IF EXISTS "DemoAssetJob" DROP CONSTRAINT IF EXISTS "DemoAssetJob_brandId_fkey";
ALTER TABLE IF EXISTS "DiscoveredAccount" DROP CONSTRAINT IF EXISTS "DiscoveredAccount_brandId_fkey";

-- Indexes and the foreign keys between these tables move with them.
ALTER TABLE IF EXISTS "AccountPattern" SET SCHEMA "archive";
ALTER TABLE IF EXISTS "DiscoveredAccountPost" SET SCHEMA "archive";
ALTER TABLE IF EXISTS "DiscoveredAccount" SET SCHEMA "archive";
ALTER TABLE IF EXISTS "DemoCaptureArtifact" SET SCHEMA "archive";
ALTER TABLE IF EXISTS "DemoRenderedAsset" SET SCHEMA "archive";
ALTER TABLE IF EXISTS "DemoAssetJob" SET SCHEMA "archive";
