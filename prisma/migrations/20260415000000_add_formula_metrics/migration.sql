-- AlterTable: Post에 formula 태그 + 성과 메트릭 컬럼 추가
ALTER TABLE "Post" ADD COLUMN "formulaId" TEXT;
ALTER TABLE "Post" ADD COLUMN "views"     INTEGER;
ALTER TABLE "Post" ADD COLUMN "likes"     INTEGER;
ALTER TABLE "Post" ADD COLUMN "replies"   INTEGER;
ALTER TABLE "Post" ADD COLUMN "reposts"   INTEGER;
ALTER TABLE "Post" ADD COLUMN "metricsAt" TIMESTAMP(3);

-- AlterTable: Settings에 공식 가중치 JSON 컬럼 추가
ALTER TABLE "Settings" ADD COLUMN "formulaWeights" TEXT NOT NULL DEFAULT '{}';
