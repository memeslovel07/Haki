import { validationQueue } from "./validation.queue.js";

async function main() {
  const job = await validationQueue.add("test-validation", {
  submissionId: "phase4-test-submission",
  validationRunId: "phase4-test-validation-run",
});
  console.log(`Test job queued: ${job.id}`);

  await validationQueue.close();
}

main().catch(async () => {
  console.error("Failed to enqueue validation test job.");
  await validationQueue.close();
  process.exitCode = 1;
});