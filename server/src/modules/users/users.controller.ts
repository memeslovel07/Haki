import type { Response } from "express";
import argon2 from "argon2";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        profile: true,
        oauthAccounts: { select: { provider: true } },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User account is unavailable.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch {
    console.error("Failed to retrieve current user.");

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}

function error(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

export async function updateCurrentUser(req: AuthenticatedRequest, res: Response) {
  const { name, username, bio, location, avatarDataUrl, email } = req.body ?? {};
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 120)) return error(res, 400, "VALIDATION_ERROR", "Name must be between 1 and 120 characters.");
  if (username !== undefined && (typeof username !== "string" || username.trim().length > 40)) return error(res, 400, "VALIDATION_ERROR", "Username must be 40 characters or fewer.");
  if (bio !== undefined && (typeof bio !== "string" || bio.length > 500)) return error(res, 400, "VALIDATION_ERROR", "Bio must be 500 characters or fewer.");
  if (location !== undefined && (typeof location !== "string" || location.length > 120)) return error(res, 400, "VALIDATION_ERROR", "Location must be 120 characters or fewer.");
  if (avatarDataUrl !== undefined && (typeof avatarDataUrl !== "string" || avatarDataUrl.length > 1_400_000)) return error(res, 400, "VALIDATION_ERROR", "Avatar is invalid or too large.");

  try {
    const current = await prisma.user.findUnique({ where: { id: req.userId }, select: { profile: true, email: true } });
    if (!current) return error(res, 404, "NOT_FOUND", "Account not found.");
    if (email !== undefined && email !== current.email) return error(res, 400, "EMAIL_CHANGE_UNSUPPORTED", "Email address cannot be changed here.");
    const profile = current.profile && typeof current.profile === "object" && !Array.isArray(current.profile)
      ? current.profile as Record<string, Prisma.JsonValue>
      : {};
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        profile: {
          ...profile,
          ...(username !== undefined ? { username: username.trim() } : {}),
          ...(bio !== undefined ? { bio: bio.trim() } : {}),
          ...(location !== undefined ? { location: location.trim() } : {}),
          ...(avatarDataUrl !== undefined ? { avatarDataUrl } : {}),
        } as Prisma.InputJsonValue,
      },
      select: { id: true, name: true, email: true, emailVerifiedAt: true, createdAt: true, profile: true },
    });
    return res.json({ success: true, data: updated });
  } catch {
    return error(res, 500, "INTERNAL_SERVER_ERROR", "Unable to save account profile.");
  }
}

export async function getAccountSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { settings: true } });
    if (!user) return error(res, 404, "NOT_FOUND", "Account not found.");
    return res.json({ success: true, data: user.settings ?? {} });
  } catch {
    return error(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load account settings.");
  }
}

export async function updateAccountSettings(req: AuthenticatedRequest, res: Response) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return error(res, 400, "VALIDATION_ERROR", "Settings must be an object.");
  try {
    const settings = await prisma.user.update({
      where: { id: req.userId },
      data: { settings: req.body as Prisma.InputJsonValue },
      select: { settings: true },
    });
    return res.json({ success: true, data: settings.settings });
  } catch {
    return error(res, 500, "INTERNAL_SERVER_ERROR", "Unable to save account settings.");
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) {
    return error(res, 400, "VALIDATION_ERROR", "New password must be between 12 and 128 characters.");
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { passwordHash: true } });
    if (!user?.passwordHash) return error(res, 400, "PASSWORD_UNAVAILABLE", "This account does not use a password login.");
    if (!(await argon2.verify(user.passwordHash, currentPassword))) return error(res, 400, "INVALID_PASSWORD", "Current password is incorrect.");
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    return res.json({ success: true, data: { message: "Password updated successfully." } });
  } catch {
    return error(res, 500, "INTERNAL_SERVER_ERROR", "Unable to update password.");
  }
}
