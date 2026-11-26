import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { enqueueSubmissionValidation } from "./validation.service.js";

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
