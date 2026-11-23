import { prisma } from "../../lib/prisma.js";
import { validationQueue } from "../../jobs/validation.queue.js";

export async function enqueueSubmissionValidation(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      headCommitSha: true,
      status: true,
      repository: {
        select: {
          installation: {
            select: {
              suspendedAt: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found.");
  }



  if (
  submission.status !== "SUBMITTED" &&
  submission.status !== "VALIDATING"
) {
  throw new Error("Submission is not eligible for validation.");
}

  if (submission.repository.installation.suspendedAt) {
    throw new Error("GitHub installation is suspended.");
  }

  const activeRun = await prisma.validationRun.findFirst({
    where: {
      submissionId,
      commitSha: submission.headCommitSha,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true },
  });

  if (activeRun) {
    return activeRun;
  }

  if (submission.status !== "SUBMITTED") {
  throw new Error("Submission is already validating.");
}

  const validationRun = await prisma.$transaction(async (tx) => {
    const run = await tx.validationRun.create({
      data: {
        submissionId,
        commitSha: submission.headCommitSha,
      },
      select: { id: true },
    });

    await tx.submission.update({
      where: { id: submissionId },
      data: { status: "VALIDATING" },
    });

    return run;
  });

  try {
    await validationQueue.add(
      "validate-submission",
      { submissionId, validationRunId: validationRun.id },
      { jobId: validationRun.id },
    );
  } catch {
    await prisma.validationRun.update({
      where: { id: validationRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorCode: "QUEUE_ENQUEUE_FAILED",
      },
    });

    await prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: "VALIDATING",
      },
      data: { status: "SUBMITTED" },
    });

    throw new Error("Unable to enqueue validation.");
  }

  return validationRun;
}
