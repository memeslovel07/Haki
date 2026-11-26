import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { createGitHubAppJwt } from "../../lib/github/app-auth.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";

const API = "https://api.github.com";
const headers = (authorization: string) => ({ Authorization: authorization, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });

export async function ensureUserTeam(userId: string, name?: string | null) {
  const membership = await prisma.teamMember.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { teamId: true },
  });
  if (membership) return membership.teamId;
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: { name: `${name?.trim() || "Personal"} workspace`.slice(0, 120), slug: `workspace-${randomUUID()}` },
    });
    await tx.teamMember.create({ data: { teamId: team.id, userId, role: "OWNER", status: "ACTIVE" } });
    return team.id;
  });
}

function stateSecret() {
  const secret = process.env.GITHUB_APP_STATE_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("GITHUB_APP_STATE_SECRET is not configured.");
  return secret;
}

export function createInstallState(userId: string) {
  const expires = Math.floor(Date.now() / 1000) + 10 * 60;
  const payload = `${userId}.${expires}`;
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function readInstallState(state: string) {
  const parts = state.split(".");
  if (parts.length !== 3) throw new Error("Invalid GitHub installation state.");
  const [userId, expiryText, signature] = parts;
  const expiry = Number(expiryText);
  if (!userId || !Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) throw new Error("GitHub installation state expired.");
  const expected = createHmac("sha256", stateSecret()).update(`${userId}.${expiryText}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "hex"); } catch { throw new Error("Invalid GitHub installation state."); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Invalid GitHub installation state.");
  return userId;
}

async function githubJson(url: string, authorization: string) {
  const response = await fetch(url, { headers: headers(authorization) });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}).`);
  return response.json() as Promise<any>;
}

export async function syncInstallation(userId: string, rawInstallationId: string) {
  if (!/^\d+$/.test(rawInstallationId)) throw new Error("Invalid GitHub installation ID.");
  const installationId = BigInt(rawInstallationId);
  const jwt = `Bearer ${await createGitHubAppJwt()}`;
  const details = await githubJson(`${API}/app/installations/${rawInstallationId}`, jwt);
  const account = details.account;
  if (!account?.id || !account?.login || !["User", "Organization"].includes(account.type)) throw new Error("GitHub returned invalid installation details.");
  const accountType = account.type.toUpperCase() as "USER" | "ORGANIZATION";
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) throw new Error("HAKI account not found.");
  const teamId = await ensureUserTeam(userId, user.name);
  const installation = await prisma.githubInstallation.upsert({
    where: { installationId },
    create: { installationId, accountId: BigInt(account.id), accountLogin: account.login, accountType, teamId },
    update: { accountId: BigInt(account.id), accountLogin: account.login, accountType, teamId, suspendedAt: null },
  });
  const token = await createInstallationAccessToken(rawInstallationId);
  const repos: any[] = [];
  let completeRepositoryList = false;
  for (let page = 1; page <= 10; page += 1) {
    const response = await githubJson(`${API}/installation/repositories?per_page=100&page=${page}`, `Bearer ${token.token}`);
    const pageRepos = Array.isArray(response.repositories) ? response.repositories : [];
    repos.push(...pageRepos);
    if (pageRepos.length < 100) { completeRepositoryList = true; break; }
  }
  for (const repo of repos) {
    if (!repo.id || !repo.full_name || !repo.owner?.login) continue;
    const existing = await prisma.repository.findUnique({ where: { githubRepoId: BigInt(repo.id) }, select: { installationId: true } });
    if (existing && existing.installationId !== installation.id) continue;
    await prisma.repository.upsert({
      where: { githubRepoId: BigInt(repo.id) },
      create: {
        githubRepoId: BigInt(repo.id), teamId, installationId: installation.id,
        name: repo.name, fullName: repo.full_name, ownerLogin: repo.owner.login,
        defaultBranch: repo.default_branch || "main", htmlUrl: repo.html_url,
        isPrivate: Boolean(repo.private), isArchived: Boolean(repo.archived),
        archivedAt: repo.archived ? new Date() : null,
      },
      update: {
        teamId, installationId: installation.id, name: repo.name,
        fullName: repo.full_name, ownerLogin: repo.owner.login,
        defaultBranch: repo.default_branch || "main", htmlUrl: repo.html_url,
        isPrivate: Boolean(repo.private), isArchived: Boolean(repo.archived),
        archivedAt: repo.archived ? new Date() : null,
      },
    });
  }
  if (completeRepositoryList) {
    await prisma.repository.updateMany({
      where: { installationId: installation.id, ...(repos.length ? { githubRepoId: { notIn: repos.map((repo: any) => BigInt(repo.id)) } } : {}) },
      data: { archivedAt: new Date() },
    });
  }
  return { accountLogin: account.login, repositoryCount: repos.length };
}

export async function syncWebhookRepositories(payload: any) {
  const rawId = payload.installation?.id;
  const repositories = payload.action === "removed"
    ? (payload.repositories_removed ?? payload.repositories)
    : (payload.repositories_added ?? payload.repositories);
  if (!rawId || !Array.isArray(repositories)) return;
  const installation = await prisma.githubInstallation.findUnique({ where: { installationId: BigInt(rawId) }, select: { id: true } });
  if (!installation) return;
  for (const repo of repositories) {
    if (!repo?.id) continue;
    if (payload.action === "removed") {
      await prisma.repository.updateMany({ where: { githubRepoId: BigInt(repo.id), installationId: installation.id }, data: { archivedAt: new Date() } });
      continue;
    }
    if (payload.action === "added" || payload.action === "created") {
      await prisma.repository.upsert({
        where: { githubRepoId: BigInt(repo.id) },
        create: {
          githubRepoId: BigInt(repo.id), teamId: (await prisma.githubInstallation.findUniqueOrThrow({ where: { id: installation.id }, select: { teamId: true } })).teamId,
          installationId: installation.id, name: repo.name, fullName: repo.full_name,
          ownerLogin: repo.owner?.login || repo.full_name?.split("/")[0] || "unknown",
          defaultBranch: repo.default_branch || "main", htmlUrl: repo.html_url,
          isPrivate: Boolean(repo.private), isArchived: Boolean(repo.archived), archivedAt: repo.archived ? new Date() : null,
        },
        update: { name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch || "main", htmlUrl: repo.html_url, isPrivate: Boolean(repo.private), archivedAt: repo.archived ? new Date() : null },
      });
    }
  }
}
