import { NextResponse } from "next/server";
import {
  cleanupExpiredRecaps,
  clearProcessingClaim,
  dequeueJob,
  getJobForUser,
  listProcessingClaims,
  listQueuedJobs,
  updateJob,
} from "@/lib/jobs";
import { processJob } from "@/lib/process-job";
import { finalizeJobCredits } from "@/lib/billing/credits";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { logInfo } from "@/lib/logger";
import type { JobStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const STUCK_MID_MS = 10 * 60 * 1000;
const STUCK_FAIL_MS = 45 * 60 * 1000;
const STUCK_QUEUED_MS = 2 * 60 * 1000;

const MID_PROCESS: JobStatus[] = [
  "analyzing",
  "selecting",
  "building",
  "rendering",
];

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.SETUP_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function restoreCreditsIfPossible(
  userId: string,
  email: string | null | undefined,
  jobId: string
) {
  if (!email) return;
  await finalizeJobCredits({
    userId,
    email,
    jobId,
    outcome: "restored",
  }).catch(() => undefined);
}

async function consumeCreditsIfPossible(
  userId: string,
  email: string | null | undefined,
  jobId: string
) {
  if (!email) return;
  await finalizeJobCredits({
    userId,
    email,
    jobId,
    outcome: "consumed",
  }).catch(() => undefined);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: unknown[] = [];

  // Recover mid-process jobs via processing/{jobId}.json claims
  const claims = await listProcessingClaims(20);
  for (const claim of claims) {
    const job = await getJobForUser(claim.jobId, claim.userId);
    if (!job) {
      await clearProcessingClaim(claim.jobId).catch(() => undefined);
      continue;
    }
    if (job.status === "completed" || job.status === "failed") {
      await clearProcessingClaim(claim.jobId).catch(() => undefined);
      await dequeueJob(claim.jobId).catch(() => undefined);
      continue;
    }

    const age = Date.now() - new Date(job.updated_at).getTime();
    const isMid = MID_PROCESS.includes(job.status);

    if (!isMid) continue;

    if (age >= STUCK_FAIL_MS) {
      await updateJob(claim.jobId, claim.userId, {
        status: "failed",
        stage: "failed",
        progress: 100,
        error: "Processing timed out (stuck recovery)",
        eta_seconds: 0,
      });
      await restoreCreditsIfPossible(
        claim.userId,
        job.notify_email,
        claim.jobId
      );
      await clearProcessingClaim(claim.jobId).catch(() => undefined);
      await dequeueJob(claim.jobId).catch(() => undefined);
      results.push({
        jobId: claim.jobId,
        ok: false,
        action: "fail_timeout",
      });
      continue;
    }

    if (age >= STUCK_MID_MS) {
      try {
        await updateJob(claim.jobId, claim.userId, {
          status: "queued",
          stage: "queued",
          progress: 0,
          error: null,
        });
        await updateJob(claim.jobId, claim.userId, {
          status: "analyzing",
          stage: "analyzing",
          progress: 5,
        });
        await processJob(claim.jobId, claim.userId);
        await consumeCreditsIfPossible(
          claim.userId,
          job.notify_email,
          claim.jobId
        );
        results.push({
          jobId: claim.jobId,
          ok: true,
          action: "reprocess_stuck",
        });
      } catch (error) {
        await restoreCreditsIfPossible(
          claim.userId,
          job.notify_email,
          claim.jobId
        );
        results.push({
          jobId: claim.jobId,
          ok: false,
          action: "reprocess_stuck",
          error: error instanceof Error ? error.message : "failed",
        });
      }
    }
  }

  // Pick up stuck queued jobs
  const queued = await listQueuedJobs(3);
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

    const age = Date.now() - new Date(job.updated_at).getTime();

    if (MID_PROCESS.includes(job.status)) {
      // Mid-process jobs in queue are handled via processing claims above;
      // if claim missing but age > fail TTL, fail them here too.
      if (age >= STUCK_FAIL_MS) {
        await updateJob(item.jobId, item.userId, {
          status: "failed",
          stage: "failed",
          progress: 100,
          error: "Processing timed out (stuck recovery)",
          eta_seconds: 0,
        });
        await restoreCreditsIfPossible(
          item.userId,
          job.notify_email,
          item.jobId
        );
        await dequeueJob(item.jobId).catch(() => undefined);
        await clearProcessingClaim(item.jobId).catch(() => undefined);
        results.push({
          jobId: item.jobId,
          ok: false,
          action: "fail_timeout_queue",
        });
      } else if (age >= STUCK_MID_MS) {
        try {
          await updateJob(item.jobId, item.userId, {
            status: "analyzing",
            stage: "analyzing",
            progress: 5,
          });
          await processJob(item.jobId, item.userId);
          await consumeCreditsIfPossible(
            item.userId,
            job.notify_email,
            item.jobId
          );
          results.push({
            jobId: item.jobId,
            ok: true,
            action: "reprocess_mid_queue",
          });
        } catch (error) {
          await restoreCreditsIfPossible(
            item.userId,
            job.notify_email,
            item.jobId
          );
          results.push({
            jobId: item.jobId,
            ok: false,
            action: "reprocess_mid_queue",
            error: error instanceof Error ? error.message : "failed",
          });
        }
      }
      continue;
    }

    // Only pick up stuck queued jobs older than 2 minutes
    if (job.status !== "queued" || age < STUCK_QUEUED_MS) continue;

    try {
      await updateJob(item.jobId, item.userId, {
        status: "analyzing",
        stage: "analyzing",
        progress: 5,
      });
      await processJob(item.jobId, item.userId);
      await consumeCreditsIfPossible(item.userId, job.notify_email, item.jobId);
      results.push({ jobId: item.jobId, ok: true, action: "process_queued" });
    } catch (error) {
      await restoreCreditsIfPossible(item.userId, job.notify_email, item.jobId);
      results.push({
        jobId: item.jobId,
        ok: false,
        action: "process_queued",
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }

  // TTL cleanup: delete expired recap media objects (supabase + blob:), then clear paths.
  let ttlCleaned = 0;
  try {
    ttlCleaned = await cleanupExpiredRecaps(40);
  } catch (error) {
    logInfo("cron_ttl_cleanup_error", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const supabase = getServiceSupabase();
  logInfo("cron_process", { picked: results.length, ttlCleaned });

  return NextResponse.json({
    ok: true,
    results,
    ttlCleaned,
    cleanedHint: true,
    supabase: Boolean(supabase),
  });
}
