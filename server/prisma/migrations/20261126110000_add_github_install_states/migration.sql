CREATE TABLE "GitHubInstallState" (
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GitHubInstallState_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "GitHubInstallState_userId_expiresAt_idx" ON "GitHubInstallState"("userId", "expiresAt");

ALTER TABLE "GitHubInstallState" ADD CONSTRAINT "GitHubInstallState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
