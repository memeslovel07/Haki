
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  updateMock,
  findMock,
  deleteFindingsMock,
  createFindingsMock,
  transactionMock,
  createWorkspaceMock,
  cleanupWorkspaceMock,
  tokenMock,
  downloadMock,
  extractMock,
  scannerMock,
  semgrepMock,
  trivyMock,
  submissionUpdateMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  findMock: vi.fn(),
  deleteFindingsMock: vi.fn(),
  createFindingsMock: vi.fn(),
  transactionMock: vi.fn(),
  createWorkspaceMock: vi.fn(),
  cleanupWorkspaceMock: vi.fn(),
  tokenMock: vi.fn(),
  downloadMock: vi.fn(),
  extractMock: vi.fn(),
  scannerMock: vi.fn(),
  semgrepMock: vi.fn(),
  trivyMock: vi.fn(),
  submissionUpdateMock: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    validationRun: {
      update: updateMock,
      findUniqueOrThrow: findMock,
    },
    validationFinding: {
      deleteMany: deleteFindingsMock,
      createMany: createFindingsMock,
    },
    $transaction: transactionMock,
    submission: {
  updateMany: submissionUpdateMock,
},
  },
}));

vi.mock("../src/jobs/validation.workspace.js", () => ({
  createValidationWorkspace: createWorkspaceMock,
  cleanupValidationWorkspace: cleanupWorkspaceMock,
}));

vi.mock("../src/lib/github/installation-token.js", () => ({
  createInstallationAccessToken: tokenMock,
}));

vi.mock("../src/jobs/validation.github-archive.js", () => ({
  downloadValidationArchive: downloadMock,
}));

vi.mock("../src/jobs/validation.archive.js", () => ({
  extractValidationArchive: extractMock,
}));

vi.mock("../src/jobs/validation.scanner.js", () => ({
  runGitleaks: scannerMock,
}));

vi.mock("../src/jobs/validation.semgrep.js", () => ({
  runSemgrep: semgrepMock,
}));

vi.mock("../src/jobs/validation.trivy.js", () => ({
  runTrivy: trivyMock,
}));

import { processValidationJob } from "../src/jobs/validation.processor.js";

