import { prisma } from "../../lib/prisma.js";

export type RequestReviewResult =
  | { success: true }
  | { success: false; code: "NOT_FOUND" | "INVALID_STATE" | "VALIDATION_REQUIRED" };

export async function requestSubmissionReview(
  submissionId: string,
): Promise<RequestReviewResult> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, headCommitSha: true },
  });

  if (!submission) {
    return { success: false, code: "NOT_FOUND" };
  }

  if (submission.status !== "SUBMITTED") {
    return { success: false, code: "INVALID_STATE" };
  }

  const validationRun = await prisma.validationRun.findFirst({
    where: {
      submissionId,
      commitSha: submission.headCommitSha,
      status: "COMPLETED",
    },
    select: { id: true },
  });

  if (!validationRun) {
    return { success: false, code: "VALIDATION_REQUIRED" };
  }

  const result = await prisma.submission.updateMany({
    where: {
      id: submissionId,
      status: "SUBMITTED",
      headCommitSha: submission.headCommitSha,
    },
    data: { status: "IN_REVIEW" },
  });

  if (result.count !== 1) {
    return { success: false, code: "INVALID_STATE" };
  }

  return { success: true };
}