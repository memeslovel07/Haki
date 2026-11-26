
import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import type { ValidationJobData } from "./validation.queue.js";
import {
  createValidationWorkspace,
  cleanupValidationWorkspace,
} from "./validation.workspace.js";
import { createInstallationAccessToken } from "../lib/github/installation-token.js";
import { downloadValidationArchive } from "./validation.github-archive.js";
import { extractValidationArchive } from "./validation.archive.js";
import { runGitleaks } from "./validation.scanner.js";
import { parseGitleaksReport } from "./validation.findings.js";
import { runSemgrep } from "./validation.semgrep.js";
import { parseSemgrepReport } from "./validation.semgrep-findings.js";
import { runTrivy } from "./validation.trivy.js";
import { parseTrivyReport } from "./validation.trivy-findings.js";

interface ValidationAttempt {
  attemptsMade: number;
  maxAttempts: number;
}

export async function processValidationJob(
  data: ValidationJobData,
  attempt: ValidationAttempt = { attemptsMade: 0, maxAttempts: 1 },
) {
  const { validationRunId, submissionId } = data;
  let workspacePath: string | undefined;
  let archivePath: string | undefined;

  await prisma.validationRun.update({
    where: { id: validationRunId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
      errorCode: null,
    },
  });

  try {
    const validationRun = await prisma.validationRun.findUniqueOrThrow({
      where: { id: validationRunId },
      include: {
        submission: {
          include: { repository: { include: { installation: true } } },
        },
      },
    });

    const submission = validationRun.submission;
    const repository = submission.repository;
    const installation = repository.installation;

    if (submission.id !== submissionId) {
      throw new Error("Submission does not match validation run.");
    }

    if (installation.suspendedAt) {
      throw new Error("GitHub installation is suspended.");
    }

    workspacePath = await createValidationWorkspace(validationRunId);
    archivePath = path.resolve(workspacePath, "..", `${validationRunId}.zip`);

    const accessToken = await createInstallationAccessToken(
      installation.installationId.toString(),
    );

    await downloadValidationArchive(
      repository.ownerLogin,
      repository.name,
      validationRun.commitSha,
      accessToken.token,
      archivePath,
    );

    await extractValidationArchive(archivePath, workspacePath);

    const gitleaksResult = await runGitleaks(workspacePath);

    if (gitleaksResult.exitCode !== 0 && gitleaksResult.exitCode !== 1) {
      throw new Error("Gitleaks scanner failed.");
    }

    const gitleaksFindings = parseGitleaksReport(gitleaksResult.report);

    const semgrepResult = await runSemgrep(workspacePath);

    if (semgrepResult.exitCode !== 0 && semgrepResult.exitCode !== 1) {
      throw new Error("Semgrep scanner failed.");
    }

    const semgrepFindings = parseSemgrepReport(semgrepResult.report);

    const trivyResult = await runTrivy(workspacePath);

    if (trivyResult.exitCode !== 0) {
      throw new Error("Trivy scanner failed.");
    }

    const trivyFindings = parseTrivyReport(trivyResult.report);

    const findings = [
      ...gitleaksFindings,
      ...semgrepFindings,
      ...trivyFindings,
    ];

    await prisma.$transaction([
      prisma.validationFinding.deleteMany({ where: { validationRunId } }),
      prisma.validationFinding.createMany({
        data: findings.map((finding) => ({
          validationRunId,
          ...finding,
        })),
      }),
      prisma.validationRun.update({
        where: { id: validationRunId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          errorCode: null,
        },
      }),
      prisma.submission.updateMany({
        where: {
          id: submissionId,
          status: "VALIDATING",
        },
        data: {
          status: "SUBMITTED",
        },
      }),
    ]);

    return {
      submissionId,
      validationRunId,
      status: "COMPLETED",
      findingsCount: findings.length,
    };
  } catch {
    const isFinalAttempt =
      attempt.attemptsMade + 1 >= attempt.maxAttempts;

    if (isFinalAttempt) {
      await prisma.$transaction([
        prisma.validationRun.update({
          where: { id: validationRunId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorCode: "VALIDATION_PROCESSOR_FAILED",
          },
        }),
        prisma.submission.updateMany({
          where: {
            id: submissionId,
            status: "VALIDATING",
          },
          data: {
            status: "SUBMITTED",
          },
        }),
      ]);
    }

    throw new Error("Validation processor failed.");
  } finally {
    try {
      if (archivePath) await rm(archivePath, { force: true });
    } catch {
      // Archive cleanup is best-effort.
    } finally {
      try {
        if (workspacePath) {
          await cleanupValidationWorkspace(workspacePath);
        }
      } catch {
        // Workspace cleanup is best-effort.
      }
    }
  }
}
