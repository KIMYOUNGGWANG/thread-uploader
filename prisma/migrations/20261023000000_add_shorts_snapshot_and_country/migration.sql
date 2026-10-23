-- AlterTable
ALTER TABLE "ViralExample" ADD COLUMN     "country" TEXT;

-- CreateTable
CREATE TABLE "ViralExampleSnapshot" (
    "id" TEXT NOT NULL,
    "exampleId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL,
    "likes" INTEGER,
    "comments" INTEGER,

    CONSTRAINT "ViralExampleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ViralExampleSnapshot_exampleId_capturedAt_idx" ON "ViralExampleSnapshot"("exampleId", "capturedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ViralExampleSnapshot_exampleId_capturedAt_key" ON "ViralExampleSnapshot"("exampleId", "capturedAt");

-- CreateIndex
CREATE INDEX "ViralExample_brandId_source_publishedAt_idx" ON "ViralExample"("brandId", "source", "publishedAt");

-- AddForeignKey
ALTER TABLE "ViralExampleSnapshot" ADD CONSTRAINT "ViralExampleSnapshot_exampleId_fkey" FOREIGN KEY ("exampleId") REFERENCES "ViralExample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

