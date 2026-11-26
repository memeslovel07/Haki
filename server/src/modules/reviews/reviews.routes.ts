import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { requestReview } from "./reviews.controller.js";
import { submitReview } from "./review-decision.controller.js";
import { getSubmissionReviewHistory } from "./review-history.controller.js";
import { addReviewComment } from "./review-comment.controller.js";

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

router.get(
  "/:submissionId/reviews",
  authenticateAccessToken,
  getSubmissionReviewHistory,
);

router.post(
  "/:submissionId/reviews/:reviewId/comments",
  authenticateAccessToken,
  addReviewComment,
);

export default router;