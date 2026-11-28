import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";
import { persistInstallation, verifyGitHubWebhook, verifyRepositoryAccess } from "./github.service.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { getPublicGitHubRepositories } from "../auth/github-oauth.service.js";

function error(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

const hashState = (state: string) => createHash("sha256").update(state).digest("hex");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listMyGitHubRepositories(req: AuthenticatedRequest, res: Response) {
  if (!req.userId) return error(res, 401, "UNAUTHORIZED", "Authentication required.");
  const [account, teamRepositories] = await Promise.all([
    prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: req.userId, provider: "GITHUB" } }, select: { username: true } }),
    prisma.repository.findMany({
      where: { isArchived: false, installation: { removedAt: null, suspendedAt: null }, team: { members: { some: { userId: req.userId, status: "ACTIVE" } } } },
      select: { githubRepoId: true, name: true, fullName: true, isPrivate: true, htmlUrl: true, defaultBranch: true, updatedAt: true, ownerLogin: true, team: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
  ]);
  try {
    const publicRepositories = account?.username ? await getPublicGitHubRepositories(account.username) : [];
    const installed = teamRepositories.map((repository) => ({ id: Number(repository.githubRepoId), name: repository.name, fullName: repository.fullName, private: repository.isPrivate, htmlUrl: repository.htmlUrl, description: null, defaultBranch: repository.defaultBranch, updatedAt: repository.updatedAt.toISOString(), ownerLogin: repository.ownerLogin, teamName: repository.team.name }));
    if (installed.some((repository) => !Number.isSafeInteger(repository.id))) throw new Error("GitHub repository ID exceeds the safe integer range.");
    const installedIds = new Set(installed.map((repository) => repository.id));
    const repositories = [...installed, ...publicRepositories.filter((repository) => !installedIds.has(repository.id))];
    return res.json({ success: true, data: repositories });
  } catch {
    if (teamRepositories.length) return res.json({ success: true, data: teamRepositories.map((repository) => ({ id: Number(repository.githubRepoId), name: repository.name, fullName: repository.fullName, private: repository.isPrivate, htmlUrl: repository.htmlUrl, description: null, defaultBranch: repository.defaultBranch, updatedAt: repository.updatedAt.toISOString(), ownerLogin: repository.ownerLogin, teamName: repository.team.name })) });
    return error(res, 502, "GITHUB_REPOSITORIES_UNAVAILABLE", "GitHub public repositories could not be loaded.");
  }
}

