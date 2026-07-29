import { NextResponse } from "next/server";
import {
  dequeueJob,
  getJobForUser,
  listQueuedJobs,
  updateJob,
} from "@/lib/jobs";
import { processJob } from "@/lib/process-job";
import { finalizeJobCredits } from "@/lib/billing/credits";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.SETUP_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queued = await listQueuedJobs(3);
  const results: unknown[] = [];

  for (const item of queued) {
    const job = await getJobForUser(item.jobId, item.userId);
    if (!job) {
      await dequeueJob(item.jobId);
      continue;
    }
    if (job.status === "completed" || job.status === "failed") {
      await dequeueJob(item.jobId);
      continue;
    }
    // Only pick up stuck queued jobs older than 2 minutes
    const age = Date.now() - new Date(job.updated_at).getTime();
    if (job.status !== "queued" || age < 120_000) continue;

    try {
      await updateJob(item.jobId, item.userId, {
        status: "analyzing",
        stage: "analyzing",
        progress: 5,
      });
      await processJob(item.jobId, item.userId);
      if (job.notify_email) {
        await finalizeJobCredits({
          userId: item.userId,
          email: job.notify_email,
          jobId: item.jobId,
          outcome: "consumed",
        });
      }
      results.push({ jobId: item.jobId, ok: true });
    } catch (error) {
      if (job.notify_email) {
        await finalizeJobCredits({
          userId: item.userId,
          email: job.notify_email,
          jobId: item.jobId,
          outcome: "restored",
        }).catch(() => undefined);
      }
      results.push({
        jobId: item.jobId,
        ok: false,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }

  // TTL cleanup: remove expired output files metadata marker
  const supabase = getServiceSupabase();
  // Lightweight: scan a sample is expensive; rely on expires_at checks at read time.
  logInfo("cron_process", { picked: results.length });

  return NextResponse.json({ ok: true, results, cleanedHint: true, supabase: Boolean(supabase) });
}
