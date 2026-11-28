import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function sendResetEmail(email: string, name: string | null, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM;
  const origin = process.env.FRONTEND_ORIGIN;
  if (!apiKey || !from || !origin) throw new Error("Password reset email is not configured.");
  const link = new URL("/reset-password", origin);
  link.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Reset your HAKI password",
      text: `Hi ${name || "there"},\n\nUse this link to reset your HAKI password within 30 minutes:\n${link}\n\nIf you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Password reset email could not be sent.");
}

export async function requestPasswordReset(req: Request, res: Response) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Enter a valid email address." } });
  }
  if (!process.env.RESEND_API_KEY || !process.env.PASSWORD_RESET_FROM || !process.env.FRONTEND_ORIGIN) {
    return res.status(503).json({ success: false, error: { code: "EMAIL_UNAVAILABLE", message: "Password reset email is not available right now." } });
  }
  let user;
  try {
    user = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, email: true, name: true } });
  } catch {
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to request a password reset." } });
  }
  if (!user) return res.status(202).json({ success: true, data: { message: "If the account exists, a reset link will be sent." } });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  await prisma.passwordResetToken.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) } });
  let sent = false;
  try {
    await sendResetEmail(user.email, user.name, token);
    sent = true;
  } catch (error) {
    await prisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => undefined);
    console.error(error instanceof Error ? error.message : "Password reset email failed.");
  }
  if (sent) await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash: { not: tokenHash }, usedAt: null } }).catch(() => undefined);
  return res.status(202).json({ success: true, data: { message: "If the account exists, a reset link will be sent." } });
}

export async function resetPassword(req: Request, res: Response) {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "The reset link or new password is invalid. Passwords must be 12 to 128 characters." } });
  }
  const tokenHash = hashToken(token);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const now = new Date();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) return false;
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash }, select: { userId: true } });
      if (!reset) return false;
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, usedAt: null } });
      return true;
    });
    if (!result) return res.status(400).json({ success: false, error: { code: "INVALID_RESET_TOKEN", message: "This reset link is invalid or expired. Request a new one." } });
    return res.json({ success: true, data: { message: "Password updated. Sign in with your new password." } });
  } catch {
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to reset password." } });
  }
}
