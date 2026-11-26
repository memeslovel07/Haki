import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";

const shaPattern = /^[0-9a-f]{7,64}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const submissionSelect = {
  id: true, title: true, description: true, sourceBranch: true, targetBranch: true,
  baseCommitSha: true, headCommitSha: true, status: true, submittedAt: true,
  createdAt: true, updatedAt: true,
  repository: { select: { id: true, name: true, fullName: true, defaultBranch: true, htmlUrl: true } },
  submittedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function listSubmissions(req: AuthenticatedRequest, res: Response) {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.userId, status: "ACTIVE" }, select: { teamId: true },
    });
    const teamIds = memberships.map((membership) => membership.teamId);
    const repositoryId = typeof req.query.repositoryId === "string" ? req.query.repositoryId : undefined;
    const submissions = await prisma.submission.findMany({
      where: { repository: { teamId: { in: teamIds }, ...(repositoryId ? { id: repositoryId } : {}) } },
      select: submissionSelect,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return res.status(200).json({ success: true, data: submissions });
  } catch {
    console.error("Failed to list submissions.");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to load submissions." } });
  }
}

export async function createSubmission(req: AuthenticatedRequest, res: Response) {
  const { repositoryId, title, description, sourceBranch, targetBranch, baseCommitSha, headCommitSha } = req.body ?? {};
  if (typeof repositoryId !== "string" || !uuidPattern.test(repositoryId) ||
      typeof title !== "string" || !title.trim() || title.trim().length > 200 ||
      typeof sourceBranch !== "string" || !sourceBranch.trim() ||
      typeof targetBranch !== "string" || !targetBranch.trim() ||
      typeof baseCommitSha !== "string" || !shaPattern.test(baseCommitSha) ||
      typeof headCommitSha !== "string" || !shaPattern.test(headCommitSha) ||
      (description !== undefined && description !== null && typeof description !== "string")) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Provide a repository, title, branches, and valid base/head commit SHAs." } });
  }
  try {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: req.userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "DEVELOPER"] },
        team: { repositories: { some: { id: repositoryId, archivedAt: null } } },
      }, select: { teamId: true },
    });
    if (!membership) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Repository not found or you cannot submit changes to it." } });
    const submission = await prisma.submission.create({
      data: {
        repositoryId, submittedById: req.userId!, title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        sourceBranch: sourceBranch.trim(), targetBranch: targetBranch.trim(),
        baseCommitSha: baseCommitSha.toLowerCase(), headCommitSha: headCommitSha.toLowerCase(),
        status: "SUBMITTED", submittedAt: new Date(),
      },
      select: submissionSelect,
    });
    return res.status(201).json({ success: true, data: submission });
  } catch {
    console.error("Failed to create submission.");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to create submission." } });
  }
}

export async function getSubmission(req: AuthenticatedRequest, res: Response) {
  const submissionId = typeof req.params.submissionId === "string" ? req.params.submissionId : "";
  if (!uuidPattern.test(submissionId)) return res.status(400).json({ success: false, error: { code: "INVALID_SUBMISSION_ID", message: "Invalid submission ID." } });
  try {
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, repository: { team: { members: { some: { userId: req.userId, status: "ACTIVE" } } } } },
      select: {
        ...submissionSelect,
        reviews: { select: { id: true, decision: true, body: true, reviewedCommitSha: true, createdAt: true, reviewer: { select: { id: true, name: true, email: true } }, comments: { select: { id: true, filePath: true, line: true, body: true, createdAt: true, author: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "desc" } },
        validationRuns: { select: { id: true, commitSha: true, status: true, startedAt: true, completedAt: true, errorCode: true, createdAt: true, findings: { select: { id: true, tool: true, ruleId: true, severity: true, title: true, description: true, filePath: true, line: true }, orderBy: [{ severity: "desc" }, { filePath: "asc" }] } }, orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!submission) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Submission not found." } });
    return res.status(200).json({ success: true, data: submission });
  } catch {
    console.error("Failed to load submission.");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to load submission." } });
  }
}
