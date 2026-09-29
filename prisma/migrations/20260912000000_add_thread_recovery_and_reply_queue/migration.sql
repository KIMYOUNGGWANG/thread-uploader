-- Add thread recovery and side mission fields to Post
ALTER TABLE "Post" ADD COLUMN "threadRootId" TEXT,
ADD COLUMN "threadPartsPosted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "threadTotalParts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "threadPartIds" TEXT,
ADD COLUMN "sideMission" TEXT;

-- Create index on Post.status
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- Create ThreadReply table for 20-cap reply and mention queues
CREATE TABLE "ThreadReply" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "postThreadsId" TEXT NOT NULL,
    "replyThreadsId" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "authorText" TEXT NOT NULL,
    "replyText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isMention" BOOLEAN NOT NULL DEFAULT false,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadReply_pkey" PRIMARY KEY ("id")
);

-- Create unique index on replyThreadsId
CREATE UNIQUE INDEX "ThreadReply_replyThreadsId_key" ON "ThreadReply"("replyThreadsId");

-- Create composite index for brand reply drafts query
CREATE INDEX "ThreadReply_brandId_status_idx" ON "ThreadReply"("brandId", "status");

-- Create index for post replies lookup
CREATE INDEX "ThreadReply_postThreadsId_idx" ON "ThreadReply"("postThreadsId");

-- Create index for author mentions lookup
CREATE INDEX "ThreadReply_authorUsername_idx" ON "ThreadReply"("authorUsername");

-- Add foreign key constraint for Brand relation
ALTER TABLE "ThreadReply" ADD CONSTRAINT "ThreadReply_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
