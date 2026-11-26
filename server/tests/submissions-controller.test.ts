import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";
import { validationQueue } from "../src/jobs/validation.queue.js";

const email = `submission-controller-${randomUUID()}@example.com`;

let userId: string;
let accessToken: string;
let submissionId: string;
let teamId: string;
let validationRunId: string | undefined;

describe("POST /api/v1/submissions/:submissionId/validate", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, name: "Submission Test User" },
      select: { id: true },
    });

    userId = user.id;
    accessToken = await createAccessToken(userId);

    const team = await prisma.team.create({
      data: {
        name: "Submission Test Team",
        slug: `submission-test-${randomUUID()}`,
      },
    });

    teamId = team.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "DEVELOPER",
        status: "ACTIVE",
      },
    });

    const installation = await prisma.gitHubInstallation.create({
      data: {
        installationId: BigInt(Date.now()),
        accountId: BigInt(Date.now() + 1),
        accountLogin: "submission-test",
        accountType: "USER",
        teamId,
      },
    });

    const repository = await prisma.repository.create({
      data: {
        githubRepoId: BigInt(Date.now() + 2),
        teamId,
        installationId: installation.id,
        name: "test-repo",
        fullName: "submission-test/test-repo",
        ownerLogin: "submission-test",
        defaultBranch: "main",
        htmlUrl: "https://github.com/submission-test/test-repo",
      },
    });

    const submission = await prisma.submission.create({
      data: {
        repositoryId: repository.id,
        submittedById: userId,
        title: "Controller Test Submission",
        sourceBranch: "feature/test",
        targetBranch: "main",
        baseCommitSha: "a".repeat(40),
        headCommitSha: "b".repeat(40),
        status: "SUBMITTED",
      },
      select: { id: true },
    });

    submissionId = submission.id;
  });



  afterAll(async () => {

    if (validationRunId) {
  const job = await validationQueue.getJob(validationRunId);

  if (job) {
    await job.remove();
  }

  await prisma.validationFinding.deleteMany({
    where: { validationRunId },
  });

  await prisma.validationRun.deleteMany({
    where: { id: validationRunId },
  });
}

    await prisma.submission.deleteMany({
      where: { id: submissionId },
    });

    await prisma.repository.deleteMany({
      where: { teamId },
    });

    await prisma.gitHubInstallation.deleteMany({
      where: { teamId },
    });

    await prisma.teamMember.deleteMany({
      where: { teamId },
    });

    await prisma.team.deleteMany({
      where: { id: teamId },
    });

    await prisma.user.deleteMany({
      where: { id: userId },
    });

    await prisma.$disconnect();

    await validationQueue.close();

  });

  it("rejects requests without an access token", async () => {
    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/validate`)
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects users who are not team members", async () => {
    const outsider = await prisma.user.create({
      data: {
        email: `outsider-${randomUUID()}@example.com`,
        name: "Outsider",
      },
    });

    const outsiderToken = await createAccessToken(outsider.id);

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/validate`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.user.delete({
        where: { id: outsider.id },
      });
    }
  });

  it("rejects a member with an unauthorized role", async () => {
    await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId },
      },
      data: { role: "REVIEWER" },
    });

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/validate`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.teamMember.update({
        where: {
          teamId_userId: { teamId, userId },
        },
        data: { role: "DEVELOPER" },
      });
    }
  });

  it("rejects a suspended team membership", async () => {
    await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId },
      },
      data: { status: "SUSPENDED" },
    });

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/validate`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.teamMember.update({
        where: {
          teamId_userId: { teamId, userId },
        },
        data: { status: "ACTIVE" },
      });
    }
  });

    it("returns 404 for a nonexistent submission", async () => {
    const response = await request(app)
      .post(`/api/v1/submissions/${randomUUID()}/validate`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects a submission ID that is not a UUID", async () => {
    const response = await request(app)
      .post("/api/v1/submissions/not-a-uuid/validate")
      .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
expect(response.body.success).toBe(false);
expect(response.body.error.code).toBe("INVALID_REQUEST");
  });

  it("allows an authorized developer to trigger validation", async () => {
  const response = await request(app)
    .post(`/api/v1/submissions/${submissionId}/validate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(202);

  expect(response.body.success).toBe(true);
  expect(response.body.data.id).toBeDefined();

  validationRunId = response.body.data.id;

  const run = await prisma.validationRun.findUnique({
    where: { id: validationRunId },
  });

  expect(run).not.toBeNull();
  expect(run?.submissionId).toBe(submissionId);
  expect(run?.commitSha).toBe("b".repeat(40));
  expect(run?.status).toBe("QUEUED");

  const job = await validationQueue.getJob(validationRunId);

  expect(job).toBeDefined();
  expect(job?.data.submissionId).toBe(submissionId);
  expect(job?.data.validationRunId).toBe(validationRunId);
});


describe("GET /api/v1/submissions/:submissionId/validation", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app)
      .get(`/api/v1/submissions/${submissionId}/validation`)
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the latest validation run for an authorized member", async () => {
    const response = await request(app)
      .get(`/api/v1/submissions/${submissionId}/validation`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(validationRunId);
    expect(response.body.data.findings).toBeDefined();
    expect(response.body.data).not.toHaveProperty("reportStorageKey");

for (const finding of response.body.data.findings) {
  expect(finding).not.toHaveProperty("rawSecret");
}
  });

  it("returns null when no validation run exists", async () => {
  const submissionWithoutRun = await prisma.submission.create({
    data: {
      repositoryId: (
        await prisma.repository.findFirstOrThrow({
          where: { teamId },
          select: { id: true },
        })
      ).id,
      submittedById: userId,
      title: "Submission Without Validation",
      sourceBranch: "feature/no-validation",
      targetBranch: "main",
      baseCommitSha: "c".repeat(40),
      headCommitSha: "d".repeat(40),
      status: "SUBMITTED",
    },
    select: { id: true },
  });

  try {
    const response = await request(app)
      .get(`/api/v1/submissions/${submissionWithoutRun.id}/validation`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  } finally {
    await prisma.submission.delete({
      where: { id: submissionWithoutRun.id },
    });
  }
});

  it("rejects a user who is not a team member", async () => {
    const outsider = await prisma.user.create({
      data: {
        email: `validation-outsider-${randomUUID()}@example.com`,
        name: "Validation Outsider",
      },
    });

    const outsiderToken = await createAccessToken(outsider.id);

    try {
      const response = await request(app)
        .get(`/api/v1/submissions/${submissionId}/validation`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.user.delete({
        where: { id: outsider.id },
      });
    }
  });

  it("rejects a malformed submission ID", async () => {
    const response = await request(app)
      .get("/api/v1/submissions/not-a-uuid/validation")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_REQUEST");
  });
});});