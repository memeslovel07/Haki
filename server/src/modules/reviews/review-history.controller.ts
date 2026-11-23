import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";

export async function getSubmissionReviewHistory(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const rawSubmissionId = req.params.submissionId;
    const submissionId =
      typeof rawSubmissionId === "string" ? rawSubmissionId : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        submissionId,
      )
    ) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_SUBMISSION_ID" },
      });
    }

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED" },
      });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        repository: { select: { teamId: true } },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: { code: "SUBMISSION_NOT_FOUND" },
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
        error: { code: "FORBIDDEN" },
      });
    }

    const reviews = await prisma.review.findMany({
      where: { submissionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        decision: true,
        reviewedCommitSha: true,
        body: true,
        createdAt: true,
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            filePath: true,
            line: true,
            body: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    console.error("Get submission review history error:", error);

    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
}