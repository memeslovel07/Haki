import express from "express";

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "HAKI API",
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  });
});

const server = app.listen(PORT, () => {
  console.log(`HAKI API running at http://localhost:${PORT}`);
});

process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
