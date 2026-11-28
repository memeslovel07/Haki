import { Router } from "express";
import { getSubmissionDiff, listRepositoryBranches, listRepositoryCommits } from "./github-refs.controller.js";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import {
  triggerSubmissionValidation,
  getSubmissionValidation,
  listGovernanceRepositories,
  listSubmissions,
  createSubmission,
} from "./submissions.controller.js";

const router = Router();

router.get("/repositories", authenticateAccessToken, listGovernanceRepositories);
router.get("/repositories/:repoId/branches", authenticateAccessToken, listRepositoryBranches);
router.get("/repositories/:repoId/commits", authenticateAccessToken, listRepositoryCommits);
router.get("/:submissionId/diff", authenticateAccessToken, getSubmissionDiff);
router.get("/", authenticateAccessToken, listSubmissions);
router.post("/", authenticateAccessToken, createSubmission);

router.post(
  "/:submissionId/validate",
  authenticateAccessToken,
  triggerSubmissionValidation
);

router.get(
  "/:submissionId/validation",
  authenticateAccessToken,
  getSubmissionValidation
);

export default router;
