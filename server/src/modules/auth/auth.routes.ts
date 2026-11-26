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

import {
  startGitHubOAuth,
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
router.get("/github/callback", handleGitHubCallback);

export default router;