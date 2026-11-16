import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";

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