
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { createAccessToken } from "./access-token.service.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function rotateRefreshToken(rawToken: string) {
  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            deletedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!existing) {
      return null;
    }

    const now = new Date();

    // A previously consumed token was reused.
    // Revoke every remaining token in this session family.
    if (existing.revokedAt) {
      await tx.refreshToken.updateMany({
        where: {
          familyId: existing.familyId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      return null;
    }

    if (existing.expiresAt <= now || existing.user.deletedAt) {
      if (existing.user.deletedAt) {
        await tx.refreshToken.updateMany({
          where: {
            familyId: existing.familyId,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
      }

      return null;
    }

    // Conditional update ensures this token can only be
    // consumed once, including concurrent requests.
    const consumed = await tx.refreshToken.updateMany({
      where: {
        id: existing.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    if (consumed.count !== 1) {
      await tx.refreshToken.updateMany({
        where: {
          familyId: existing.familyId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      return null;
    }

    const newRawToken = randomBytes(32).toString("base64url");

    const newTokenHash = createHash("sha256")
      .update(newRawToken)
      .digest("hex");

    const newExpiresAt = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_MS
    );

    await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        familyId: existing.familyId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    // Generate the access token before committing.
    // If signing fails, the transaction rolls back.
    const accessToken = await createAccessToken(existing.userId);

    return {
      accessToken,
      refreshToken: newRawToken,
      expiresAt: newExpiresAt,
      user: {
        id: existing.user.id,
        name: existing.user.name,
        email: existing.user.email,
        createdAt: existing.user.createdAt,
      },
    };
    }, { maxWait: 10_000 });
}
