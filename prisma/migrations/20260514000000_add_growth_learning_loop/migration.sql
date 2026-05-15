-- Growth Learning Loop: store experiment dimensions and learned performance memory.
ALTER TABLE "Brand" ADD COLUMN "growthMemory" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "Post" ADD COLUMN "topic" TEXT;
ALTER TABLE "Post" ADD COLUMN "targetAudience" TEXT;
ALTER TABLE "Post" ADD COLUMN "situation" TEXT;
ALTER TABLE "Post" ADD COLUMN "hookType" TEXT;
ALTER TABLE "Post" ADD COLUMN "ctaType" TEXT;
ALTER TABLE "Post" ADD COLUMN "qualityScore" INTEGER;
ALTER TABLE "Post" ADD COLUMN "performanceScore" INTEGER;
ALTER TABLE "Post" ADD COLUMN "performanceTier" TEXT;
ALTER TABLE "Post" ADD COLUMN "learnedAt" TIMESTAMP(3);

CREATE INDEX "Post_brandId_metricsAt_idx" ON "Post"("brandId", "metricsAt");
CREATE INDEX "Post_brandId_formulaId_idx" ON "Post"("brandId", "formulaId");
CREATE INDEX "Post_brandId_hookType_idx" ON "Post"("brandId", "hookType");
