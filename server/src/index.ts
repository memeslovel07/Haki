import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import app from "./app.js";

const PORT = Number(process.env.PORT ?? 5001);

async function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`HAKI API running at http://localhost:${PORT}`);
  });

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("Connected to Neon PostgreSQL.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Database is currently unavailable; API started without database access: ${message}`);
  }

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
