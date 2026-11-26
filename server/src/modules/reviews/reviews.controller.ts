import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { requestSubmissionReview } from "./reviews.service.js";

export async function requestReview(
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
        role: { in: ["OWNER", "ADMIN", "DEVELOPER"] },
      },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not authorized to request a review.",
        },
      });
    }

    const result = await requestSubmissionReview(submissionId);

    if (!result.success) {
      const errorResponses = {
        NOT_FOUND: {
          status: 404,
          code: "NOT_FOUND",
          message: "Submission not found.",
        },
        INVALID_STATE: {
          status: 409,
          code: "INVALID_STATE",
          message: "Submission is not eligible for review.",
        },
        VALIDATION_REQUIRED: {
          status: 409,
          code: "VALIDATION_REQUIRED",
          message: "A completed validation for the current commit is required.",
        },
      } as const;

      const response = errorResponses[result.code];

      return res.status(response.status).json({
        success: false,
        error: {
          code: response.code,
          message: response.message,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: "IN_REVIEW",
      },
    });
  } catch {
    console.error("Failed to request submission review.");

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}