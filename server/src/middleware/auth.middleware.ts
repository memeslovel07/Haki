import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../modules/auth/access-token.service.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function authenticateAccessToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid access token.",
      },
    });
  }

  const userId = await verifyAccessToken(token);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired access token.",
      },
    });
  }

  req.userId = userId;

  next();
}