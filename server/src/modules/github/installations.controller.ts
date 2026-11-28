import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { createGitHubAppJwt } from "../../lib/github/app-auth.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";

const tokenHash = (state: string) => createHash("sha256").update(state).digest("hex");
const githubHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });

export async function createInstallState(req: AuthenticatedRequest, res: Response) {
  const state = randomBytes(32).toString("hex");
  try {
    await prisma.gitHubInstallState.create({
      data: { tokenHash: tokenHash(state), userId: req.userId!, expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    return res.json({ success: true, data: { state } });
  } catch {
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to start GitHub App installation." } });
  }
}

export async function completeInstall(req: Request, res: Response) {
  const frontend = process.env.FRONTEND_ORIGIN;
  const redirect = (result: string) => res.redirect(`${frontend?.replace(/\/$/, "")}/governance?installation=${result}`);
  const installationId = typeof req.query.installation_id === "string" ? req.query.installation_id : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!frontend || req.query.setup_action !== "install" || !/^\d+$/.test(installationId) || !state) return redirect("failed");

  try {
    const pending = await prisma.gitHubInstallState.findUnique({ where: { tokenHash: tokenHash(state) } });
    if (!pending || pending.usedAt || pending.expiresAt <= new Date()) return redirect("expired");

    const jwt = await createGitHubAppJwt();
    const installationResponse = await fetch(`https://api.github.com/app/installations/${installationId}`, { headers: githubHeaders(jwt) });
    if (!installationResponse.ok) throw new Error("Unable to verify GitHub App installation.");
    const installationData = await installationResponse.json();
    const account = installationData.account;
    if (!account?.id || !account?.login || !["User", "Organization"].includes(account.type)) throw new Error("Invalid GitHub installation account.");

    const access = await createInstallationAccessToken(installationId);
    const repositories: Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      default_branch: string | null;
      html_url: string;
      private: boolean;
      archived: boolean;
    }> = [];
    for (let page = 1; page <= 50; page++) {
      const response = await fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, { headers: githubHeaders(access.token) });
      if (!response.ok) throw new Error("Unable to read installed GitHub repositories.");
      const data = await response.json();
      if (!Array.isArray(data.repositories)) throw new Error("Invalid GitHub repository response.");
      repositories.push(...data.repositories);
      if (data.repositories.length < 100) break;
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.gitHubInstallState.updateMany({
        where: { tokenHash: tokenHash(state), usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("Installation state already used.");
      if (await tx.gitHubInstallation.findUnique({ where: { installationId: BigInt(installationId) } })) throw new Error("GitHub App installation is already connected.");

      let team = await tx.team.findFirst({ where: { members: { some: { userId: pending.userId, role: "OWNER", status: "ACTIVE" } } } });
      if (!team) {
        const slugBase = String(account.login).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "team";
        team = await tx.team.create({
          data: {
            name: `${account.login} HAKI workspace`.slice(0, 120),
            slug: `${slugBase}-${randomBytes(3).toString("hex")}`,
            members: { create: { userId: pending.userId, role: "OWNER" } },
          },
        });
      }

      const installation = await tx.gitHubInstallation.create({
        data: {
          installationId: BigInt(installationId), accountId: BigInt(account.id), accountLogin: account.login,
          accountType: account.type === "Organization" ? "ORGANIZATION" : "USER", teamId: team.id,
        },
      });
      if (repositories.length) {
        await tx.repository.createMany({
          data: repositories.map((repo: any) => ({
            githubRepoId: BigInt(repo.id), teamId: team!.id, installationId: installation.id,
            name: repo.name, fullName: repo.full_name, ownerLogin: repo.owner.login,
            defaultBranch: repo.default_branch || "main", htmlUrl: repo.html_url,
            isPrivate: Boolean(repo.private), isArchived: Boolean(repo.archived),
          })),
          skipDuplicates: true,
        });
      }
    });
    return redirect("success");
  } catch (error) {
    console.error("GitHub App installation callback failed:", error instanceof Error ? error.message : "Unknown error");
    return redirect("failed");
  }
}
