import { prisma } from "../../lib/prisma.js";

export type CreateReviewCommentResult =
  | { success: true; commentId: string }
  | {
      success: false;
      code: "REVIEW_NOT_FOUND" | "INVALID_STATE" | "COMMIT_CHANGED";
    };

export async function createReviewComment(
  submissionId: string,
  reviewId: string,
  authorId: string,
  filePath: string,
  line: number,
  body: string,
): Promise<CreateReviewCommentResult> {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.findFirst({
      where: {
        id: reviewId,
        submissionId,
      },
      select: {
        id: true,
        reviewedCommitSha: true,
        submission: {
          select: {
            status: true,
            headCommitSha: true,
          },
        },
      },
    });

    if (!review) {
      return { success: false, code: "REVIEW_NOT_FOUND" };
    }

    if (review.submission.status !== "IN_REVIEW") {
      return { success: false, code: "INVALID_STATE" };
    }

    if (review.reviewedCommitSha !== review.submission.headCommitSha) {
      return { success: false, code: "COMMIT_CHANGED" };
    }

    const comment = await tx.reviewComment.create({
      data: {
        reviewId,
        authorId,
        filePath,
        line,
        body,
      },
      select: { id: true },
    });

    return { success: true, commentId: comment.id };
  });
}