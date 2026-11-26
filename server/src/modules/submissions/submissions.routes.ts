import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import {
  triggerSubmissionValidation,
  getSubmissionValidation,
  createSubmission,
  downloadSubmissionPatch,
} from "./submissions.controller.js";

const router = Router();

router.post("/repositories/:repositoryId", authenticateAccessToken, createSubmission);
router.get("/:submissionId/patch", authenticateAccessToken, downloadSubmissionPatch);

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
