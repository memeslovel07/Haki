import "dotenv/config";
import express from "express";
import { HealthResponseSchema } from "@haki/schemas";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import submissionsRoutes from "./modules/submissions/submissions.routes.js";
import reviewsRoutes from "./modules/reviews/reviews.routes.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
import githubRoutes from "./modules/github/github.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import teamRoutes from "./modules/teams/teams.routes.js";
import { isTransientDatabaseError } from "./lib/database-errors.js";
import { prisma } from "./lib/prisma.js";

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

app.use((req, res, next) => {
  if (req.method === "POST" && /^\/api\/v1\/repositories\/[0-9a-f-]+\/push$/i.test(req.path)) {
    return express.json({ limit: "35mb" })(req, res, next);
  }
  return next();
});
app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buffer) => {
    if (req.url?.split("?", 1)[0] === "/api/v1/github/webhooks") {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(cookieParser());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/submissions", submissionsRoutes);
app.use("/api/v1/submissions", reviewsRoutes);
app.use("/api/v1/repositories", workspaceRoutes);
app.use("/api/v1/github", githubRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/teams", teamRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isTransientDatabaseError(error)) {
    return res.status(503).json({
      success: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "Database connection is temporarily unavailable. Please retry shortly." },
    });
  }

  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  return res.status(status).json({
    success: false,
    error: { code: status === 500 ? "INTERNAL_SERVER_ERROR" : "INVALID_REQUEST", message: status === 500 ? "An unexpected error occurred." : "The request could not be processed." },
  });
});

app.get("/api/v1/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return res.status(503).json({
      success: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "Database connection is temporarily unavailable." },
    });
  }

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
