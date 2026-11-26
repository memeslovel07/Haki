import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  updateMock,
  findMock,
  submissionUpdateMock,
  transactionMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  findMock: vi.fn(),
  submissionUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    validationRun: {
      update: updateMock,
      findUniqueOrThrow: findMock,
    },
    submission: {
      updateMany: submissionUpdateMock,
    },
    $transaction: transactionMock,
  },
}));
import { processValidationJob } from "../src/jobs/validation.processor.js";

describe("Validation processor retries", () => {
  beforeEach(() => {
    submissionUpdateMock.mockResolvedValue({});
    updateMock.mockReset();
    findMock.mockReset();

    updateMock.mockResolvedValue({});
    findMock.mockRejectedValue(new Error("temporary failure"));
  });

  it("does not mark a run FAILED before the final attempt", async () => {
    await expect(
      processValidationJob(
        {
          submissionId: "submission-test",
          validationRunId: "00000000-0000-4000-8000-000000000001",
        },
        {
          attemptsMade: 0,
          maxAttempts: 3,
        },
      ),
    ).rejects.toThrow("Validation processor failed.");

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0].data.status).toBe("RUNNING");
  });

  it("marks a run FAILED on the final attempt", async () => {
    await expect(
      processValidationJob(
        {
          submissionId: "submission-test",
          validationRunId: "00000000-0000-4000-8000-000000000002",
        },
        {
          attemptsMade: 2,
          maxAttempts: 3,
        },
      ),
    ).rejects.toThrow("Validation processor failed.");

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[1][0].data.status).toBe("FAILED");
    expect(updateMock.mock.calls[1][0].data.errorCode).toBe(
      "VALIDATION_PROCESSOR_FAILED",
    );
  });
});