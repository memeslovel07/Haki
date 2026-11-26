import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { submitSubmissionReview } from "./review-decision.service.js";

const allowedDecisions = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "COMMENTED",
] as const;

export async function submitReview(req: AuthenticatedRequest, res: Response) {
  try {
    const rawSubmissionId = req.params.submissionId;
    const submissionId =
      typeof rawSubmissionId === "string" ? rawSubmissionId : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) {
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
        role: { in: ["OWNER", "ADMIN", "REVIEWER"] },
      },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN" },
      });
    }

    const { decision, body } = req.body ?? {};

    if (
      typeof decision !== "string" ||
      !allowedDecisions.includes(decision as (typeof allowedDecisions)[number])
    ) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REVIEW_DECISION" },
      });
    }

    if (body !== undefined && typeof body !== "string") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REVIEW_BODY" },
      });
    }

    const result = await submitSubmissionReview(
      submissionId,
      userId,
      decision as (typeof allowedDecisions)[number],
      body,
    );

    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error: { code: "SUBMISSION_NOT_FOUND" },
        });
      }

      return res.status(409).json({
        success: false,
        error: { code: result.code },
      });
    }

    return res.status(201).json({
      success: true,
      data: { reviewId: result.reviewId, decision },
    });
  } catch (error) {
    console.error("Submit review error:", error);

    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
}