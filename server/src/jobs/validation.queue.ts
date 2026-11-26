import { Queue } from "bullmq";
import { redisConnection } from "./redis.connection.js";

export const VALIDATION_QUEUE_NAME = "validation";

export interface ValidationJobData {
  submissionId: string;
  validationRunId: string;
}

export const validationQueue = new Queue<ValidationJobData>(
  VALIDATION_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        age: 7 * 24 * 60 * 60,
      },
      removeOnFail: false,
    },
  },
);