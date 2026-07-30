import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, listUploads, updateJob, enqueueJob } from "@/lib/jobs";
import { processJob } from "@/lib/process-job";
import {
  deductCreditsForJob,
  finalizeJobCredits,
  getBillingSummary,
} from "@/lib/billing/credits";
import { creditsForBytes } from "@/lib/billing/config";
import { logError } from "@/lib/logger";

type Params = { params: Promise<{ jobId: string }> };

/**
 * Remix an existing job with a new mood/music without re-uploading.
 * Charges a reduced remix fee (half credits, min 10).
 */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const userId = session.user.id;
  const email = session.user.email;
  const job = await getJobForUser(jobId, userId);
  if (!job || job.status !== "completed") {
    return NextResponse.json(
      { error: "Only completed recaps can be remixed" },
      { status: 400 }
    );
  }
  const uploads = await listUploads(jobId, userId);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Source videos missing" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    mood?: string;
    musicMode?: "none" | "manual" | "auto";
    trackId?: string | null;
    outputQuality?: "fhd" | "uhd";
  };

  const summary = await getBillingSummary(userId, email);
  const isPro = Boolean(
    summary.subscription &&
      ["active", "trialing"].includes(summary.subscription.status)
  );

  const remixKey = `${jobId}:remix:${Date.now()}`;
  const amount = Math.max(
    10,
    Math.ceil(creditsForBytes(job.total_bytes || 0) * 0.5)
  );

  try {
    await deductCreditsForJob({ userId, email, jobId: remixKey, amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing error";
    if (message === "insufficient_credits") {
      return NextResponse.json(
        { error: "Not enough credits", creditsRequired: amount },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await updateJob(jobId, userId, {
    status: "queued",
    stage: "queued",
    progress: 2,
    error: null,
    credits_charged: amount,
    recap_options: {
      musicMode: body.musicMode || job.recap_options?.musicMode || "auto",
      trackId: body.trackId ?? job.recap_options?.trackId ?? null,
      mood: (body.mood as never) || job.recap_options?.mood || "joyful",
      outputQuality:
        isPro && body.outputQuality === "uhd"
          ? "uhd"
          : job.recap_options?.outputQuality || "fhd",
      folder: job.folder || job.recap_options?.folder || null,
      maxSeconds: job.recap_options?.maxSeconds ?? null,
    },
  });
  await enqueueJob(jobId, userId);

  after(async () => {
    try {
      const result = await processJob(jobId, userId);
      if (result == null) {
        await updateJob(jobId, userId, {
          status: "queued",
          stage: "queued",
          progress: 3,
        }).catch(() => undefined);
        return;
      }
      await finalizeJobCredits({
        userId,
        email,
        jobId: remixKey,
        outcome: "consumed",
      });
    } catch (error) {
      logError("remix failed", {
        jobId,
        error: error instanceof Error ? error.message : "unknown",
      });
      await finalizeJobCredits({
        userId,
        email,
        jobId: remixKey,
        outcome: "restored",
      }).catch(() => undefined);
    }
  });

  return NextResponse.json({ ok: true, status: "queued", creditsCharged: amount });
}

export const runtime = "nodejs";
export const maxDuration = 300;
