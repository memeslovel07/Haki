CREATE TABLE "OAuthLinkState" (
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthLinkState_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "OAuthLinkState_userId_expiresAt_idx" ON "OAuthLinkState"("userId", "expiresAt");
ALTER TABLE "OAuthLinkState" ADD CONSTRAINT "OAuthLinkState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
