import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import {
  changePassword,
  getAccountSettings,
  getCurrentUser,
  updateAccountSettings,
  updateCurrentUser,
} from "./users.controller.js";

const router = Router();

router.get("/me", authenticateAccessToken, getCurrentUser);
router.patch("/me", authenticateAccessToken, updateCurrentUser);
router.get("/settings", authenticateAccessToken, getAccountSettings);
router.put("/settings", authenticateAccessToken, updateAccountSettings);
router.put("/password", authenticateAccessToken, changePassword);

export default router;
