-- Add Instagram connection fields to Brand
ALTER TABLE "Brand" ADD COLUMN "instagramAccessToken" TEXT,
ADD COLUMN "instagramUserId" TEXT,
ADD COLUMN "instagramUsername" TEXT,
ADD COLUMN "instagramTokenExpiry" TIMESTAMP(3),
ADD COLUMN "instagramConnectedAt" TIMESTAMP(3);

-- Add Instagram reels cross-posting fields to Post
ALTER TABLE "Post" ADD COLUMN "instagramStatus" TEXT,
ADD COLUMN "instagramContainerId" TEXT,
ADD COLUMN "instagramMediaId" TEXT,
ADD COLUMN "instagramPublishedAt" TIMESTAMP(3),
ADD COLUMN "instagramAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "instagramError" TEXT;

-- Create index for Instagram cross-post queue lookups
CREATE INDEX "Post_brandId_instagramStatus_idx" ON "Post"("brandId", "instagramStatus");
