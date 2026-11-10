-- Fail fast instead of queueing behind a long publish-cron transaction on "Post".
SET lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "cardSlides" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "instagramCaption" TEXT;

-- AlterTable
ALTER TABLE "ChannelUpload" ADD COLUMN     "reach" INTEGER,
ADD COLUMN     "saves" INTEGER;

-- CreateTable
CREATE TABLE "SourceArticle" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "score" INTEGER,
    "formatHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceArticle_brandId_status_score_idx" ON "SourceArticle"("brandId", "status", "score");

-- CreateIndex
CREATE INDEX "SourceArticle_postId_idx" ON "SourceArticle"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceArticle_brandId_urlKey_key" ON "SourceArticle"("brandId", "urlKey");

-- AddForeignKey
ALTER TABLE "SourceArticle" ADD CONSTRAINT "SourceArticle_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

