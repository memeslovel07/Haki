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
} from "../../middleware/auth-rate-limit.middleware.js";

import { validateRequestOrigin } from "../../middleware/csrf.middleware.js";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";

import {
  startGitHubOAuth,
  startGitHubAccountLink,
  handleGitHubCallback,
} from "./github-oauth.controller.js";

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

router.get("/github", startGitHubOAuth);
router.get("/github/link", authenticateAccessToken, startGitHubAccountLink);
router.get("/github/callback", handleGitHubCallback);

export default router;
