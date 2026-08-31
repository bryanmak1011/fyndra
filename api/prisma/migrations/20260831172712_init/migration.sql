-- CreateEnum
CREATE TYPE "Market" AS ENUM ('HK', 'TW');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('zh_Hant', 'en', 'mixed');

-- CreateEnum
CREATE TYPE "SubmissionMode" AS ENUM ('review_before_sending', 'auto_submit');

-- CreateEnum
CREATE TYPE "ApplyRoute" AS ENUM ('direct_submit_allowlisted', 'handoff');

-- CreateEnum
CREATE TYPE "CvFileFormat" AS ENUM ('pdf', 'docx');

-- CreateEnum
CREATE TYPE "CvParseStatus" AS ENUM ('parsing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "SwipeDirection" AS ENUM ('left', 'right');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('queued', 'awaiting_review', 'pending_needs_answer', 'handed_off', 'needs_attention', 'applied', 'responded', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "AnswerSource" AS ENUM ('profile', 'cv', 'reused_answer', 'generated');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('apns', 'fcm');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "yoe" INTEGER,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submissionMode" "SubmissionMode" NOT NULL DEFAULT 'review_before_sending',
    "markets" "Market"[] DEFAULT ARRAY[]::"Market"[],
    "preferredLanguage" "Language" NOT NULL DEFAULT 'en',
    "dailySubmissionCap" INTEGER NOT NULL DEFAULT 10,
    "perEmployerCap" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthCode" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileFormat" "CvFileFormat" NOT NULL,
    "storageRef" TEXT NOT NULL,
    "detectedLanguage" "Language",
    "rawExtractedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawExtractedYoe" INTEGER,
    "parseStatus" "CvParseStatus" NOT NULL DEFAULT 'parsing',
    "languageSegmenter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "employerApplyUrl" TEXT,
    "externalRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "requirementsSummary" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "market" "Market" NOT NULL,
    "applyRoute" "ApplyRoute" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "livenessCheckedAt" TIMESTAMP(3),

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "rankedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobInteraction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobInteractionId" TEXT NOT NULL,
    "submissionMode" "SubmissionMode" NOT NULL,
    "applyRoute" "ApplyRoute" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'queued',
    "failureReason" TEXT,
    "lastAttemptRef" TEXT,
    "employerApplyUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationQuestion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionFingerprint" TEXT NOT NULL,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" "AnswerSource" NOT NULL,
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProposedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "AuthCode_profileId_idx" ON "AuthCode"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_profileId_idx" ON "AuthToken"("profileId");

-- CreateIndex
CREATE INDEX "CvDocument_profileId_createdAt_idx" ON "CvDocument"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "JobPosting_employerApplyUrl_idx" ON "JobPosting"("employerApplyUrl");

-- CreateIndex
CREATE INDEX "JobPosting_market_language_idx" ON "JobPosting"("market", "language");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_sourceProvider_externalRef_key" ON "JobPosting"("sourceProvider", "externalRef");

-- CreateIndex
CREATE INDEX "FeedEntry_profileId_matchScore_idx" ON "FeedEntry"("profileId", "matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "FeedEntry_profileId_jobPostingId_key" ON "FeedEntry"("profileId", "jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "JobInteraction_profileId_jobPostingId_key" ON "JobInteraction"("profileId", "jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobInteractionId_key" ON "Application"("jobInteractionId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "ApplicationStatusEvent_applicationId_occurredAt_idx" ON "ApplicationStatusEvent"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApplicationQuestion_profileId_questionFingerprint_isSensiti_idx" ON "ApplicationQuestion"("profileId", "questionFingerprint", "isSensitive");

-- CreateIndex
CREATE INDEX "ProposedAnswer_applicationId_idx" ON "ProposedAnswer"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_profileId_pushToken_key" ON "Device"("profileId", "pushToken");

-- AddForeignKey
ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvDocument" ADD CONSTRAINT "CvDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedEntry" ADD CONSTRAINT "FeedEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedEntry" ADD CONSTRAINT "FeedEntry_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInteraction" ADD CONSTRAINT "JobInteraction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInteraction" ADD CONSTRAINT "JobInteraction_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobInteractionId_fkey" FOREIGN KEY ("jobInteractionId") REFERENCES "JobInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedAnswer" ADD CONSTRAINT "ProposedAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
