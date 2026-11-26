import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import {
  triggerSubmissionValidation,
  getSubmissionValidation,
} from "./submissions.controller.js";

const router = Router();

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