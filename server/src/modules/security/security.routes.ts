import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { chatWithGemini, importZip, reviewRepository, scanRepository } from "./security.controller.js";

const router = Router();
const chatLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const reviewLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.use(authenticateAccessToken);
router.post("/chat", chatLimit, express.json({ limit: "30kb" }), chatWithGemini);
router.post("/scan", express.json({ limit: "8mb" }), scanRepository);
router.post("/review", reviewLimit, express.json({ limit: "30kb" }), reviewRepository);
router.post("/import/zip", express.raw({ type: "application/zip", limit: "10mb" }), importZip);
export default router;
