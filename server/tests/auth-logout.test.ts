
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash, randomUUID } from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createRefreshToken } from "../src/modules/auth/refresh-token.service.js";

const email = `logout-test-${randomUUID()}@example.com`;
const frontendOrigin = process.env.FRONTEND_ORIGIN!;

let userId: string;
let firstRefreshToken: string;
let secondRefreshToken: string;
let familyId: string;

describe("Authentication: logout", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Logout Test User",
      },
      select: { id: true },
    });

    userId = user.id;

    const first = await createRefreshToken(userId);
    const second = await createRefreshToken(userId, first.familyId);

    firstRefreshToken = first.token;
    secondRefreshToken = second.token;
    familyId = first.familyId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email },
    });

    await prisma.$disconnect();
  });

  it("revokes the entire token family and rejects subsequent refresh attempts", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", frontendOrigin)
      .set("Cookie", `haki_refresh=${firstRefreshToken}`)
      .expect(204);

    const cookieHeader = response.headers["set-cookie"];
    expect(cookieHeader).toBeDefined();

    const cookieString = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : cookieHeader;

    expect(cookieString).toContain("haki_refresh=");
    expect(cookieString).toMatch(/Expires=/i);

    const tokens = await prisma.refreshToken.findMany({
      where: { familyId },
    });

    expect(tokens).toHaveLength(2);

    for (const token of tokens) {
      expect(token.revokedAt).toBeInstanceOf(Date);
    }

    const secondTokenHash = createHash("sha256")
      .update(secondRefreshToken)
      .digest("hex");

    const secondTokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: secondTokenHash },
    });

    expect(secondTokenRecord?.revokedAt).toBeInstanceOf(Date);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", frontendOrigin)
      .set("Cookie", `haki_refresh=${secondRefreshToken}`)
      .expect(401);
  });
});
