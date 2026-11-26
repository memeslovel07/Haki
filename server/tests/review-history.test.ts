import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";

const email = `review-history-${randomUUID()}@example.com`;

let userId: string;
let accessToken: string;
let teamId: string;
let membershipId: string;
let installationId: string;
let repositoryId: string;
let submissionId: string;
let outsiderToken: string;
let outsiderId: string;

const createdReviewIds: string[] = [];

describe("GET /api/v1/submissions/:submissionId/reviews", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, name: "Review History Tester" },
    });

    userId = user.id;
    accessToken = await createAccessToken(userId);

    const outsider = await prisma.user.create({
      data: {
        email: `review-history-outsider-${randomUUID()}@example.com`,
        name: "Outsider",
      },
    });

    outsiderId = outsider.id;
    outsiderToken = await createAccessToken(outsiderId);

    const team = await prisma.team.create({
      data: {
        name: "Review History Test Team",
        slug: `review-history-${randomUUID()}`,
      },
    });

    teamId = team.id;

    const membership = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "REVIEWER",
        status: "ACTIVE",
      },
    });

    membershipId = membership.id;

    const installation = await prisma.gitHubInstallation.create({
      data: {
        installationId: BigInt(Date.now()),
        accountId: BigInt(Date.now() + 1),
        accountLogin: "review-history-test",
        accountType: "USER",
        teamId,
      },
    });

    installationId = installation.id;

    const repository = await prisma.repository.create({
      data: {
        githubRepoId: BigInt(Date.now() + 2),
        teamId,
        installationId,
        name: "review-history-repo",
        fullName: "review-history-test/review-history-repo",
        ownerLogin: "review-history-test",
        defaultBranch: "main",
        htmlUrl: "https://github.com/review-history-test/review-history-repo",
      },
    });

    repositoryId = repository.id;

    const submission = await prisma.submission.create({
      data: {
        repositoryId,
        submittedById: userId,
        title: "Review history test submission",
        sourceBranch: "feature",
        targetBranch: "main",
        baseCommitSha: "a".repeat(40),
        headCommitSha: "b".repeat(40),
        status: "IN_REVIEW",
      },
    });

    submissionId = submission.id;
  });

  afterAll(async () => {
    await prisma.reviewComment.deleteMany({
      where: { review: { submissionId } },
    });

    await prisma.review.deleteMany({
      where: { submissionId },
    });

    if (submissionId) {
      await prisma.submission.deleteMany({
        where: { id: submissionId },
      });
    }

    if (repositoryId) {
      await prisma.repository.deleteMany({
        where: { id: repositoryId },
      });
    }

    if (installationId) {
      await prisma.gitHubInstallation.deleteMany({
        where: { id: installationId },
      });
    }

    if (membershipId) {
      await prisma.teamMember.deleteMany({
        where: { id: membershipId },
      });
    }

    if (teamId) {
      await prisma.team.deleteMany({
        where: { id: teamId },
      });
    }

    await prisma.user.deleteMany({
      where: { id: { in: [userId, outsiderId] } },
    });

    await prisma.$disconnect();
  });

  it("returns 401 without an access token", async () => {
    const response = await request(app).get(
      `/api/v1/submissions/${submissionId}/reviews`,
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for a non-member", async () => {
    const response = await request(app)
      .get(`/api/v1/submissions/${submissionId}/reviews`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 for an invalid submission ID", async () => {
    const response = await request(app)
      .get("/api/v1/submissions/invalid-id/reviews")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_SUBMISSION_ID");
  });

  it("returns 404 for a nonexistent submission", async () => {
    const response = await request(app)
      .get(`/api/v1/submissions/${randomUUID()}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SUBMISSION_NOT_FOUND");
  });

  it("returns an empty review history when no reviews exist", async () => {
    const response = await request(app)
      .get(`/api/v1/submissions/${submissionId}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.reviews).toEqual([]);
  });

  it("returns reviews with reviewer, commit SHA and comments in chronological order", async () => {
    const olderReview = await prisma.review.create({
      data: {
        submissionId,
        reviewerId: userId,
        decision: "COMMENTED",
        reviewedCommitSha: "b".repeat(40),
        body: "Initial review",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
    });

    createdReviewIds.push(olderReview.id);

    const newerReview = await prisma.review.create({
      data: {
        submissionId,
        reviewerId: userId,
        decision: "APPROVED",
        reviewedCommitSha: "b".repeat(40),
        body: "Approved",
        createdAt: new Date("2026-01-01T11:00:00.000Z"),
      },
    });

    createdReviewIds.push(newerReview.id);

    await prisma.reviewComment.create({
      data: {
        reviewId: olderReview.id,
        authorId: userId,
        filePath: "src/index.ts",
        line: 10,
        body: "Consider simplifying this function.",
      },
    });

    const response = await request(app)
      .get(`/api/v1/submissions/${submissionId}/reviews`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const reviews = response.body.data.reviews;

    expect(reviews).toHaveLength(2);
    expect(reviews[0].id).toBe(olderReview.id);
    expect(reviews[1].id).toBe(newerReview.id);

    expect(reviews[0].decision).toBe("COMMENTED");
    expect(reviews[0].reviewedCommitSha).toBe("b".repeat(40));
    expect(reviews[0].body).toBe("Initial review");
    expect(reviews[0].reviewer.id).toBe(userId);
    expect(reviews[0].reviewer.name).toBe("Review History Tester");

    expect(reviews[0].comments).toHaveLength(1);
    expect(reviews[0].comments[0].filePath).toBe("src/index.ts");
    expect(reviews[0].comments[0].line).toBe(10);
    expect(reviews[0].comments[0].body).toBe(
      "Consider simplifying this function.",
    );
    expect(reviews[0].comments[0].author.id).toBe(userId);

    expect(reviews[1].decision).toBe("APPROVED");
    expect(reviews[1].body).toBe("Approved");
    expect(reviews[1].comments).toEqual([]);

    expect(reviews[0].reviewer).not.toHaveProperty("email");
    expect(reviews[0].reviewer).not.toHaveProperty("passwordHash");
    expect(reviews[0].comments[0].author).not.toHaveProperty("email");
  });
});