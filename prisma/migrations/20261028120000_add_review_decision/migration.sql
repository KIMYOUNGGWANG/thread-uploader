-- Human review outcome per draft (APPROVED / REJECTED), kept after the Post is deleted
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "formulaId" TEXT,
    "topic" TEXT,
    "hookType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewDecision_brandId_createdAt_idx" ON "ReviewDecision"("brandId", "createdAt");

CREATE INDEX "ReviewDecision_brandId_formulaId_decision_idx" ON "ReviewDecision"("brandId", "formulaId", "decision");

ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
