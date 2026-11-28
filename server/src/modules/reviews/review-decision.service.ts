import { prisma } from "../../lib/prisma.js";

export type SubmitReviewResult =
  | { success: true; reviewId: string }
  | {
      success: false;
      code: "NOT_FOUND" | "INVALID_STATE" | "COMMIT_CHANGED" | "SELF_REVIEW";
    };

export async function submitSubmissionReview(
  submissionId: string,
  reviewerId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "COMMENTED",
  body?: string,
): Promise<SubmitReviewResult> {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        status: true,
        headCommitSha: true,
        submittedById: true,
        repository: { select: { teamId: true } },
      },
    });

    if (!submission) {
      return { success: false, code: "NOT_FOUND" };
    }

    if (decision === "APPROVED" && submission.submittedById === reviewerId) {
      return { success: false, code: "SELF_REVIEW" };
    }

    const reviewableStatuses = [
      "IN_REVIEW",
      "APPROVED",
      "CHANGES_REQUESTED",
      "REJECTED",
    ] as const;

    if (
      !reviewableStatuses.includes(
        submission.status as (typeof reviewableStatuses)[number],
      )
    ) {
      return { success: false, code: "INVALID_STATE" };
    }

    const nextStatus =
      decision === "COMMENTED" ? submission.status : decision;

    const guarded = await tx.submission.updateMany({
      where: {
        id: submissionId,
        status: submission.status,
        headCommitSha: submission.headCommitSha,
      },
      data: { status: nextStatus, updatedAt: new Date() },
    });

    if (guarded.count !== 1) {
      return { success: false, code: "COMMIT_CHANGED" };
    }

    const review = await tx.review.create({
      data: {
        submissionId,
        reviewerId,
        decision,
        reviewedCommitSha: submission.headCommitSha,
        body,
      },
      select: { id: true },
    });

    await tx.auditEvent.create({
      data: {
        teamId: submission.repository.teamId,
        actorId: reviewerId,
        action: `REVIEW_${decision}`,
        entityType: "Submission",
        entityId: submissionId,
        metadata: {
          reviewId: review.id,
          reviewedCommitSha: submission.headCommitSha,
          previousStatus: submission.status,
          newStatus: nextStatus,
        },
      },
    });

    return { success: true, reviewId: review.id };
  });
}