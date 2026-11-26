import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  submissionFindMock,
  activeRunFindMock,
  runCreateMock,
  runUpdateMock,
  submissionUpdateMock,
  submissionUpdateManyMock,
  transactionMock,
  queueAddMock,
} = vi.hoisted(() => ({
  submissionFindMock: vi.fn(),
  activeRunFindMock: vi.fn(),
  runCreateMock: vi.fn(),
  runUpdateMock: vi.fn(),
  submissionUpdateMock: vi.fn(),
  submissionUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
  queueAddMock: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    submission: {
      findUnique: submissionFindMock,
      update: submissionUpdateMock,
      updateMany: submissionUpdateManyMock,
    },
    validationRun: {
      findFirst: activeRunFindMock,
      update: runUpdateMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("../src/jobs/validation.queue.js", () => ({
  validationQueue: {
    add: queueAddMock,
  },
}));

import { enqueueSubmissionValidation } from "../src/modules/submissions/validation.service.js";

const submission = {
  id: "submission-test",
  headCommitSha: "abc123",
  status: "SUBMITTED",
  repository: {
    installation: {
      suspendedAt: null,
    },
  },
};

const createdRun = {
  id: "00000000-0000-4000-8000-000000000001",
};

describe("Submission validation service", () => {
  beforeEach(() => {
    submissionFindMock.mockReset();
    activeRunFindMock.mockReset();
    runCreateMock.mockReset();
    runUpdateMock.mockReset();
    submissionUpdateMock.mockReset();
    submissionUpdateManyMock.mockReset();
    transactionMock.mockReset();
    queueAddMock.mockReset();

    submissionFindMock.mockResolvedValue(submission);
    activeRunFindMock.mockResolvedValue(null);
    runCreateMock.mockResolvedValue(createdRun);
    runUpdateMock.mockResolvedValue({});
    submissionUpdateMock.mockResolvedValue({});
    submissionUpdateManyMock.mockResolvedValue({ count: 1 });
    queueAddMock.mockResolvedValue({});

    transactionMock.mockImplementation(async (callback) =>
      callback({
        validationRun: {
          create: runCreateMock,
        },
        submission: {
          update: submissionUpdateMock,
        },
      }),
    );
  });

  it("rejects a missing submission", async () => {
    submissionFindMock.mockResolvedValue(null);

    await expect(
      enqueueSubmissionValidation("submission-test"),
    ).rejects.toThrow("Submission not found.");

    expect(activeRunFindMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("rejects a submission that is not SUBMITTED", async () => {
    submissionFindMock.mockResolvedValue({
      ...submission,
      status: "DRAFT",
    });

    await expect(
      enqueueSubmissionValidation("submission-test"),
    ).rejects.toThrow("Submission is not eligible for validation.");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("rejects a suspended GitHub installation", async () => {
    submissionFindMock.mockResolvedValue({
      ...submission,
      repository: {
        installation: {
          suspendedAt: new Date(),
        },
      },
    });

    await expect(
      enqueueSubmissionValidation("submission-test"),
    ).rejects.toThrow("GitHub installation is suspended.");

    expect(activeRunFindMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("reuses an active validation run", async () => {
    const activeRun = { id: "active-run-test" };

    submissionFindMock.mockResolvedValue({
  ...submission,
  status: "VALIDATING",
});
    activeRunFindMock.mockResolvedValue(activeRun);

    await expect(
      enqueueSubmissionValidation("submission-test"),
    ).resolves.toEqual(activeRun);

    expect(activeRunFindMock).toHaveBeenCalledWith({
      where: {
        submissionId: "submission-test",
        commitSha: "abc123",
        status: { in: ["QUEUED", "RUNNING"] },
      },
      select: { id: true },
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("creates a run, updates submission status, and enqueues the job", async () => {
    await expect(
      enqueueSubmissionValidation("submission-test"),
    ).resolves.toEqual(createdRun);

    expect(transactionMock).toHaveBeenCalledTimes(1);

    expect(runCreateMock).toHaveBeenCalledWith({
      data: {
        submissionId: "submission-test",
        commitSha: "abc123",
      },
      select: { id: true },
    });

    expect(submissionUpdateMock).toHaveBeenCalledWith({
      where: { id: "submission-test" },
      data: { status: "VALIDATING" },
    });

    expect(queueAddMock).toHaveBeenCalledWith(
      "validate-submission",
      {
        submissionId: "submission-test",
        validationRunId: createdRun.id,
      },
      { jobId: createdRun.id },
    );

    expect(runUpdateMock).not.toHaveBeenCalled();
    expect(submissionUpdateManyMock).not.toHaveBeenCalled();
  });

  it("marks the run failed and restores submission status if enqueue fails", async () => {
    queueAddMock.mockRejectedValue(new Error("Redis unavailable"));

    await expect(
      enqueueSubmissionValidation("submission-test"),
    ).rejects.toThrow("Unable to enqueue validation.");

    expect(runUpdateMock).toHaveBeenCalledWith({
      where: { id: createdRun.id },
      data: {
        status: "FAILED",
        completedAt: expect.any(Date),
        errorCode: "QUEUE_ENQUEUE_FAILED",
      },
    });

    expect(submissionUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "submission-test",
        status: "VALIDATING",
      },
      data: { status: "SUBMITTED" },
    });
  });
});
