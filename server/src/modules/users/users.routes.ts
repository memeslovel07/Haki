import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { getCurrentUser } from "./users.controller.js";

const router = Router();

router.get("/me", authenticateAccessToken, getCurrentUser);

export default router;