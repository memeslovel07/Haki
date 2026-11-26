import type { NextFunction, Request, Response } from "express";

export function validateRequestOrigin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN;
  const requestOrigin = req.get("Origin");

  if (!allowedOrigin) {
    console.error("FRONTEND_ORIGIN is not configured.");

    return res.status(500).json({
      success: false,
      error: {
        code: "SERVER_CONFIGURATION_ERROR",
        message: "Server configuration error.",
      },
    });
  }

  if (requestOrigin !== allowedOrigin) {
    return res.status(403).json({
      success: false,
      error: {
        code: "INVALID_ORIGIN",
        message: "Request origin is not allowed.",
      },
    });
  }

  next();
}