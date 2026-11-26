-- Fail fast instead of queueing behind a long publish-cron transaction on "Brand".
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "sourceText" TEXT NOT NULL,
    "rawMode" BOOLEAN NOT NULL DEFAULT false,
    "operatorNote" TEXT,
    "facts" TEXT NOT NULL DEFAULT '[]',
    "media" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsVariant" (
    "id" TEXT NOT NULL,
    "newsItemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "approvedRevision" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "manualDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsItem_brandId_createdAt_idx" ON "NewsItem"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsItem_brandId_sourceUrl_idx" ON "NewsItem"("brandId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "NewsVariant_newsItemId_platform_key" ON "NewsVariant"("newsItemId", "platform");

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsVariant" ADD CONSTRAINT "NewsVariant_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

