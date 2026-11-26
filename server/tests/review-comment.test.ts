import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";

const email = `review-comment-${randomUUID()}@example.com`;

let userId: string;
let accessToken: string;
let teamId: string;
let repositoryId: string;

const createdSubmissionIds: string[] = [];
const createdReviewIds: string[] = [];

const headCommitSha = "c".repeat(40);

async function createSubmission(status: "IN_REVIEW" | "DRAFT" = "IN_REVIEW") {
  const submission = await prisma.submission.create({
    data: {
      repositoryId,
      submittedById: userId,
      title: "Review Comment Test",
      sourceBranch: "feature/comment",
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

async function createReview(submissionId: string) {
  const review = await prisma.review.create({
    data: {
      submissionId,
      reviewerId: userId,
      decision: "COMMENTED",
      reviewedCommitSha: headCommitSha,
      body: "Test review",
    },
    select: { id: true },
  });

  createdReviewIds.push(review.id);
  return review.id;
}

describe("POST /api/v1/submissions/:submissionId/reviews/:reviewId/comments", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, name: "Review Comment Test User" },
      select: { id: true },
    });

    userId = user.id;
    accessToken = await createAccessToken(userId);

    const team = await prisma.team.create({
      data: {
        name: "Review Comment Test Team",
        slug: `review-comment-${randomUUID()}`,
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
        accountLogin: "review-comment-test",
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
        name: "review-comment-repo",
        fullName: "review-comment-test/review-comment-repo",
        ownerLogin: "review-comment-test",
        defaultBranch: "main",
        htmlUrl: "https://github.com/review-comment-test/review-comment-repo",
      },
      select: { id: true },
    });

    repositoryId = repository.id;
  });

  afterAll(async () => {
    if (createdSubmissionIds.length) {
      await prisma.reviewComment.deleteMany({
        where: { review: { submissionId: { in: createdSubmissionIds } } },
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
        where: { submissionId: { in: createdSubmissionIds } },
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
    const reviewId = await createReview(submissionId);

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews/${reviewId}/comments`)
      .send({ filePath: "src/app.ts", line: 10, body: "Comment" })
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects malformed submission IDs", async () => {
    const response = await request(app)
      .post(`/api/v1/submissions/not-a-uuid/reviews/${randomUUID()}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filePath: "src/app.ts", line: 10, body: "Comment" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_SUBMISSION_ID");
  });

  it("rejects malformed review IDs", async () => {
    const submissionId = await createSubmission();

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews/not-a-uuid/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filePath: "src/app.ts", line: 10, body: "Comment" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_REVIEW_ID");
  });

  it("rejects invalid file paths", async () => {
    const submissionId = await createSubmission();
    const reviewId = await createReview(submissionId);

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews/${reviewId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filePath: " ", line: 10, body: "Comment" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_FILE_PATH");
  });

  it("rejects invalid line numbers", async () => {
    const submissionId = await createSubmission();
    const reviewId = await createReview(submissionId);

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews/${reviewId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filePath: "src/app.ts", line: 0, body: "Comment" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_LINE");
  });

  it("rejects invalid comment bodies", async () => {
    const submissionId = await createSubmission();
    const reviewId = await createReview(submissionId);

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews/${reviewId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ filePath: "src/app.ts", line: 10, body: " " })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_COMMENT_BODY");
  });

  it("persists a comment against the review and author", async () => {
    const submissionId = await createSubmission();
    const reviewId = await createReview(submissionId);

    const response = await request(app)
      .post(`/api/v1/submissions/${submissionId}/reviews/${reviewId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        filePath: "src/app.ts",
        line: 10,
        body: "Consider simplifying this function.",
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.commentId).toBeTruthy();

    const comment = await prisma.reviewComment.findUnique({
      where: { id: response.body.data.commentId },
      select: {
        reviewId: true,
        authorId: true,
        filePath: true,
        line: true,
        body: true,
      },
    });

    expect(comment).toMatchObject({
      reviewId,
      authorId: userId,
      filePath: "src/app.ts",
      line: 10,
      body: "Consider simplifying this function.",
    });
  });
});