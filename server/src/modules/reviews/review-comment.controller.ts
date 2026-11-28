import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { createReviewComment } from "./review-comment.service.js";

export async function addReviewComment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const rawSubmissionId = req.params.submissionId;
    const rawReviewId = req.params.reviewId;

    const submissionId =
      typeof rawSubmissionId === "string" ? rawSubmissionId : "";
    const reviewId = typeof rawReviewId === "string" ? rawReviewId : "";

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(submissionId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_SUBMISSION_ID" },
      });
    }

    if (!uuidRegex.test(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REVIEW_ID" },
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
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN" },
      });
    }

    const { filePath, line, body } = req.body ?? {};

    if (typeof filePath !== "string" || !filePath.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FILE_PATH" },
      });
    }

    if (!Number.isInteger(line) || line < 1) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_LINE" },
      });
    }

    if (typeof body !== "string" || !body.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_COMMENT_BODY" },
      });
    }

    const result = await createReviewComment(
      submissionId,
      reviewId,
      userId,
      filePath.trim(),
      line,
      body.trim(),
    );

    if (!result.success) {
      if (result.code === "REVIEW_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error: { code: "REVIEW_NOT_FOUND" },
        });
      }

      return res.status(409).json({
        success: false,
        error: { code: result.code },
      });
    }

    return res.status(201).json({
      success: true,
      data: { commentId: result.commentId },
    });
  } catch (error) {
    console.error("Add review comment error:", error);

    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
}
