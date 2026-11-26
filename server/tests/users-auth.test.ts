import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createAccessToken } from "../src/modules/auth/access-token.service.js";
import { SignJWT } from "jose";

const email = `auth-test-${randomUUID()}@example.com`;

let userId: string;
let accessToken: string;

describe("GET /api/v1/users/me", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Authentication Test User",
      },
      select: { id: true },
    });

    userId = user.id;
    accessToken = await createAccessToken(userId);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email },
    });

    await prisma.$disconnect();
  });

  it("rejects requests without an access token", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects malformed access tokens", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

 it("accepts a valid access token and returns the current user", async () => {
  const response = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.id).toBe(userId);
  expect(response.body.data.email).toBe(email);
  expect(response.body.data.name).toBe("Authentication Test User");
  expect(response.body.data).not.toHaveProperty("passwordHash");
});

it("rejects an expired but correctly signed access token", async () => {
  const now = Math.floor(Date.now() / 1000);

  const expiredToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(Buffer.from(process.env.JWT_ACCESS_SECRET!, "base64url"));

  const response = await request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${expiredToken}`)
    .expect(401);

  expect(response.body.error.code).toBe("UNAUTHORIZED");
});

it("rejects access for a soft-deleted user", async () => {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  try {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);

    expect(response.body.success).toBe(false);
  } finally {
    // Restore the test account, even if the assertion fails.
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
  }
});

});