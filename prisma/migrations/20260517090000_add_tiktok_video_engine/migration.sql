-- Store TikTok short-form experiment drafts and manual performance metrics.

CREATE TABLE "TikTokVideoDraft" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "spokenHook" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "sceneBeats" TEXT NOT NULL DEFAULT '[]',
    "captionOverlays" TEXT NOT NULL DEFAULT '[]',
    "onScreenText" TEXT NOT NULL DEFAULT '[]',
    "hashtags" TEXT NOT NULL DEFAULT '[]',
    "cta" TEXT NOT NULL,
    "landingUrl" TEXT,
    "utmContent" TEXT,
    "qualityProfile" TEXT NOT NULL DEFAULT 'tiktok_career_timing',
    "qualityPass" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "qualityReasons" TEXT NOT NULL DEFAULT '[]',
    "durationSeconds" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokVideoDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TikTokVideoMetric" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "landingClicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "performanceScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokVideoMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TikTokVideoDraft_brandId_campaignId_idx" ON "TikTokVideoDraft"("brandId", "campaignId");
CREATE INDEX "TikTokVideoDraft_brandId_status_idx" ON "TikTokVideoDraft"("brandId", "status");
CREATE INDEX "TikTokVideoDraft_brandId_createdAt_idx" ON "TikTokVideoDraft"("brandId", "createdAt");
CREATE INDEX "TikTokVideoMetric_draftId_measuredAt_idx" ON "TikTokVideoMetric"("draftId", "measuredAt");

ALTER TABLE "TikTokVideoDraft" ADD CONSTRAINT "TikTokVideoDraft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TikTokVideoMetric" ADD CONSTRAINT "TikTokVideoMetric_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TikTokVideoDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
