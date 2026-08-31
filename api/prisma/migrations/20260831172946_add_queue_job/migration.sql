-- CreateEnum
CREATE TYPE "QueueJobType" AS ENUM ('crawl', 'parse_cv', 'rebuild_match', 'submit');

-- CreateEnum
CREATE TYPE "QueueJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "type" "QueueJobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueJob_status_runAfter_idx" ON "QueueJob"("status", "runAfter");
