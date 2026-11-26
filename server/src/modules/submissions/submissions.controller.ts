import type { Response } from "express";
import { createHash } from "node:crypto";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { enqueueSubmissionValidation } from "./validation.service.js";
import { createInstallationAccessToken } from "../../lib/github/installation-token.js";
import { githubRequest } from "../github/github.service.js";
import { deletePrivateObject, getPrivateObject, putPrivateObject } from "../../lib/storage/private-object-storage.js";

const commitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;

function publicSubmission<T extends { patchStorageKey: string | null; idempotencyHash: string | null }>(submission: T) {
  const { patchStorageKey: _storageKey, idempotencyHash: _requestHash, ...safe } = submission;
  return safe;
}

export async function createSubmission(req: AuthenticatedRequest, res: Response) {
  const repositoryId = typeof req.params.repositoryId === "string" ? req.params.repositoryId : "";
  const userId = req.userId;
  const { title, description, sourceBranch, targetBranch, sourceCommitSha, baseCommitSha, patch } = req.body ?? {};
  const idempotencyKey = req.header("Idempotency-Key");
  if (!userId || !repositoryId || typeof title !== "string" || !title.trim() || title.length > 200 ||
      typeof sourceBranch !== "string" || !sourceBranch || typeof targetBranch !== "string" || !targetBranch ||
      typeof sourceCommitSha !== "string" || !commitPattern.test(sourceCommitSha) ||
      typeof baseCommitSha !== "string" || !commitPattern.test(baseCommitSha) ||
      typeof patch !== "string" || !patch || Buffer.byteLength(patch, "utf8") > 2_000_000 ||
      (idempotencyKey !== undefined && (idempotencyKey.length < 8 || idempotencyKey.length > 128))) {
    return res.status(400).json({ success: false, error: { code: "INVALID_REQUEST", message: "Valid title, branches, commit SHAs, patch, and idempotency key are required." } });
  }
  const patchSha256 = createHash("sha256").update(patch, "utf8").digest("hex");
  const idempotencyHash = createHash("sha256").update(JSON.stringify({
    repositoryId, title: title.trim(), description: typeof description === "string" ? description : null,
    sourceBranch, targetBranch, sourceCommitSha: sourceCommitSha.toLowerCase(), baseCommitSha: baseCommitSha.toLowerCase(), patchSha256,
  })).digest("hex");
  let storedObjectKey: string | undefined;
  try {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: { installation: true },
    });
    if (!repository || repository.isArchived || repository.installation.removedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Repository is unavailable." } });
    const membership = await prisma.teamMember.findFirst({ where: { teamId: repository.teamId, userId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "DEVELOPER"] } }, select: { id: true } });
    if (!membership) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You cannot submit to this repository." } });
    if (idempotencyKey) {
      const previous = await prisma.submission.findUnique({ where: { submittedById_idempotencyKey: { submittedById: userId, idempotencyKey } } });
      if (previous) {
        if (previous.idempotencyHash !== idempotencyHash) return res.status(409).json({ success: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used for a different submission." } });
        return res.status(200).json({ success: true, data: publicSubmission(previous) });
      }
    }
    if (repository.installation.suspendedAt) return res.status(403).json({ success: false, error: { code: "INSTALLATION_SUSPENDED", message: "GitHub installation is suspended." } });
    const installationToken = await createInstallationAccessToken(String(repository.installation.installationId));
    const repoPath = repository.fullName.split("/").map(encodeURIComponent).join("/");
    const [sourceRef, targetRef] = await Promise.all([
      githubRequest<{ object: { sha: string } }>(`https://api.github.com/repos/${repoPath}/git/ref/heads/${encodeURIComponent(sourceBranch)}`, installationToken.token),
      githubRequest<{ object: { sha: string } }>(`https://api.github.com/repos/${repoPath}/git/ref/heads/${encodeURIComponent(targetBranch)}`, installationToken.token),
    ]);
    if (sourceRef.object.sha.toLowerCase() !== sourceCommitSha.toLowerCase() || targetRef.object.sha.toLowerCase() !== baseCommitSha.toLowerCase()) {
      return res.status(409).json({ success: false, error: { code: "BRANCH_MOVED", message: "Source or target branch no longer points to the submitted commit." } });
    }
    const stored = await putPrivateObject(patch);
    storedObjectKey = stored.key;
    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.submission.create({ data: {
        repositoryId: repository.id, submittedById: userId, title: title.trim(),
        description: typeof description === "string" ? description : null,
        sourceBranch, targetBranch, sourceCommitSha, headCommitSha: sourceCommitSha,
        baseCommitSha, patchStorageKey: stored.key, idempotencyKey, idempotencyHash,
        status: "SUBMITTED", submittedAt: new Date(),
      } });
      await tx.auditEvent.create({ data: { teamId: repository.teamId, actorId: userId, action: "submission.created", entityType: "Submission", entityId: created.id, metadata: { repositoryId: repository.id, sourceCommitSha, baseCommitSha, targetBranch, patchSha256: stored.sha256 } } });
      return created;
    });
    return res.status(201).json({ success: true, data: publicSubmission(submission) });
  } catch (e) {
    if (storedObjectKey) await deletePrivateObject(storedObjectKey).catch(() => undefined);
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return res.status(409).json({ success: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used." } });
    console.error("Failed to create submission.", e instanceof Error ? e.message : "unknown");
    return res.status(502).json({ success: false, error: { code: "SUBMISSION_CREATE_FAILED", message: "Unable to verify repository access or save submission." } });
  }
}

export async function downloadSubmissionPatch(req: AuthenticatedRequest, res: Response) {
  const submissionId = typeof req.params.submissionId === "string" ? req.params.submissionId : "";
  if (!req.userId) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, select: { id: true, patchStorageKey: true, repository: { select: { teamId: true } } } });
  if (!submission || !submission.patchStorageKey) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Submission patch not found." } });
  const membership = await prisma.teamMember.findFirst({ where: { teamId: submission.repository.teamId, userId: req.userId, status: "ACTIVE" }, select: { id: true } });
  if (!membership) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You cannot access this submission patch." } });
  try {
    const patch = await getPrivateObject(submission.patchStorageKey);
    await prisma.auditEvent.create({ data: { teamId: submission.repository.teamId, actorId: req.userId, action: "submission.patch.downloaded", entityType: "Submission", entityId: submission.id } });
    res.setHeader("Content-Type", "text/x-diff; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${submission.id}.patch"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(patch);
  } catch {
    return res.status(404).json({ success: false, error: { code: "PATCH_UNAVAILABLE", message: "Submission patch is unavailable." } });
  }
}

