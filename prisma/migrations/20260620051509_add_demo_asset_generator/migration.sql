/*
  Warnings:

  - Made the column `brandId` on table `Post` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Post_brandId_formulaId_idx";

-- DropIndex
DROP INDEX "Post_brandId_hookType_idx";

-- DropIndex
DROP INDEX "Post_brandId_metricsAt_idx";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "firstComment" TEXT,
ALTER COLUMN "brandId" SET NOT NULL;

-- CreateTable
CREATE TABLE "DemoAssetJob" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "productUrl" TEXT NOT NULL,
    "productContext" TEXT,
    "style" TEXT NOT NULL DEFAULT 'clean-product-demo',
    "videoCount" INTEGER NOT NULL DEFAULT 3,
    "imageCount" INTEGER NOT NULL DEFAULT 6,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoAssetJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoCaptureArtifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "metaData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoCaptureArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoRenderedAsset" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "metaData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRenderedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoAssetJob_brandId_status_idx" ON "DemoAssetJob"("brandId", "status");

-- CreateIndex
CREATE INDEX "DemoAssetJob_brandId_createdAt_idx" ON "DemoAssetJob"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "DemoCaptureArtifact_jobId_idx" ON "DemoCaptureArtifact"("jobId");

-- CreateIndex
CREATE INDEX "DemoRenderedAsset_jobId_idx" ON "DemoRenderedAsset"("jobId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoAssetJob" ADD CONSTRAINT "DemoAssetJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoCaptureArtifact" ADD CONSTRAINT "DemoCaptureArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DemoAssetJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoRenderedAsset" ADD CONSTRAINT "DemoRenderedAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DemoAssetJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
