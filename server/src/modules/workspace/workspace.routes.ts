import { raw, Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import {
  createCommit,
  createFile,
  createRepository,
  deleteFile,
  deleteRepository,
  getRepository,
  importRepository,
  listCommits,
  listFiles,
  listRepositories,
  pushRepository,
  updateFile,
  updateRepository,
} from "./workspace.controller.js";

const router = Router();
router.use(authenticateAccessToken);
router.get("/", listRepositories);
router.post("/", createRepository);
router.post("/import", raw({ type: "application/zip", limit: "20mb" }), importRepository);
router.get("/:repoId", getRepository);
router.post("/:repoId/push", pushRepository);
router.patch("/:repoId", updateRepository);
router.delete("/:repoId", deleteRepository);
router.get("/:repoId/files", listFiles);
router.post("/:repoId/files", createFile);
router.patch("/:repoId/files/:fileId", updateFile);
router.delete("/:repoId/files/:fileId", deleteFile);
router.get("/:repoId/commits", listCommits);
router.post("/:repoId/commits", createCommit);

export default router;
