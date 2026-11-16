
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import { createHash, randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createRefreshToken } from "../src/modules/auth/refresh-token.service.js";

const email = `refresh-test-${randomUUID()}@example.com`;
const frontendOrigin = process.env.FRONTEND_ORIGIN!;

let userId: string;
let initialRefreshToken: string;
let rotatedRefreshToken: string;
let familyId: string;

describe("Authentication: refresh token rotation", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Refresh Test User",
      },
      select: { id: true },
    });

    userId = user.id;

    const refreshToken = await createRefreshToken(userId);

    initialRefreshToken = refreshToken.token;
    familyId = refreshToken.familyId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email },
    });

    await prisma.$disconnect();
  });

  it("rotates a valid refresh token and issues a replacement", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", frontendOrigin)
      .set("Cookie", `haki_refresh=${initialRefreshToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.tokenType).toBe("Bearer");
    expect(response.body.data.expiresIn).toBe(900);
    expect(response.body.data.user.id).toBe(userId);

    const cookieHeader = response.headers["set-cookie"];
    expect(cookieHeader).toBeDefined();

    const cookieString = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : cookieHeader;

    expect(cookieString).toContain("haki_refresh=");
    expect(cookieString).toMatch(/HttpOnly/i);

    const cookiePair = cookieString!.split(";")[0]!;
    rotatedRefreshToken = cookiePair.slice("haki_refresh=".length);

    expect(rotatedRefreshToken).toBeTruthy();
    expect(rotatedRefreshToken).not.toBe(initialRefreshToken);

    const oldTokenHash = createHash("sha256")
      .update(initialRefreshToken)
      .digest("hex");

    const newTokenHash = createHash("sha256")
      .update(rotatedRefreshToken)
      .digest("hex");

    const oldRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: oldTokenHash },
    });

    const newRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    expect(oldRecord?.revokedAt).toBeInstanceOf(Date);
    expect(newRecord).not.toBeNull();
    expect(newRecord?.revokedAt).toBeNull();
    expect(newRecord?.familyId).toBe(familyId);
  });


it("rejects an expired refresh token without issuing replacements", async () => {
  // Create a separate token family so this test does not
  // interfere with the existing rotation/reuse tests.
  const expiredToken = await createRefreshToken(userId);
  const expiredTokenHash = createHash("sha256")
    .update(expiredToken.token)
    .digest("hex");

  // Force the token to expire.
  await prisma.refreshToken.update({
    where: { tokenHash: expiredTokenHash },
    data: {
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  const familyCountBefore = await prisma.refreshToken.count({
    where: { familyId: expiredToken.familyId },
  });

  // First attempt must be rejected.
  const firstResponse = await request(app)
    .post("/api/v1/auth/refresh")
    .set("Origin", frontendOrigin)
    .set("Cookie", `haki_refresh=${expiredToken.token}`)
    .expect(401);

  expect(firstResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  expect(firstResponse.body.data?.accessToken).toBeUndefined();

  // Reusing the same expired token must also fail.
  const secondResponse = await request(app)
    .post("/api/v1/auth/refresh")
    .set("Origin", frontendOrigin)
    .set("Cookie", `haki_refresh=${expiredToken.token}`)
    .expect(401);

  expect(secondResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");

  // No replacement refresh tokens should have been created.
  const familyCountAfter = await prisma.refreshToken.count({
    where: { familyId: expiredToken.familyId },
  });

  expect(familyCountAfter).toBe(familyCountBefore);
});


  it("rejects reuse of the previous refresh token and revokes its family", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", frontendOrigin)
      .set("Cookie", `haki_refresh=${initialRefreshToken}`)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");

    const familyTokens = await prisma.refreshToken.findMany({
      where: { familyId },
    });

    expect(familyTokens.length).toBeGreaterThan(0);

    for (const token of familyTokens) {
      expect(token.revokedAt).toBeInstanceOf(Date);
    }
  });
});
