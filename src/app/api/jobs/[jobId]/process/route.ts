import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import {
  enqueueJob,
  getJobForUser,
  listUploads,
  updateJob,
} from "@/lib/jobs";
import { processJob } from "@/lib/process-job";
import {
  deductCreditsForJob,
  finalizeJobCredits,
} from "@/lib/billing/credits";
import { creditsForBytes } from "@/lib/billing/config";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Params) {
  const rl = rateLimit({
    key: `process:${clientKey(request)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const userId = session.user.id;
  const email = session.user.email;
  const job = await getJobForUser(jobId, userId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (job.status === "completed") {
    return NextResponse.json({ ok: true, status: job.status });
  }

  if (
    job.status === "queued" ||
    job.status === "analyzing" ||
    job.status === "selecting" ||
    job.status === "building" ||
    job.status === "rendering"
  ) {
    return NextResponse.json({
      ok: true,
      status: job.status,
      alreadyRunning: true,
    });
  }

  const uploads = await listUploads(jobId, userId);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Upload videos first" }, { status: 400 });
  }

  let body: {
    musicMode?: "none" | "manual" | "auto";
    trackId?: string | null;
    mood?: "joyful" | "nostalgic" | "chill" | "epic" | null;
    outputQuality?: "fhd" | "uhd" | null;
    folder?: string | null;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  await updateJob(jobId, userId, {
    recap_options: {
      musicMode: body.musicMode || "auto",
      trackId: body.trackId ?? null,
      mood: body.mood || "joyful",
      outputQuality: body.outputQuality === "uhd" ? "uhd" : "fhd",
      folder: body.folder || null,
    },
    folder: body.folder || null,
  });

  const amount = creditsForBytes(job.total_bytes || 0);

  // Retry after failure: credits already reserved/restored flow — deduct is idempotent per jobId
  try {
    await deductCreditsForJob({ userId, email, jobId, amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing error";
    if (message === "insufficient_credits") {
      return NextResponse.json(
        {
          error: "Not enough credits",
          creditsRequired: amount,
          balanceHint: "Buy credits on the pricing page, then retry.",
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await updateJob(jobId, userId, {
    status: "queued",
    stage: "queued",
    progress: 3,
    error: null,
    credits_charged: amount,
  });
  await enqueueJob(jobId, userId);

  after(async () => {
    try {
      await updateJob(jobId, userId, {
        status: "analyzing",
        stage: "analyzing",
        progress: 5,
      });
      await processJob(jobId, userId);
      await finalizeJobCredits({
        userId,
        email,
        jobId,
        outcome: "consumed",
      });
    } catch (error) {
      logError("processJob failed", {
        jobId,
        userId,
        error: error instanceof Error ? error.message : "unknown",
      });
      try {
        await finalizeJobCredits({
          userId,
          email,
          jobId,
          outcome: "restored",
        });
      } catch (restoreError) {
        logError("credit restore failed", {
          jobId,
          error:
            restoreError instanceof Error ? restoreError.message : "unknown",
        });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    status: "queued",
    creditsCharged: amount,
  });
}
