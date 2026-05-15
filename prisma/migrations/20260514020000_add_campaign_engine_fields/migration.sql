-- Add campaign experiment metadata for the CosmicPath career wedge engine.
ALTER TABLE "Post"
ADD COLUMN "qualityProfile" TEXT,
ADD COLUMN "qualityPass" BOOLEAN,
ADD COLUMN "qualityReasons" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "campaignFormulaId" TEXT,
ADD COLUMN "careerDecisionType" TEXT,
ADD COLUMN "linkUrl" TEXT,
ADD COLUMN "utmContent" TEXT,
ADD COLUMN "clicks" INTEGER,
ADD COLUMN "conversions" INTEGER,
ADD COLUMN "manualPaidConversions" INTEGER;

CREATE INDEX "Post_brandId_campaignId_idx" ON "Post"("brandId", "campaignId");
CREATE INDEX "Post_brandId_scheduledAt_idx" ON "Post"("brandId", "scheduledAt");
