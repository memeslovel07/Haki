import { Router } from "express";
import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { completeInstall, createInstallState } from "./installations.controller.js";
import { completeInstallation, connectRepository, getRepositorySettings, githubWebhook, listMyGitHubRepositories, listTeamRepositories, startInstallation, updateRepositorySettings } from "./github.controller.js";

const router = Router();
router.post("/install-state", authenticateAccessToken, createInstallState);
router.get("/install/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const pendingTeamInstall = state
      ? await prisma.gitHubInstallationState.findUnique({ where: { stateHash: createHash("sha256").update(state).digest("hex") }, select: { stateHash: true } })
      : null;
    if (pendingTeamInstall) return completeInstallation(req, res);
    return completeInstall(req, res);
  } catch (error) {
    return next(error);
  }
});
router.get("/installations/callback", completeInstallation);
router.post("/webhooks", githubWebhook);
router.get("/me/repositories", authenticateAccessToken, listMyGitHubRepositories);
router.post("/teams/:teamId/installations/start", authenticateAccessToken, startInstallation);
router.post("/teams/:teamId/repositories", authenticateAccessToken, connectRepository);
router.get("/teams/:teamId/repositories", authenticateAccessToken, listTeamRepositories);
router.get("/repositories/:repositoryId/settings", authenticateAccessToken, getRepositorySettings);
router.put("/repositories/:repositoryId/settings", authenticateAccessToken, updateRepositorySettings);
export default router;
