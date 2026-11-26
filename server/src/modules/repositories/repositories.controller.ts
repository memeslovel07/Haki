import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";

export async function listRepositories(req: AuthenticatedRequest, res: Response) {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.userId, status: "ACTIVE" },
      select: { teamId: true },
    });
    const teamIds = memberships.map((membership) => membership.teamId);
    const repositories = await prisma.repository.findMany({
      where: { teamId: { in: teamIds }, archivedAt: null },
      select: {
        id: true, name: true, fullName: true, ownerLogin: true,
        defaultBranch: true, htmlUrl: true, isPrivate: true,
        teamId: true, updatedAt: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { fullName: "asc" },
    });
    return res.status(200).json({ success: true, data: repositories });
  } catch {
    console.error("Failed to list repositories.");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to load repositories." } });
  }
}

export async function getRepository(req: AuthenticatedRequest, res: Response) {
  const repositoryId = typeof req.params.repositoryId === "string" ? req.params.repositoryId : "";
  try {
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        team: { members: { some: { userId: req.userId, status: "ACTIVE" } } },
        archivedAt: null,
      },
      select: {
        id: true, name: true, fullName: true, ownerLogin: true,
        defaultBranch: true, htmlUrl: true, isPrivate: true, teamId: true,
        updatedAt: true,
      },
    });
    if (!repository) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Repository not found." } });
    return res.status(200).json({ success: true, data: repository });
  } catch {
    console.error("Failed to load repository.");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to load repository." } });
  }
}

export async function listRepositoryBranches(req: AuthenticatedRequest, res: Response) {
  const repositoryId = typeof req.params.repositoryId === "string" ? req.params.repositoryId : "";
  try {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, team: { members: { some: { userId: req.userId, status: "ACTIVE" } } }, archivedAt: null },
      select: { ownerLogin: true, name: true, installation: { select: { installationId: true, suspendedAt: true } } },
    });
    if (!repository) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Repository not found." } });
    if (repository.installation.suspendedAt) return res.status(409).json({ success: false, error: { code: "INSTALLATION_SUSPENDED", message: "The GitHub App installation is suspended." } });
    const accessToken = await createInstallationAccessToken(repository.installation.installationId.toString());
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.ownerLogin)}/${encodeURIComponent(repository.name)}/branches?per_page=100`, {
      headers: { Authorization: `Bearer ${accessToken.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ success: false, error: { code: "GITHUB_BRANCH_FETCH_FAILED", message: "Could not load branches from GitHub." } });
    const branches = await response.json();
    return res.status(200).json({ success: true, data: branches });
  } catch {
    console.error("Failed to list repository branches.");
    return res.status(502).json({ success: false, error: { code: "GITHUB_BRANCH_FETCH_FAILED", message: "Could not load branches from GitHub." } });
  }
}