export async function triggerSubmissionValidation(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const rawSubmissionId = req.params.submissionId;
    const submissionId =
      typeof rawSubmissionId === "string" ? rawSubmissionId : undefined;
    const userId = req.userId;

    if (!submissionId || !userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Submission ID is required.",
        },
      });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) {
  return res.status(400).json({
    success: false,
    error: {
      code: "INVALID_REQUEST",
      message: "Invalid submission ID.",
    },
  });
}

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        repository: {
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Submission not found.",
        },
      });
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: submission.repository.teamId,
        userId,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN", "DEVELOPER"] },
      },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not authorized to trigger validation.",
        },
      });
    }

    const validationRun = await enqueueSubmissionValidation(submissionId);
    await prisma.auditEvent.create({ data: {
      teamId: submission.repository.teamId,
      actorId: userId,
      action: "submission.validation.requested",
      entityType: "Submission",
      entityId: submissionId,
      metadata: { validationRunId: validationRun.id },
    } });

    return res.status(202).json({
      success: true,
      data: validationRun,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errorResponses: Record<
        string,
        { status: number; code: string; message: string }
      > = {
        "Submission not found.": {
          status: 404,
          code: "NOT_FOUND",
          message: "Submission not found.",
        },
        "Submission is not eligible for validation.": {
          status: 409,
          code: "CONFLICT",
          message: "Submission is not eligible for validation.",
        },
        "Submission is already validating.": {
          status: 409,
          code: "CONFLICT",
          message: "Submission is already validating.",
        },
        "GitHub installation is suspended.": {
          status: 403,
          code: "FORBIDDEN",
          message: "GitHub installation is suspended.",
        },
      };

      const response = errorResponses[error.message];

      if (response) {
        return res.status(response.status).json({
          success: false,
          error: {
            code: response.code,
            message: response.message,
          },
        });
      }
    }

    console.error("Failed to trigger submission validation.");

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}
export async function getSubmissionValidation(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const rawSubmissionId = req.params.submissionId;
    const submissionId =
      typeof rawSubmissionId === "string" ? rawSubmissionId : undefined;
    const userId = req.userId;

    if (!submissionId || !userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Submission ID is required.",
        },
      });
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid submission ID.",
        },
      });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        repository: {
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Submission not found.",
        },
      });
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: submission.repository.teamId,
        userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not authorized to view validation results.",
        },
      });
    }

    const validationRun = await prisma.validationRun.findFirst({
  where: { submissionId },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    commitSha: true,
    status: true,
    startedAt: true,
    completedAt: true,
    errorCode: true,
    createdAt: true,
    updatedAt: true,
    findings: {
      select: {
        id: true,
        tool: true,
        ruleId: true,
        severity: true,
        title: true,
        description: true,
        filePath: true,
        line: true,
        fingerprint: true,
        createdAt: true,
      },
    },
  },
});

    return res.status(200).json({
      success: true,
      data: validationRun,
    });
  } catch {
    console.error("Failed to retrieve submission validation.");

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}