export async function startInstallation(req: AuthenticatedRequest, res: Response) {
  const teamId = typeof req.params.teamId === "string" ? req.params.teamId : "";
  if (!req.userId || !uuidPattern.test(teamId)) return error(res, 400, "INVALID_REQUEST", "A valid team ID is required.");
  const member = await prisma.teamMember.findFirst({ where: { teamId, userId: req.userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } } });
  if (!member) return error(res, 403, "FORBIDDEN", "Team administrator access is required.");
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return error(res, 503, "GITHUB_APP_UNAVAILABLE", "GitHub App is not configured.");
  const state = randomBytes(32).toString("hex");
  await prisma.gitHubInstallationState.deleteMany({ where: { userId: req.userId, expiresAt: { lt: new Date() } } });
  await prisma.gitHubInstallationState.create({ data: { stateHash: hashState(state), userId: req.userId, teamId, expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return res.status(200).json({ success: true, data: { url: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${state}` } });
}

export async function completeInstallation(req: Request, res: Response) {
  const { state, installation_id: installationId } = req.query;
  const redirect = (result: string, teamId?: string) => res.redirect(`${process.env.FRONTEND_ORIGIN?.replace(/\/$/, "")}/teams?installation=${result}${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""}`);
  if (req.query.setup_action !== "install" || typeof state !== "string" || !/^[a-f0-9]{64}$/i.test(state) || typeof installationId !== "string" || !/^\d{1,20}$/.test(installationId)) return redirect("failed");
  const claimed = await prisma.gitHubInstallationState.updateMany({ where: { stateHash: hashState(state), usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return redirect("expired");
  const stateRecord = await prisma.gitHubInstallationState.findUnique({ where: { stateHash: hashState(state) } });
  if (!stateRecord) return redirect("expired");
  const member = await prisma.teamMember.findFirst({ where: { teamId: stateRecord.teamId, userId: stateRecord.userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
  if (!member) return redirect("failed", stateRecord.teamId);
  const existing = await prisma.gitHubInstallation.findUnique({ where: { installationId: BigInt(installationId) }, select: { teamId: true } });
  if (existing && existing.teamId !== stateRecord.teamId) return redirect("failed", stateRecord.teamId);
  try {
    const installation = await persistInstallation(installationId, stateRecord.teamId);
    if (installation.teamId !== stateRecord.teamId) return redirect("failed", stateRecord.teamId);
    const access = await createInstallationAccessToken(installationId);
    const repositories: Array<{ id: number; name: string; full_name: string; html_url: string; default_branch: string | null; private: boolean; archived: boolean; owner: { login: string } }> = [];
    for (let page = 1; page <= 50; page += 1) {
      const url = `https://api.github.com/installation/repositories?per_page=100&page=${page}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${access.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`GitHub repository listing failed (${response.status}).`);
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !Array.isArray((data as { repositories?: unknown }).repositories)) throw new Error("GitHub returned an invalid installation repository list.");
      const items = (data as { repositories: typeof repositories }).repositories;
      repositories.push(...items);
      if (items.length < 100) break;
    }
    await prisma.$transaction(async (tx) => {
      const conflicting = await tx.repository.findMany({ where: { githubRepoId: { in: repositories.map((repository) => BigInt(repository.id)) }, NOT: { teamId: stateRecord.teamId, installationId: installation.id } }, select: { id: true } });
      if (conflicting.length) throw new Error("One or more GitHub repositories are already connected to another team.");
      await tx.repository.createMany({ data: repositories.map((repo) => ({
        githubRepoId: BigInt(repo.id), teamId: stateRecord.teamId, installationId: installation.id,
        name: repo.name, fullName: repo.full_name, ownerLogin: repo.owner.login,
        defaultBranch: repo.default_branch || "main", htmlUrl: repo.html_url,
        isPrivate: Boolean(repo.private), isArchived: Boolean(repo.archived), archivedAt: repo.archived ? new Date() : null,
      })), skipDuplicates: true });
      await tx.auditEvent.create({ data: { teamId: stateRecord.teamId, actorId: stateRecord.userId, action: "github.installation.connected", entityType: "GitHubInstallation", entityId: installation.id, metadata: { installationId, repositories: repositories.length } } });
    });
    return redirect("success", stateRecord.teamId);
  } catch (e) {
    console.error("GitHub installation setup failed.", e instanceof Error ? e.message : "unknown");
    return redirect("failed", stateRecord.teamId);
  }
}

export async function connectRepository(req: AuthenticatedRequest, res: Response) {
  const teamId = typeof req.params.teamId === "string" ? req.params.teamId : "";
  const { installationId, repositoryId } = req.body ?? {};
  if (!req.userId || !uuidPattern.test(teamId) || !/^\d{1,20}$/.test(String(installationId)) || !/^\d{1,20}$/.test(String(repositoryId))) return error(res, 400, "INVALID_REQUEST", "Valid team, installation, and repository IDs are required.");
  const member = await prisma.teamMember.findFirst({ where: { teamId, userId: req.userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
  if (!member) return error(res, 403, "FORBIDDEN", "Team administrator access is required.");
  const installation = await prisma.gitHubInstallation.findFirst({ where: { installationId: BigInt(installationId), teamId }, select: { id: true, installationId: true, teamId: true, removedAt: true, suspendedAt: true } });
  if (!installation) return error(res, 404, "NOT_FOUND", "Team installation not found.");
  try {
    const { repo } = await verifyRepositoryAccess(installation, String(repositoryId));
    const existing = await prisma.repository.findUnique({ where: { githubRepoId: BigInt(repo.id) }, select: { teamId: true, installationId: true } });
    if (existing && (existing.teamId !== teamId || existing.installationId !== installation.id)) return error(res, 409, "REPOSITORY_ALREADY_LINKED", "Repository is already connected to another team or installation.");
    const repository = await prisma.repository.upsert({
      where: { githubRepoId: BigInt(repo.id) },
      create: { githubRepoId: BigInt(repo.id), teamId, installationId: installation.id, name: repo.name, fullName: repo.full_name, ownerLogin: repo.owner.login, defaultBranch: repo.default_branch, htmlUrl: repo.html_url, isPrivate: repo.private, isArchived: repo.archived, archivedAt: repo.archived ? new Date() : null },
      update: { name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, htmlUrl: repo.html_url, isPrivate: repo.private, isArchived: repo.archived, archivedAt: repo.archived ? new Date() : null },
    });
    if (repository.teamId !== teamId || repository.installationId !== installation.id) return error(res, 409, "REPOSITORY_ALREADY_LINKED", "Repository is already connected to another team or installation.");
    await prisma.auditEvent.create({ data: { teamId, actorId: req.userId, action: "github.repository.connected", entityType: "Repository", entityId: repository.id, metadata: { githubRepoId: String(repo.id), installationId } } });
    return res.status(200).json({ success: true, data: { ...repository, githubRepoId: repository.githubRepoId.toString(), installationId: repository.installationId.toString() } });
  } catch {
    return error(res, 403, "REPOSITORY_ACCESS_DENIED", "Repository is not accessible to this team installation.");
  }
}

export async function githubWebhook(req: Request, res: Response) {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw || !verifyGitHubWebhook(raw, req.header("x-hub-signature-256"))) return error(res, 401, "INVALID_SIGNATURE", "GitHub webhook signature is invalid.");
  const deliveryId = req.header("x-github-delivery");
  const event = req.header("x-github-event");
  if (!deliveryId || !event) return error(res, 400, "INVALID_WEBHOOK", "Webhook delivery headers are required.");
  try {
    await prisma.gitHubWebhookDelivery.create({ data: { deliveryId, event } });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return res.status(200).json({ success: true, data: { duplicate: true } });
    throw e;
  }
  try {
  const body = req.body as { action?: string; installation?: { id?: number }; repositories_added?: Array<{ id: number; name: string; full_name: string; html_url: string; default_branch: string; private: boolean; archived: boolean; owner: { login: string } }>; repositories_removed?: Array<{ id: number }> };
  if ((event === "installation" || event === "installation_repositories") && body.installation?.id) {
    const installationId = BigInt(body.installation.id);
    const record = await prisma.gitHubInstallation.findUnique({ where: { installationId }, select: { id: true, teamId: true } });
    if (record && event === "installation" && body.action === "deleted") {
      await prisma.$transaction([
        prisma.gitHubInstallation.update({ where: { id: record.id }, data: { removedAt: new Date(), suspendedAt: null } }),
        prisma.repository.updateMany({ where: { installationId: record.id }, data: { isArchived: true, archivedAt: new Date() } }),
        prisma.auditEvent.create({ data: { teamId: record.teamId, action: "github.installation.removed", entityType: "GitHubInstallation", entityId: record.id } }),
      ]);
    } else if (record && event === "installation" && body.action === "suspend") {
      await prisma.gitHubInstallation.update({ where: { id: record.id }, data: { suspendedAt: new Date() } });
    } else if (record && event === "installation" && body.action === "unsuspend") {
      await prisma.gitHubInstallation.update({ where: { id: record.id }, data: { suspendedAt: null } });
    } else if (record && event === "installation_repositories") {
      for (const repo of body.repositories_added ?? []) {
        const existing = await prisma.repository.findUnique({ where: { githubRepoId: BigInt(repo.id) }, select: { teamId: true, installationId: true } });
        if (existing && (existing.teamId !== record.teamId || existing.installationId !== record.id)) continue;
        await prisma.repository.upsert({
          where: { githubRepoId: BigInt(repo.id) },
          create: { githubRepoId: BigInt(repo.id), teamId: record.teamId, installationId: record.id, name: repo.name, fullName: repo.full_name, ownerLogin: repo.owner.login, defaultBranch: repo.default_branch, htmlUrl: repo.html_url, isPrivate: repo.private, isArchived: repo.archived, archivedAt: repo.archived ? new Date() : null },
          update: { name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, htmlUrl: repo.html_url, isPrivate: repo.private, isArchived: repo.archived, archivedAt: repo.archived ? new Date() : null },
        });
      }
      const removedIds = (body.repositories_removed ?? []).map((repo) => BigInt(repo.id));
      if (removedIds.length) await prisma.repository.updateMany({ where: { installationId: record.id, githubRepoId: { in: removedIds } }, data: { isArchived: true, archivedAt: new Date() } });
    }
  }
  return res.status(200).json({ success: true, data: { received: true } });
  } catch {
    await prisma.gitHubWebhookDelivery.delete({ where: { deliveryId } }).catch(() => undefined);
    return error(res, 500, "WEBHOOK_PROCESSING_FAILED", "Webhook could not be processed; GitHub may retry the delivery.");
  }
}

export async function listTeamRepositories(req: AuthenticatedRequest, res: Response) {
  const teamId = typeof req.params.teamId === "string" ? req.params.teamId : "";
  if (!uuidPattern.test(teamId)) return error(res, 404, "NOT_FOUND", "Team not found.");
  const member = req.userId ? await prisma.teamMember.findFirst({ where: { teamId, userId: req.userId, status: "ACTIVE" }, select: { id: true } }) : null;
  if (!member) return error(res, 403, "FORBIDDEN", "Team membership is required.");
  const repositories = await prisma.repository.findMany({ where: { teamId }, orderBy: { fullName: "asc" }, select: { id: true, githubRepoId: true, name: true, fullName: true, ownerLogin: true, defaultBranch: true, htmlUrl: true, isPrivate: true, isArchived: true, archivedAt: true, updatedAt: true, installation: { select: { accountLogin: true, accountUrl: true, suspendedAt: true, removedAt: true } }, settings: { select: { config: true } } } });
  return res.json({ success: true, data: repositories.map((repository) => ({ ...repository, githubRepoId: repository.githubRepoId.toString() })) });
}

export async function updateRepositorySettings(req: AuthenticatedRequest, res: Response) {
  const repositoryId = typeof req.params.repositoryId === "string" ? req.params.repositoryId : "";
  if (!uuidPattern.test(repositoryId)) return error(res, 404, "NOT_FOUND", "Repository not found.");
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId }, select: { id: true, teamId: true } });
  if (!repository) return error(res, 404, "NOT_FOUND", "Repository not found.");
  const member = req.userId ? await prisma.teamMember.findFirst({ where: { teamId: repository.teamId, userId: req.userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } }) : null;
  if (!member) return error(res, 403, "FORBIDDEN", "Team administrator access is required.");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || JSON.stringify(req.body).length > 20_000) return error(res, 400, "INVALID_REQUEST", "Repository settings must be a JSON object under 20 KB.");
  const settings = await prisma.repositorySettings.upsert({ where: { repositoryId }, create: { repositoryId, config: req.body }, update: { config: req.body } });
  await prisma.auditEvent.create({ data: { teamId: repository.teamId, actorId: req.userId, action: "repository.settings.updated", entityType: "Repository", entityId: repositoryId } });
  return res.json({ success: true, data: settings });
}

export async function getRepositorySettings(req: AuthenticatedRequest, res: Response) {
  const repositoryId = typeof req.params.repositoryId === "string" ? req.params.repositoryId : "";
  if (!uuidPattern.test(repositoryId)) return error(res, 404, "NOT_FOUND", "Repository not found.");
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId }, select: { teamId: true } });
  if (!repository) return error(res, 404, "NOT_FOUND", "Repository not found.");
  const member = req.userId ? await prisma.teamMember.findFirst({ where: { teamId: repository.teamId, userId: req.userId, status: "ACTIVE" }, select: { id: true } }) : null;
  if (!member) return error(res, 403, "FORBIDDEN", "Team membership is required.");
  const settings = await prisma.repositorySettings.findUnique({ where: { repositoryId } });
  return res.json({ success: true, data: settings?.config ?? {} });
}
