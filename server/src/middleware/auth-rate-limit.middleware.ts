import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";

function createRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,

    handler: (_req: Request, res: Response) => {
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        },
      });
    },
  });
}

export const registrationRateLimiter = createRateLimiter(
  60 * 60 * 1000,
  5
);

export const loginRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  10
);

export const refreshRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  30
);