ALTER TABLE "GitHubInstallation"
  ADD COLUMN "accountUrl" TEXT,
  ADD COLUMN "permissions" JSONB,
  ADD COLUMN "repositorySelection" VARCHAR(32),
  ADD COLUMN "removedAt" TIMESTAMPTZ(6);

CREATE TABLE "GitHubInstallationState" (
  "state" CHAR(64) NOT NULL,
  "userId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GitHubInstallationState_pkey" PRIMARY KEY ("state")
);
CREATE INDEX "GitHubInstallationState_expiresAt_idx" ON "GitHubInstallationState"("expiresAt");
CREATE INDEX "GitHubInstallationState_userId_teamId_idx" ON "GitHubInstallationState"("userId", "teamId");
ALTER TABLE "GitHubInstallationState" ADD CONSTRAINT "GitHubInstallationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubInstallationState" ADD CONSTRAINT "GitHubInstallationState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GitHubWebhookDelivery" (
  "deliveryId" VARCHAR(100) NOT NULL,
  "event" VARCHAR(100) NOT NULL,
  "processedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GitHubWebhookDelivery_pkey" PRIMARY KEY ("deliveryId")
);

ALTER TABLE "Submission"
  ADD COLUMN "sourceCommitSha" VARCHAR(64),
  ADD COLUMN "patchStorageKey" TEXT,
  ADD COLUMN "idempotencyKey" VARCHAR(128),
  ADD COLUMN "idempotencyHash" CHAR(64);
CREATE UNIQUE INDEX "Submission_submittedById_idempotencyKey_key"
  ON "Submission"("submittedById", "idempotencyKey");

CREATE TYPE "OAuthFlowPurpose" AS ENUM ('SIGN_IN', 'LINK_ACCOUNT');
CREATE TABLE "OAuthFlowState" (
  "state" CHAR(64) NOT NULL,
  "purpose" "OAuthFlowPurpose" NOT NULL,
  "userId" UUID,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthFlowState_pkey" PRIMARY KEY ("state")
);
CREATE INDEX "OAuthFlowState_expiresAt_idx" ON "OAuthFlowState"("expiresAt");
CREATE INDEX "OAuthFlowState_userId_purpose_idx" ON "OAuthFlowState"("userId", "purpose");
ALTER TABLE "OAuthFlowState" ADD CONSTRAINT "OAuthFlowState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
