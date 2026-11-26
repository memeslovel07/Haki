import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { completeGitHubSetup, getInstallUrl, githubWebhook } from "./github.controller.js";

const router = Router();
router.get("/install-url", authenticateAccessToken, getInstallUrl);
router.get("/setup", completeGitHubSetup);
router.post("/webhook", githubWebhook);

export default router;
