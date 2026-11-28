import { Router } from "express";
import {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from "./auth.controller.js";

import {
  loginRateLimiter,
  refreshRateLimiter,
  registrationRateLimiter,
  passwordResetRateLimiter,
} from "../../middleware/auth-rate-limit.middleware.js";

import { validateRequestOrigin } from "../../middleware/csrf.middleware.js";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";

import {
  startGitHubOAuth,
  startGitHubLink,
  handleGitHubCallback,
} from "./github-oauth.controller.js";
import { requestPasswordReset, resetPassword } from "./password-reset.controller.js";

const router = Router();

router.post(
  "/register",
  validateRequestOrigin,
  registrationRateLimiter,
  registerUser
);

router.post(
  "/login",
  validateRequestOrigin,
  loginRateLimiter,
  loginUser
);

router.post(
  "/refresh",
  validateRequestOrigin,
  refreshRateLimiter,
  refreshSession
);

router.post(
  "/logout",
  validateRequestOrigin,
  logoutUser
);

router.post("/password/forgot", validateRequestOrigin, passwordResetRateLimiter, requestPasswordReset);
router.post("/password/reset", validateRequestOrigin, passwordResetRateLimiter, resetPassword);
router.post("/github/link", validateRequestOrigin, authenticateAccessToken, startGitHubLink);

router.get("/github", startGitHubOAuth);
router.get("/github/callback", handleGitHubCallback);

export default router;
