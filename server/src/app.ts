import "dotenv/config";
import express from "express";
import { HealthResponseSchema } from "@haki/schemas";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import submissionsRoutes from "./modules/submissions/submissions.routes.js";
import reviewsRoutes from "./modules/reviews/reviews.routes.js";
import repositoriesRoutes from "./modules/repositories/repositories.routes.js";
import githubRoutes from "./modules/github/github.routes.js";

const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (!frontendOrigin) {
  throw new Error("FRONTEND_ORIGIN is not configured.");
}

const app = express();

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api/v1/github/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/repositories", repositoriesRoutes);
app.use("/api/v1/github", githubRoutes);
app.use("/api/v1/submissions", submissionsRoutes);
app.use("/api/v1/submissions", reviewsRoutes);

app.get("/api/v1/health", (_req, res) => {
  const response = {
    success: true,
    data: {
      service: "HAKI API",
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(HealthResponseSchema.parse(response));
});

export default app;
