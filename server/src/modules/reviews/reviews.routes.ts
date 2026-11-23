import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { requestReview } from "./reviews.controller.js";
import { submitReview } from "./review-decision.controller.js";

const router = Router();

router.post(
  "/:submissionId/request-review",
  authenticateAccessToken,
  requestReview
);

router.post(
  "/:submissionId/reviews",
  authenticateAccessToken,
  submitReview
);

export default router;