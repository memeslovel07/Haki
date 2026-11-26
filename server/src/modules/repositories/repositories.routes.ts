import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { getRepository, listRepositories, listRepositoryBranches } from "./repositories.controller.js";

const router = Router();
router.get("/", authenticateAccessToken, listRepositories);
router.get("/:repositoryId/branches", authenticateAccessToken, listRepositoryBranches);
router.get("/:repositoryId", authenticateAccessToken, getRepository);

export default router;
