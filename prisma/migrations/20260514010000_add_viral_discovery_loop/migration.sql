ALTER TABLE "Brand" ADD COLUMN "viralMemory" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE "ViralExample" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "authorUsername" TEXT,
  "permalink" TEXT,
  "content" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "views" INTEGER,
  "likes" INTEGER,
  "replies" INTEGER,
  "reposts" INTEGER,
  "quotes" INTEGER,
  "shares" INTEGER,
  "engagementRate" DOUBLE PRECISION,
  "velocityScore" INTEGER,
  "viralScore" INTEGER NOT NULL DEFAULT 0,
  "hookType" TEXT,
  "topic" TEXT,
  "targetAudience" TEXT,
  "emotionalDriver" TEXT,
  "structureType" TEXT,
  "ctaType" TEXT,
  "patternSummary" TEXT,
  "keyTakeaway" TEXT,
  "rawMetrics" TEXT NOT NULL DEFAULT '{}',

  CONSTRAINT "ViralExample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ViralPattern" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "dimension" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sourceCount" INTEGER NOT NULL,
  "avgViralScore" INTEGER NOT NULL,
  "confidence" INTEGER NOT NULL,
  "exampleIds" TEXT NOT NULL DEFAULT '[]',
  "recommendation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ViralPattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ViralExample_brandId_source_sourceKey_key" ON "ViralExample"("brandId", "source", "sourceKey");
CREATE INDEX "ViralExample_brandId_viralScore_idx" ON "ViralExample"("brandId", "viralScore");
CREATE INDEX "ViralExample_brandId_discoveredAt_idx" ON "ViralExample"("brandId", "discoveredAt");

CREATE UNIQUE INDEX "ViralPattern_brandId_dimension_value_key" ON "ViralPattern"("brandId", "dimension", "value");
CREATE INDEX "ViralPattern_brandId_avgViralScore_idx" ON "ViralPattern"("brandId", "avgViralScore");

ALTER TABLE "ViralExample"
  ADD CONSTRAINT "ViralExample_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ViralPattern"
  ADD CONSTRAINT "ViralPattern_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
