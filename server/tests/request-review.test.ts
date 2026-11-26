import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";

const email = `request-review-${randomUUID()}@example.com`;

let userId: string;
let accessToken: string;
let teamId: string;
let repositoryId: string;

const createdSubmissionIds: string[] = [];

const headCommitSha = "b".repeat(40);

async function createSubmission(
  status: "SUBMITTED" | "DRAFT" | "VALIDATING" = "SUBMITTED",
  validationSha?: string,
  validationStatus: "COMPLETED" | "FAILED" = "COMPLETED",
) {
  const submission = await prisma.submission.create({
    data: {
      repositoryId,
      submittedById: userId,
      title: "Request Review Test",
      sourceBranch: "feature/review",
      targetBranch: "main",
      baseCommitSha: "a".repeat(40),
      headCommitSha,
      status,
    },
    select: { id: true },
  });

  createdSubmissionIds.push(submission.id);

  if (validationSha) {
    await prisma.validationRun.create({
      data: {
        submissionId: submission.id,
        commitSha: validationSha,
        status: validationStatus,
      },
    });
  }

  return submission.id;
}

describe("POST /api/v1/submissions/:submissionId/request-review", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, name: "Request Review Test User" },
      select: { id: true },
    });

    userId = user.id;
    accessToken = await createAccessToken(userId);

    const team = await prisma.team.create({
      data: {
        name: "Request Review Test Team",
        slug: `request-review-${randomUUID()}`,
      },
      select: { id: true },
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
        accountLogin: "request-review-test",
        accountType: "USER",
        teamId,
      },
      select: { id: true },
    });

    const repository = await prisma.repository.create({
      data: {
        githubRepoId: BigInt(Date.now() + 2),
        teamId,
        installationId: installation.id,
        name: "review-test-repo",
        fullName: "request-review-test/review-test-repo",
        ownerLogin: "request-review-test",
        defaultBranch: "main",
        htmlUrl: "https://github.com/request-review-test/review-test-repo",
      },
      select: { id: true },
    });

    repositoryId = repository.id;
  });

  afterAll(async () => {
    if (createdSubmissionIds.length) {
      await prisma.validationFinding.deleteMany({
        where: {
          validationRun: {
            submissionId: { in: createdSubmissionIds },
          },
        },
      });

      await prisma.validationRun.deleteMany({
        where: {
          submissionId: { in: createdSubmissionIds },
        },
      });

      await prisma.submission.deleteMany({
        where: { id: { in: createdSubmissionIds } },
      });
    }

    await prisma.repository.deleteMany({ where: { teamId } });
    await prisma.gitHubInstallation.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("rejects requests without an access token", async () => {
    const submissionId = await createSubmission();

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/request-review`)
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects users who are not team members", async () => {
    const submissionId = await createSubmission();

    const outsider = await prisma.user.create({
      data: {
        email: `review-outsider-${randomUUID()}@example.com`,
        name: "Review Outsider",
      },
    });

    const outsiderToken = await createAccessToken(outsider.id);

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/request-review`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("rejects members with unauthorized roles", async () => {
    const submissionId = await createSubmission();

    await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role: "REVIEWER" },
    });

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/request-review`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role: "DEVELOPER" },
      });
    }
  });

  it("rejects suspended memberships", async () => {
    const submissionId = await createSubmission();

    await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { status: "SUSPENDED" },
    });

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/request-review`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("returns 404 for a nonexistent submission", async () => {
    const response = await request(app)
      .post(`/api/v1/submissions/${randomUUID()}/request-review`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed submission IDs", async () => {
    const response = await request(app)
      .post("/api/v1/submissions/not-a-uuid/request-review")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_REQUEST");
  });

  it("rejects submissions that are not SUBMITTED", async () => {
    const submissionId = await createSubmission("DRAFT");

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/request-review`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    expect(response.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects submissions without a completed validation", async () => {
    const submissionId = await createSubmission();

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/request-review`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    expect(response.body.error.code).toBe("VALIDATION_REQUIRED");
  });

  it("rejects validation runs for a different commit SHA", async () => {
    const submissionId = await createSubmission(
      "SUBMITTED",
      "c".repeat(40),
    );

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/request-review`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    expect(response.body.error.code).toBe("VALIDATION_REQUIRED");
  });

  it("rejects failed validation runs", async () => {
    const submissionId = await createSubmission(
      "SUBMITTED",
      headCommitSha,
      "FAILED",
    );

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/request-review`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    expect(response.body.error.code).toBe("VALIDATION_REQUIRED");
  });

  it("allows a developer to request review after matching validation", async () => {
    const submissionId = await createSubmission(
      "SUBMITTED",
      headCommitSha,
    );

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/request-review`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("IN_REVIEW");

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true },
    });

    expect(submission?.status).toBe("IN_REVIEW");
  });
});