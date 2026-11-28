ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'INVITED';
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

CREATE TABLE "TeamInvitation" (
  "id" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "role" "TeamRole" NOT NULL DEFAULT 'DEVELOPER',
  "invitedById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "respondedAt" TIMESTAMPTZ(6),
  CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeamInvitation_teamId_email_key" ON "TeamInvitation"("teamId", "email");
CREATE INDEX "TeamInvitation_email_expiresAt_idx" ON "TeamInvitation"("email", "expiresAt");
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GitHubInstallation"
  ADD COLUMN "accountUrl" TEXT,
  ADD COLUMN "permissions" JSONB,
  ADD COLUMN "repositorySelection" VARCHAR(32),
  ADD COLUMN "removedAt" TIMESTAMPTZ(6);

CREATE TABLE "GitHubInstallationState" (
  "stateHash" CHAR(64) NOT NULL,
  "userId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GitHubInstallationState_pkey" PRIMARY KEY ("stateHash")
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
