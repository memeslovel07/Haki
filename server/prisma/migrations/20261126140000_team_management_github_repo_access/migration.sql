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

CREATE TABLE "GitHubOAuthCredential" (
  "userId" UUID NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "GitHubOAuthCredential_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "GitHubOAuthCredential" ADD CONSTRAINT "GitHubOAuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
