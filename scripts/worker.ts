/**
 * Background encode worker for Memories Recap.
 * Run outside Vercel (Railway / Render / Fly / VPS):
 *   npm run worker
 * Docker:
 *   docker build -f worker.Dockerfile -t memories-worker .
 *   docker run --env-file .env.local memories-worker
 */
import { processJob } from "../src/lib/process-job";
import {
  getJobForUser,
  listQueuedJobs,
  updateJob,
} from "../src/lib/jobs";
import { finalizeJobCredits } from "../src/lib/billing/credits";
import { logInfo, logError } from "../src/lib/logger";

const POLL_MS = Number(process.env.WORKER_POLL_MS || 5000);
const BATCH = Number(process.env.WORKER_BATCH || 3);

async function runWorker() {
  logInfo("worker_start", {
    message: "Starting Memories Recap Worker",
    pollMs: POLL_MS,
    batch: BATCH,
  });

  while (true) {
    try {
      const queued = await listQueuedJobs(BATCH);

      if (queued.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        continue;
      }

      for (const item of queued) {
        const job = await getJobForUser(item.jobId, item.userId);
        if (!job || job.status !== "queued") continue;

        logInfo("worker_processing", {
          jobId: item.jobId,
          userId: item.userId,
        });

        try {
          const result = await processJob(item.jobId, item.userId);
          if (result == null) {
            logInfo("worker_deferred", { jobId: item.jobId });
            continue;
          }
          if (job.notify_email) {
            await finalizeJobCredits({
              userId: item.userId,
              email: job.notify_email,
              jobId: item.jobId,
              outcome: "consumed",
            }).catch(() => undefined);
          }
          logInfo("worker_success", { jobId: item.jobId });
        } catch (error) {
          logError("worker_failed", {
            jobId: item.jobId,
            error: error instanceof Error ? error.message : "unknown",
          });

          await updateJob(item.jobId, item.userId, {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Internal processing error",
          }).catch(() => {});

          if (job.notify_email) {
            await finalizeJobCredits({
              userId: item.userId,
              email: job.notify_email,
              jobId: item.jobId,
              outcome: "restored",
            }).catch(() => undefined);
          }
        }
      }
    } catch (error) {
      logError("worker_loop_error", {
        error: error instanceof Error ? error.message : "unknown",
      });
      await new Promise((resolve) => setTimeout(resolve, POLL_MS * 2));
    }
  }
}

runWorker().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
