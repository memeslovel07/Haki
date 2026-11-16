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

export default router;