
import type { Request, Response } from "express";
import argon2 from "argon2";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
} from "@haki/schemas";
import { createAccessToken } from "./access-token.service.js";
import { createRefreshToken } from "./refresh-token.service.js";
import { rotateRefreshToken } from "./refresh-token-rotation.service.js";
import { revokeRefreshTokenFamily } from "./refresh-token.service.js";
import { prisma } from "../../lib/prisma.js";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function registerUser(req: Request, res: Response) {
  const validation = RegisterRequestSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid registration data.",
        issues: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    });
  }

  const { name, email, password } = validation.data;

  try {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        success: false,
        error: {
          code: "REGISTRATION_CONFLICT",
          message: "Unable to register with these details.",
        },
      });
    }

    console.error("Registration failed.");

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}


export async function loginUser(req: Request, res: Response) {
  const validation = LoginRequestSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid login data.",
        issues: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    });
  }

  const { email, password } = validation.data;

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    }

    const accessToken = await createAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.cookie("haki_refresh", refreshToken.token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/auth",
  maxAge: refreshToken.expiresAt.getTime() - Date.now(),
});

  return res.status(200).json({
  success: true,
  data: {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
  },
});
 } catch {
  console.error("Login failed.");

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
}
}


export async function refreshSession(req: Request, res: Response) {
  const rawToken = req.cookies?.haki_refresh;
 
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/v1/auth",
  };

  if (typeof rawToken !== "string" || !rawToken) {
    res.clearCookie("haki_refresh", cookieOptions);

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_REFRESH_TOKEN",
        message: "Refresh token is missing or invalid.",
      },
    });
  }

  try {
    const result = await rotateRefreshToken(rawToken);
   

    if (!result) {
      res.clearCookie("haki_refresh", cookieOptions);

      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Refresh token is missing or invalid.",
        },
      });
    }

    res.cookie("haki_refresh", result.refreshToken, {
      ...cookieOptions,
      maxAge: result.expiresAt.getTime() - Date.now(),
    });

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        tokenType: "Bearer",
        expiresIn: 900,
      },
    });
  } catch (error) {
  console.error(
    "Refresh failed:",
    error instanceof Error ? `${error.name}: ${error.message}\n${error.stack || ""}` : String(error)
  );
   

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}

export async function logoutUser(req: Request, res: Response) {
  const rawToken = req.cookies?.haki_refresh;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/v1/auth",
  };

  try {
    if (typeof rawToken === "string" && rawToken) {
      await revokeRefreshTokenFamily(rawToken);
    }

    res.clearCookie("haki_refresh", cookieOptions);

    return res.status(204).send();
  } catch {
    console.error("Logout failed.");

    res.clearCookie("haki_refresh", cookieOptions);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  }
}
