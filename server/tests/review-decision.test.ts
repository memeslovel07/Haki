import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";

const email = `review-decision-${randomUUID()}@example.com`;

let userId: string;
let accessToken: string;
let teamId: string;
let repositoryId: string;

const createdSubmissionIds: string[] = [];

const headCommitSha = "b".repeat(40);

async function createSubmission(status: "IN_REVIEW" | "DRAFT" = "IN_REVIEW") {
  const submission = await prisma.submission.create({
    data: {
      repositoryId,
      submittedById: userId,
      title: "Review Decision Test",
      sourceBranch: "feature/review",
      targetBranch: "main",
      baseCommitSha: "a".repeat(40),
      headCommitSha,
      status,
    },
    select: { id: true },
  });

  createdSubmissionIds.push(submission.id);
  return submission.id;
}

describe("POST /api/v1/submissions/:submissionId/reviews", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, name: "Review Decision Test User" },
      select: { id: true },
    });

    userId = user.id;
    accessToken = await createAccessToken(userId);

    const team = await prisma.team.create({
      data: {
        name: "Review Decision Test Team",
        slug: `review-decision-${randomUUID()}`,
      },
      select: { id: true },
    });

    teamId = team.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "REVIEWER",
        status: "ACTIVE",
      },
    });

    const installation = await prisma.gitHubInstallation.create({
      data: {
        installationId: BigInt(Date.now()),
        accountId: BigInt(Date.now() + 1),
        accountLogin: "review-decision-test",
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
        name: "review-decision-repo",
        fullName: "review-decision-test/review-decision-repo",
        ownerLogin: "review-decision-test",
        defaultBranch: "main",
        htmlUrl: "https://github.com/review-decision-test/review-decision-repo",
      },
      select: { id: true },
    });

    repositoryId = repository.id;
  });

  afterAll(async () => {
    if (createdSubmissionIds.length) {
      await prisma.reviewComment.deleteMany({
        where: {
          review: { submissionId: { in: createdSubmissionIds } },
        },
      });

      await prisma.review.deleteMany({
        where: { submissionId: { in: createdSubmissionIds } },
      });

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
      .post(`/api/v1/submissions/${submissionId}/reviews`)
      .send({ decision: "APPROVED" })
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects users who are not team members", async () => {
    const submissionId = await createSubmission();

    const outsider = await prisma.user.create({
      data: {
        email: `review-decision-outsider-${randomUUID()}@example.com`,
        name: "Review Decision Outsider",
      },
    });

    const outsiderToken = await createAccessToken(outsider.id);

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/reviews`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ decision: "APPROVED" })
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
      data: { role: "DEVELOPER" },
    });

    try {
      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/reviews`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ decision: "APPROVED" })
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role: "REVIEWER" },
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
        .post(`/api/v1/submissions/${submissionId}/reviews`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ decision: "APPROVED" })
        .expect(403);

      expect(response.body.error.code).toBe("FORBIDDEN");
    } finally {
      await prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("rejects malformed submission IDs", async () => {
    const response = await request(app)
      .post("/api/v1/submissions/not-a-uuid/reviews")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "APPROVED" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_SUBMISSION_ID");
  });

  it("returns 404 for a nonexistent submission", async () => {
    const response = await request(app)
      .post(`/api/v1/submissions/${randomUUID()}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "APPROVED" })
      .expect(404);

    expect(response.body.error.code).toBe("SUBMISSION_NOT_FOUND");
  });

  it("rejects invalid decisions", async () => {
    const submissionId = await createSubmission();

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "INVALID" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_REVIEW_DECISION");
  });

  it("rejects non-string review bodies", async () => {
    const submissionId = await createSubmission();

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "APPROVED", body: 123 })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_REVIEW_BODY");
  });

  it("rejects submissions outside IN_REVIEW", async () => {
    const submissionId = await createSubmission("DRAFT");

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "APPROVED" })
      .expect(409);

    expect(response.body.error.code).toBe("INVALID_STATE");
  });

  it.each(["APPROVED", "CHANGES_REQUESTED", "REJECTED", "COMMENTED"] as const)(
    "persists the %s decision against the current commit SHA",
    async (decision) => {
      const submissionId = await createSubmission();

      const response = await request(app)
        .post(`/api/v1/submissions/${submissionId}/reviews`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ decision, body: "Test review" })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.decision).toBe(decision);
      expect(response.body.data.reviewId).toBeTruthy();

      const review = await prisma.review.findUnique({
        where: { id: response.body.data.reviewId },
        select: {
          submissionId: true,
          reviewerId: true,
          decision: true,
          reviewedCommitSha: true,
          body: true,
        },
      });

      expect(review).toMatchObject({
        submissionId,
        reviewerId: userId,
        decision,
        reviewedCommitSha: headCommitSha,
        body: "Test review",
      });
    },
  );
});