CREATE TABLE "DiscoveredAccount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "profileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "category" TEXT NOT NULL DEFAULT 'unknown',
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'keyword_search',
    "sourceKeyword" TEXT,
    "lastDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveredAccountPost" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "permalink" TEXT,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "hookType" TEXT,
    "topic" TEXT,
    "emotionalDriver" TEXT,
    "structureType" TEXT,
    "ctaType" TEXT,
    "patternSummary" TEXT,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredAccountPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountPattern" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "accountId" TEXT,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoveredAccount_brandId_username_key" ON "DiscoveredAccount"("brandId", "username");
CREATE INDEX "DiscoveredAccount_brandId_status_idx" ON "DiscoveredAccount"("brandId", "status");
CREATE INDEX "DiscoveredAccount_brandId_relevanceScore_idx" ON "DiscoveredAccount"("brandId", "relevanceScore");
CREATE UNIQUE INDEX "DiscoveredAccountPost_accountId_sourceKey_key" ON "DiscoveredAccountPost"("accountId", "sourceKey");
CREATE INDEX "DiscoveredAccountPost_accountId_createdAt_idx" ON "DiscoveredAccountPost"("accountId", "createdAt");
CREATE INDEX "DiscoveredAccountPost_relevanceScore_idx" ON "DiscoveredAccountPost"("relevanceScore");
CREATE INDEX "AccountPattern_brandId_confidence_idx" ON "AccountPattern"("brandId", "confidence");
CREATE INDEX "AccountPattern_brandId_dimension_idx" ON "AccountPattern"("brandId", "dimension");
CREATE INDEX "AccountPattern_accountId_idx" ON "AccountPattern"("accountId");

ALTER TABLE "DiscoveredAccount" ADD CONSTRAINT "DiscoveredAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveredAccountPost" ADD CONSTRAINT "DiscoveredAccountPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DiscoveredAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountPattern" ADD CONSTRAINT "AccountPattern_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountPattern" ADD CONSTRAINT "AccountPattern_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DiscoveredAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
