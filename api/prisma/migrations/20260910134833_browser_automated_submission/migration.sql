-- CreateEnum
CREATE TYPE "SubmissionAttemptOutcome" AS ENUM ('pending_click', 'submitted', 'failed_selector', 'failed_bot_wall', 'failed_captcha', 'failed_session_expired', 'failed_unknown');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'auto_submitted';

-- AlterEnum
ALTER TYPE "ApplyRoute" ADD VALUE 'browser_automated';

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" "SubmissionAttemptOutcome" NOT NULL,
    "screenshotPath" TEXT,
    "finalUrl" TEXT,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionAttempt_applicationId_startedAt_idx" ON "SubmissionAttempt"("applicationId", "startedAt");

-- AddForeignKey
ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
