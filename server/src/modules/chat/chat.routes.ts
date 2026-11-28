import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { chatWithGemini } from "./chat.controller.js";

const router = Router();
router.use(authenticateAccessToken);
router.post("/", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }), chatWithGemini);

export default router;
