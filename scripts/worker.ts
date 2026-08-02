import { processJob } from "../src/lib/process-job";
import { listQueuedJobs, getJobForUser, updateJob } from "../src/lib/store";
import { logInfo, logError } from "../src/lib/logger";

async function runWorker() {
  logInfo("worker_start", { message: "Starting Memories Recap Worker" });

  while (true) {
    try {
      const queued = await listQueuedJobs(5);
      
      if (queued.length === 0) {
        // No jobs, wait a bit
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      for (const item of queued) {
        const job = await getJobForUser(item.jobId, item.userId);
        
        if (!job || job.status !== "queued") continue;

        logInfo("worker_processing", { jobId: item.jobId, userId: item.userId });

        try {
          await processJob(item.jobId, item.userId);
          logInfo("worker_success", { jobId: item.jobId });
        } catch (error) {
          logError("worker_failed", { 
            jobId: item.jobId, 
            error: error instanceof Error ? error.message : "unknown" 
          });
          
          await updateJob(item.jobId, item.userId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Internal processing error"
          }).catch(() => {});
        }
      }
    } catch (error) {
      logError("worker_loop_error", { 
        error: error instanceof Error ? error.message : "unknown" 
      });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Run the worker
runWorker().catch(err => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
