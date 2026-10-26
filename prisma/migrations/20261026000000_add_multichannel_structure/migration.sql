-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "marketLabel" TEXT;

-- CreateTable
CREATE TABLE "BrandGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAccount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "externalUserId" TEXT,
    "handle" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "settings" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "body" TEXT,
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "externalUrl" TEXT,
    "platformData" TEXT NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "replies" INTEGER,
    "reposts" INTEGER,
    "clicks" INTEGER,
    "metricsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandGroup_slug_key" ON "BrandGroup"("slug");

-- CreateIndex
CREATE INDEX "ChannelAccount_brandId_enabled_idx" ON "ChannelAccount"("brandId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAccount_brandId_platform_externalUserId_key" ON "ChannelAccount"("brandId", "platform", "externalUserId");

-- CreateIndex
CREATE INDEX "Publication_postId_idx" ON "Publication"("postId");

-- CreateIndex
CREATE INDEX "Publication_channelAccountId_status_scheduledAt_idx" ON "Publication"("channelAccountId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_postId_channelAccountId_key" ON "Publication"("postId", "channelAccountId");

-- CreateIndex
CREATE INDEX "Brand_groupId_idx" ON "Brand"("groupId");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BrandGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandGroup" ADD CONSTRAINT "BrandGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAccount" ADD CONSTRAINT "ChannelAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

