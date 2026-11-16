import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import app from "./app.js";

const PORT = Number(process.env.PORT ?? 5000);

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