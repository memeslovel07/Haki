import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { createGitHubAppJwt } from "../../lib/github/app-auth.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";

const API = "https://api.github.com";
const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

export async function githubRequest<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...headers(token), ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function getInstallation(installationId: string) {
  const jwt = await createGitHubAppJwt();
  return githubRequest<{
    id: number; account: { id: number; login: string; type: string; html_url?: string };
    permissions?: Record<string, string>; repository_selection?: string; suspended_at?: string | null;
  }>(`${API}/app/installations/${installationId}`, jwt);
}

export function verifyGitHubWebhook(raw: Buffer, signature: string | undefined): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function persistInstallation(installationId: string, teamId: string) {
  const details = await getInstallation(installationId);
  if (String(details.id) !== installationId || !details.account?.id || !details.account.login) {
    throw new Error("Invalid GitHub installation response.");
  }
  if (details.permissions?.contents !== "read" && details.permissions?.contents !== "write") {
    throw new Error("GitHub App installation lacks repository contents permission.");
  }
  return prisma.gitHubInstallation.upsert({
    where: { installationId: BigInt(installationId) },
    create: {
      installationId: BigInt(installationId), accountId: BigInt(details.account.id),
      accountLogin: details.account.login, accountType: details.account.type === "Organization" ? "ORGANIZATION" : "USER",
      teamId, accountUrl: details.account.html_url, permissions: details.permissions,
      repositorySelection: details.repository_selection, suspendedAt: details.suspended_at ? new Date(details.suspended_at) : null,
      removedAt: null,
    },
    update: {
      accountId: BigInt(details.account.id), accountLogin: details.account.login,
      accountType: details.account.type === "Organization" ? "ORGANIZATION" : "USER",
      accountUrl: details.account.html_url, permissions: details.permissions,
      repositorySelection: details.repository_selection, suspendedAt: details.suspended_at ? new Date(details.suspended_at) : null,
      removedAt: null,
    },
  });
}

export async function verifyRepositoryAccess(installation: { installationId: bigint; teamId: string; removedAt: Date | null; suspendedAt: Date | null }, repoId: string) {
  if (installation.removedAt || installation.suspendedAt) throw new Error("GitHub installation is unavailable.");
  const token = await createInstallationAccessToken(String(installation.installationId));
  const repo = await githubRequest<{
    id: number; name: string; full_name: string; html_url: string; default_branch: string;
    private: boolean; archived: boolean; owner: { login: string };
  }>(`${API}/repositories/${repoId}`, token.token);
  return { repo, teamId: installation.teamId };
}
