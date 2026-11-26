import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import {
  triggerSubmissionValidation,
  getSubmissionValidation,
} from "./submissions.controller.js";
import {
  createSubmission,
  getSubmission,
  listSubmissions,
} from "./submission-records.controller.js";

const router = Router();

router.get("/", authenticateAccessToken, listSubmissions);
router.post("/", authenticateAccessToken, createSubmission);
router.get("/:submissionId", authenticateAccessToken, getSubmission);

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
