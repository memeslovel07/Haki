-- AlterTable
ALTER TABLE "User" ADD COLUMN "profile" JSONB,
ADD COLUMN "settings" JSONB;

-- CreateEnum
CREATE TYPE "WorkspaceVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "WorkspaceRepository" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "visibility" "WorkspaceVisibility" NOT NULL DEFAULT 'PRIVATE',
    "defaultBranch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "WorkspaceRepository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceFile" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "encoding" VARCHAR(20) NOT NULL DEFAULT 'utf8',
    "mimeType" VARCHAR(255) NOT NULL DEFAULT 'text/plain',
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "WorkspaceFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceCommit" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" VARCHAR(120) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "parentId" UUID,
    "files" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceCommit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceCommitFile" (
    "id" UUID NOT NULL,
    "commitId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "encoding" VARCHAR(20) NOT NULL DEFAULT 'utf8',
    "mimeType" VARCHAR(255) NOT NULL DEFAULT 'text/plain',
    "size" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorkspaceCommitFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceRepository_ownerId_name_key" ON "WorkspaceRepository"("ownerId", "name");
CREATE INDEX "WorkspaceRepository_ownerId_updatedAt_idx" ON "WorkspaceRepository"("ownerId", "updatedAt");
CREATE UNIQUE INDEX "WorkspaceFile_repositoryId_path_key" ON "WorkspaceFile"("repositoryId", "path");
CREATE INDEX "WorkspaceFile_repositoryId_path_idx" ON "WorkspaceFile"("repositoryId", "path");
CREATE INDEX "WorkspaceCommit_repositoryId_createdAt_idx" ON "WorkspaceCommit"("repositoryId", "createdAt");
CREATE UNIQUE INDEX "WorkspaceCommitFile_commitId_path_key" ON "WorkspaceCommitFile"("commitId", "path");
CREATE INDEX "WorkspaceCommitFile_commitId_idx" ON "WorkspaceCommitFile"("commitId");

ALTER TABLE "WorkspaceRepository" ADD CONSTRAINT "WorkspaceRepository_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "WorkspaceRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceCommit" ADD CONSTRAINT "WorkspaceCommit_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "WorkspaceRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceCommitFile" ADD CONSTRAINT "WorkspaceCommitFile_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "WorkspaceCommit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
