
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createRefreshToken(
  userId: string,
  familyId?: string
) {
  // Generate a cryptographically secure opaque token.
  const token = randomBytes(32).toString("base64url");

  // Store only its SHA-256 hash.
  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_MS
  );

  const record = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ...(familyId ? { familyId } : {}),
    },
    select: {
      familyId: true,
      expiresAt: true,
    },
  });

  // Return the raw token only to the caller.
  return {
    token,
    familyId: record.familyId,
    expiresAt: record.expiresAt,
  };
}

export async function revokeRefreshTokenFamily(
  rawToken: string
): Promise<void> {
  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { familyId: true },
  });

  if (!token) {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: {
      familyId: token.familyId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}