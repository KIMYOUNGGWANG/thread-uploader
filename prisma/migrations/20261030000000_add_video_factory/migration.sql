-- CreateTable
CREATE TABLE "ClipAsset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "mood" TEXT NOT NULL DEFAULT '[]',
    "durationSec" DOUBLE PRECISION,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoDraft" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "kstDate" TEXT NOT NULL,
    "script" TEXT NOT NULL DEFAULT '{}',
    "captions" TEXT NOT NULL DEFAULT '{}',
    "hashtags" TEXT NOT NULL DEFAULT '[]',
    "voiceMode" TEXT NOT NULL DEFAULT 'bgm_only',
    "clipAssetId" TEXT,
    "renderErrors" TEXT NOT NULL DEFAULT '[]',
    "videoUrl" TEXT,
    "coverUrl" TEXT,
    "userVerdict" TEXT,
    "verdictAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClipAsset_brandId_enabled_lastUsedAt_idx" ON "ClipAsset"("brandId", "enabled", "lastUsedAt");

-- CreateIndex
CREATE INDEX "VideoDraft_brandId_kstDate_idx" ON "VideoDraft"("brandId", "kstDate");

-- CreateIndex
CREATE INDEX "VideoDraft_status_updatedAt_idx" ON "VideoDraft"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "VideoDraft_clipAssetId_idx" ON "VideoDraft"("clipAssetId");

-- AddForeignKey
ALTER TABLE "ClipAsset" ADD CONSTRAINT "ClipAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoDraft" ADD CONSTRAINT "VideoDraft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoDraft" ADD CONSTRAINT "VideoDraft_clipAssetId_fkey" FOREIGN KEY ("clipAssetId") REFERENCES "ClipAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

