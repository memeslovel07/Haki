import express from "express";
import { HealthResponseSchema } from "@haki/schemas";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.use(express.json());

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

async function startServer() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  console.log("Connected to Neon PostgreSQL.");

  const server = app.listen(PORT, () => {
    console.log(`HAKI API running at http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await prisma.$disconnect();
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch(async (error) => {
  console.error("Failed to start HAKI API:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});