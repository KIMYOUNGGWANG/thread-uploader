-- AlterTable
ALTER TABLE "VideoDraft" ADD COLUMN     "autoPublishAt" TIMESTAMP(3),
ADD COLUMN     "canceledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChannelUpload" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "videoDraftId" TEXT,
    "postId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "caption" TEXT NOT NULL DEFAULT '',
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "externalId" TEXT,
    "externalUrl" TEXT,
    "platformData" TEXT NOT NULL DEFAULT '{}',
    "errorLog" TEXT,
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "metricsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelUpload_status_scheduledAt_idx" ON "ChannelUpload"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ChannelUpload_brandId_createdAt_idx" ON "ChannelUpload"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "ChannelUpload_videoDraftId_idx" ON "ChannelUpload"("videoDraftId");

-- CreateIndex
CREATE INDEX "ChannelUpload_postId_idx" ON "ChannelUpload"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelUpload_channelAccountId_sourceKey_key" ON "ChannelUpload"("channelAccountId", "sourceKey");

-- CreateIndex
CREATE INDEX "VideoDraft_status_autoPublishAt_idx" ON "VideoDraft"("status", "autoPublishAt");

-- AddForeignKey
ALTER TABLE "ChannelUpload" ADD CONSTRAINT "ChannelUpload_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelUpload" ADD CONSTRAINT "ChannelUpload_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelUpload" ADD CONSTRAINT "ChannelUpload_videoDraftId_fkey" FOREIGN KEY ("videoDraftId") REFERENCES "VideoDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelUpload" ADD CONSTRAINT "ChannelUpload_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

