import { Router } from "express";
import { authenticateAccessToken } from "../../middleware/auth.middleware.js";
import { requestReview } from "./reviews.controller.js";

const router = Router();

router.post(
  "/:submissionId/request-review",
  authenticateAccessToken,
  requestReview
);

export default router;