import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function connectedRepository(repoId: string, userId: string) {
  return prisma.repository.findFirst({
    where: { id: repoId, isArchived: false, team: { members: { some: { userId, status: "ACTIVE" } } } },
    select: { fullName: true, installation: { select: { installationId: true } } },
  });
}

async function githubFetch(url: string, token: string, res: Response) {
  const response = await fetch(url, { headers: headers(token), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return res.status(502).json({ success: false, error: { code: "GITHUB_UNAVAILABLE", message: "GitHub could not return repository references." } });
  return response.json();
}

export async function listRepositoryBranches(req: AuthenticatedRequest, res: Response) {
  try {
    const repo = await connectedRepository(req.params.repoId as string, req.userId!);
    if (!repo) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Connected repository not found." } });
    const { token } = await createInstallationAccessToken(repo.installation.installationId.toString());
    const data = await githubFetch(`https://api.github.com/repos/${repo.fullName}/branches?per_page=100`, token, res);
    if (res.headersSent) return;
    return res.json({ success: true, data: data.map((branch: any) => ({ name: branch.name, sha: branch.commit.sha })) });
  } catch {
    return res.status(502).json({ success: false, error: { code: "GITHUB_UNAVAILABLE", message: "Unable to load repository branches." } });
  }
}

export async function listRepositoryCommits(req: AuthenticatedRequest, res: Response) {
  const branch = typeof req.query.branch === "string" ? req.query.branch.trim() : "";
  if (!branch || branch.length > 255) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Choose a branch to load commits." } });
  try {
    const repo = await connectedRepository(req.params.repoId as string, req.userId!);
    if (!repo) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Connected repository not found." } });
    const { token } = await createInstallationAccessToken(repo.installation.installationId.toString());
    const url = new URL(`https://api.github.com/repos/${repo.fullName}/commits`);
    url.searchParams.set("sha", branch);
    url.searchParams.set("per_page", "30");
    const data = await githubFetch(url.toString(), token, res);
    if (res.headersSent) return;
    return res.json({ success: true, data: data.map((commit: any) => ({ sha: commit.sha, message: commit.commit.message.split("\n")[0], author: commit.commit.author?.name || "Unknown author" })) });
  } catch {
    return res.status(502).json({ success: false, error: { code: "GITHUB_UNAVAILABLE", message: "Unable to load branch commits." } });
  }
}

export async function getSubmissionDiff(req: AuthenticatedRequest, res: Response) {
  const submissionId = req.params.submissionId as string;
  if (!uuidPattern.test(submissionId)) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Submission not found." } });

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        baseCommitSha: true,
        headCommitSha: true,
        repository: { select: { fullName: true, teamId: true, installation: { select: { installationId: true } } } },
      },
    });
    if (!submission) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Submission not found." } });

    const membership = await prisma.teamMember.findFirst({
      where: { teamId: submission.repository.teamId, userId: req.userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You cannot view this submission." } });
    if (!/^[0-9a-f]{7,64}$/i.test(submission.baseCommitSha) || !/^[0-9a-f]{7,64}$/i.test(submission.headCommitSha)) {
      return res.status(400).json({ success: false, error: { code: "INVALID_COMMIT", message: "This submission does not contain valid commit IDs." } });
    }

    const [owner, name] = submission.repository.fullName.split("/");
    if (!owner || !name) return res.status(502).json({ success: false, error: { code: "INVALID_REPOSITORY", message: "Connected GitHub repository details are invalid." } });
    const { token } = await createInstallationAccessToken(submission.repository.installation.installationId.toString());
    const compareUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/compare/${encodeURIComponent(submission.baseCommitSha)}...${encodeURIComponent(submission.headCommitSha)}?per_page=100`;
    const response = await fetch(compareUrl, { headers: headers(token), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return res.status(502).json({ success: false, error: { code: "GITHUB_UNAVAILABLE", message: "GitHub could not return this commit comparison. Check that both commits are available to the installed GitHub App." } });

    const comparison = await response.json() as any;
    const sourceFiles = Array.isArray(comparison.files) ? comparison.files : [];
    const files = [];
    let patchBudget = 1_000_000;
    for (const file of sourceFiles.slice(0, 100)) {
      const originalPatch = typeof file.patch === "string" ? file.patch : null;
      const patch = originalPatch === null ? null : originalPatch.slice(0, patchBudget);
      if (originalPatch !== null) patchBudget -= patch.length;
      files.push({
        filename: String(file.filename || "(unknown file)"),
        previousFilename: typeof file.previous_filename === "string" ? file.previous_filename : null,
        status: String(file.status || "modified"),
        additions: Number(file.additions) || 0,
        deletions: Number(file.deletions) || 0,
        changes: Number(file.changes) || 0,
        patch,
        patchTruncated: originalPatch !== null && patch.length < originalPatch.length,
      });
    }

    return res.json({
      success: true,
      data: {
        aheadBy: Number(comparison.ahead_by) || 0,
        totalCommits: Number(comparison.total_commits) || 0,
        filesChanged: Number(comparison.files?.length) || 0,
        additions: Number(comparison.files?.reduce((sum: number, file: any) => sum + (Number(file.additions) || 0), 0)) || 0,
        deletions: Number(comparison.files?.reduce((sum: number, file: any) => sum + (Number(file.deletions) || 0), 0)) || 0,
        omittedFiles: Math.max(0, sourceFiles.length - files.length),
        files,
      },
    });
  } catch {
    return res.status(502).json({ success: false, error: { code: "GITHUB_UNAVAILABLE", message: "Unable to load the GitHub comparison." } });
  }
}