describe("Validation processor lifecycle", () => {
  const submissionId = "submission-test";
  const validationRunId = "00000000-0000-4000-8000-000000000001";
  const workspacePath = "D:/haki-test-workspace";

  beforeEach(() => {
    vi.clearAllMocks();

    updateMock.mockResolvedValue({});
    deleteFindingsMock.mockResolvedValue({ count: 0 });
    createFindingsMock.mockResolvedValue({ count: 0 });
    transactionMock.mockImplementation((operations) => Promise.all(operations));

    createWorkspaceMock.mockResolvedValue(workspacePath);
    cleanupWorkspaceMock.mockResolvedValue(undefined);
    tokenMock.mockResolvedValue({ token: "mock-token" });
    downloadMock.mockResolvedValue(undefined);
    extractMock.mockResolvedValue(undefined);

    scannerMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
      report: "[]",
    });

    semgrepMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
      report: JSON.stringify({ results: [], errors: [] }),
    });

    trivyMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
      report: JSON.stringify({ Results: [] }),
    });

    findMock.mockResolvedValue({
      commitSha: "a".repeat(40),
      submission: {
        id: submissionId,
        repository: {
          ownerLogin: "test-owner",
          name: "test-repo",
          installation: {
            installationId: BigInt(123456),
            suspendedAt: null,
          },
        },
      },
    });
    submissionUpdateMock.mockResolvedValue({});
  });

  it("fetches, extracts, scans and completes a clean validation", async () => {
    const result = await processValidationJob({
      submissionId,
      validationRunId,
    });

    expect(result).toEqual({
      submissionId,
      validationRunId,
      status: "COMPLETED",
      findingsCount: 0,
    });

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[0][0].data.status).toBe("RUNNING");
    expect(updateMock.mock.calls[1][0].data.status).toBe("COMPLETED");
    expect(submissionUpdateMock).toHaveBeenCalledWith({
  where: {
    id: submissionId,
    status: "VALIDATING",
  },
  data: {
    status: "SUBMITTED",
  },
});

    expect(findMock).toHaveBeenCalledOnce();
    expect(createWorkspaceMock).toHaveBeenCalledWith(validationRunId);
    expect(tokenMock).toHaveBeenCalledWith("123456");

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(downloadMock.mock.calls[0][0]).toBe("test-owner");
    expect(downloadMock.mock.calls[0][1]).toBe("test-repo");
    expect(downloadMock.mock.calls[0][2]).toBe("a".repeat(40));
    expect(downloadMock.mock.calls[0][3]).toBe("mock-token");

    expect(extractMock).toHaveBeenCalledOnce();
    expect(scannerMock).toHaveBeenCalledWith(workspacePath);
    expect(semgrepMock).toHaveBeenCalledWith(workspacePath);
    expect(trivyMock).toHaveBeenCalledWith(workspacePath);

    expect(deleteFindingsMock).toHaveBeenCalledOnce();
    expect(createFindingsMock).toHaveBeenCalledOnce();
    expect(createFindingsMock.mock.calls[0][0].data).toEqual([]);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
  });

  it("persists detected Gitleaks findings and completes validation", async () => {
    scannerMock.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "",
      report: JSON.stringify([
        {
          RuleID: "haki-test-secret",
          Description: "Detects a test-only marker",
          StartLine: 1,
          File: "/repo/secret-test.txt",
          Secret: "SHOULD_NEVER_BE_PERSISTED",
          Match: "SHOULD_NEVER_BE_PERSISTED",
        },
      ]),
    });

    const result = await processValidationJob({
      submissionId,
      validationRunId,
    });

    expect(result).toEqual({
      submissionId,
      validationRunId,
      status: "COMPLETED",
      findingsCount: 1,
    });

    const persistedFindings = createFindingsMock.mock.calls[0][0].data;

    expect(persistedFindings).toHaveLength(1);
    expect(persistedFindings[0]).toMatchObject({
      validationRunId,
      tool: "gitleaks",
      ruleId: "haki-test-secret",
      severity: "HIGH",
      filePath: "secret-test.txt",
      line: 1,
    });

    expect(JSON.stringify(persistedFindings)).not.toContain(
      "SHOULD_NEVER_BE_PERSISTED",
    );

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
  });

  it("persists findings from Gitleaks, Semgrep and Trivy together", async () => {
    scannerMock.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "",
      report: JSON.stringify([
        {
          RuleID: "haki-test-secret",
          Description: "Secret detected",
          StartLine: 1,
          File: "/repo/secret.txt",
        },
      ]),
    });

    semgrepMock.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "",
      report: JSON.stringify({
        results: [
          {
            check_id: "haki-eval-usage",
            path: "/src/app.js",
            start: { line: 3 },
            extra: {
              message: "Avoid eval() because it can execute untrusted code.",
              severity: "ERROR",
            },
          },
        ],
        errors: [],
      }),
    });

    trivyMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
      report: JSON.stringify({
        Results: [
          {
            Target: "package-lock.json",
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2026-1234",
                PkgName: "test-package",
                Severity: "HIGH",
                Title: "Test vulnerability",
                Description: "Test vulnerability description",
              },
            ],
          },
        ],
      }),
    });

    const result = await processValidationJob({
      submissionId,
      validationRunId,
    });

    expect(result.findingsCount).toBe(3);

    const findings = createFindingsMock.mock.calls[0][0].data;

    expect(findings).toHaveLength(3);
    expect(findings.map((f: { tool: string }) => f.tool)).toEqual([
      "gitleaks",
      "semgrep",
      "trivy",
    ]);

    expect(findings[1]).toMatchObject({
      validationRunId,
      tool: "semgrep",
      ruleId: "haki-eval-usage",
      severity: "HIGH",
      filePath: "app.js",
      line: 3,
    });

    expect(findings[2]).toMatchObject({
      validationRunId,
      tool: "trivy",
      ruleId: "CVE-2026-1234",
      severity: "HIGH",
      filePath: "package-lock.json",
      line: null,
    });

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
  });

  it("fails validation when the Gitleaks scanner exits unexpectedly", async () => {
    scannerMock.mockResolvedValue({
      exitCode: 2,
      stdout: "",
      stderr: "scanner error",
      report: "[]",
    });

    await expect(
      processValidationJob(
        { submissionId, validationRunId },
        { attemptsMade: 0, maxAttempts: 1 },
      ),
    ).rejects.toThrow("Validation processor failed.");

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[0][0].data.status).toBe("RUNNING");
    expect(updateMock.mock.calls[1][0].data.status).toBe("FAILED");
    expect(updateMock.mock.calls[1][0].data.errorCode).toBe(
      "VALIDATION_PROCESSOR_FAILED",
    );

    expect(submissionUpdateMock).toHaveBeenCalledWith({
  where: {
    id: submissionId,
    status: "VALIDATING",
  },
  data: {
    status: "SUBMITTED",
  },
});

    expect(transactionMock).toHaveBeenCalled();
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
  });

  it("fails validation when Semgrep has an operational error", async () => {
    semgrepMock.mockResolvedValue({
      exitCode: 2,
      stdout: "",
      stderr: "scanner error",
      report: "",
    });

    await expect(
      processValidationJob(
        { submissionId, validationRunId },
        { attemptsMade: 0, maxAttempts: 1 },
      ),
    ).rejects.toThrow("Validation processor failed.");

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.calls[1][0].data.status).toBe("FAILED");

    expect(transactionMock).toHaveBeenCalled();
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
  });

  it("does not mark validation failed before the final retry", async () => {
    scannerMock.mockRejectedValue(new Error("scanner unavailable"));

    await expect(
      processValidationJob(
        { submissionId, validationRunId },
        { attemptsMade: 0, maxAttempts: 3 },
      ),
    ).rejects.toThrow("Validation processor failed.");

    expect(updateMock).toHaveBeenCalledOnce();
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
    expect(submissionUpdateMock).not.toHaveBeenCalled();
  });

  it("fails validation when Trivy has an operational error", async () => {
  trivyMock.mockResolvedValue({
    exitCode: 2,
    stdout: "",
    stderr: "scanner error",
    report: "",
  });

  await expect(
    processValidationJob(
      { submissionId, validationRunId },
      { attemptsMade: 0, maxAttempts: 1 },
    ),
  ).rejects.toThrow("Validation processor failed.");

  expect(updateMock).toHaveBeenCalledTimes(2);
  expect(updateMock.mock.calls[0][0].data.status).toBe("RUNNING");
  expect(updateMock.mock.calls[1][0].data.status).toBe("FAILED");

  expect(transactionMock).toHaveBeenCalled();
  expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
});

it("marks validation failed on the final retry attempt", async () => {
  scannerMock.mockRejectedValue(new Error("scanner unavailable"));

  await expect(
    processValidationJob(
      { submissionId, validationRunId },
      { attemptsMade: 2, maxAttempts: 3 },
    ),
  ).rejects.toThrow("Validation processor failed.");

  expect(updateMock).toHaveBeenCalledTimes(2);
  expect(updateMock.mock.calls[0][0].data.status).toBe("RUNNING");
  expect(updateMock.mock.calls[1][0].data.status).toBe("FAILED");
  expect(updateMock.mock.calls[1][0].data.errorCode).toBe(
    "VALIDATION_PROCESSOR_FAILED",
  );

  expect(submissionUpdateMock).toHaveBeenCalledWith({
  where: {
    id: submissionId,
    status: "VALIDATING",
  },
  data: {
    status: "SUBMITTED",
  },
});

  expect(transactionMock).toHaveBeenCalled();
  expect(deleteFindingsMock).not.toHaveBeenCalled();
expect(createFindingsMock).not.toHaveBeenCalled();
  expect(cleanupWorkspaceMock).toHaveBeenCalledWith(workspacePath);
});

});
