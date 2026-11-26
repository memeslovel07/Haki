import { Worker } from "bullmq";
import {
  VALIDATION_QUEUE_NAME,
  type ValidationJobData,
} from "./validation.queue.js";
import { redisConnection } from "./redis.connection.js";
import { prisma } from "../lib/prisma.js";
import { processValidationJob } from "./validation.processor.js";

const worker = new Worker<ValidationJobData>(
  VALIDATION_QUEUE_NAME,
async (job) => {
  console.log(`Processing validation job: ${job.id}`);

  return processValidationJob(job.data, {
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 1,
  });
},
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  console.log(`Validation job completed: ${job.id}`);
});

worker.on("failed", (job) => {
  console.error(`Validation job failed: ${job?.id ?? "unknown"}`);
});

worker.on("error", () => {
  console.error("Validation worker connection or runtime error.");
});

async function shutdown(signal: string) {
  console.log(`Worker shutting down (${signal}).`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));