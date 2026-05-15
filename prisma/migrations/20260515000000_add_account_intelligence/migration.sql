-- Store account-level intelligence snapshots for 2-hour campaign operations.
CREATE TABLE "AccountInsight" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'cron',
  "summary" TEXT NOT NULL,
  "actions" TEXT NOT NULL DEFAULT '[]',
  "metrics" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountInsight_brandId_generatedAt_idx" ON "AccountInsight"("brandId", "generatedAt");

ALTER TABLE "AccountInsight"
ADD CONSTRAINT "AccountInsight_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
