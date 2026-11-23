-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "commitSha" VARCHAR(64) NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "reportStorageKey" TEXT,
    "errorCode" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationFinding" (
    "id" UUID NOT NULL,
    "validationRunId" UUID NOT NULL,
    "tool" VARCHAR(50) NOT NULL,
    "ruleId" VARCHAR(255),
    "severity" "FindingSeverity" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "filePath" TEXT,
    "line" INTEGER,
    "fingerprint" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidationRun_submissionId_createdAt_idx" ON "ValidationRun"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_status_createdAt_idx" ON "ValidationRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_commitSha_idx" ON "ValidationRun"("commitSha");

-- CreateIndex
CREATE INDEX "ValidationFinding_validationRunId_severity_idx" ON "ValidationFinding"("validationRunId", "severity");

-- CreateIndex
CREATE INDEX "ValidationFinding_fingerprint_idx" ON "ValidationFinding"("fingerprint");

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
