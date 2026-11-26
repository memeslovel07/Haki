import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { completeInstallation, connectRepository, getRepositorySettings, githubWebhook, listMyGitHubRepositories, listTeamRepositories, startInstallation, updateRepositorySettings } from "./github.controller.js";

const router = Router();
router.get("/installations/callback", completeInstallation);
router.post("/webhooks", githubWebhook);
router.get("/me/repositories", authenticateAccessToken, listMyGitHubRepositories);
router.post("/teams/:teamId/installations/start", authenticateAccessToken, startInstallation);
router.post("/teams/:teamId/repositories", authenticateAccessToken, connectRepository);
router.get("/teams/:teamId/repositories", authenticateAccessToken, listTeamRepositories);
router.get("/repositories/:repositoryId/settings", authenticateAccessToken, getRepositorySettings);
router.put("/repositories/:repositoryId/settings", authenticateAccessToken, updateRepositorySettings);
export default router;
