-- AlterTable
ALTER TABLE "CvDocument" ADD COLUMN     "purgeScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CvDocument_purgeScheduledAt_idx" ON "CvDocument"("purgeScheduledAt");
