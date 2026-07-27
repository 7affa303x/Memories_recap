import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, listUploads, updateJob } from "@/lib/jobs";
import { processJob } from "@/lib/process-job";
import {
  deductCreditsForJob,
  finalizeJobCredits,
} from "@/lib/billing/credits";
import { creditsForBytes } from "@/lib/billing/config";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, { params }: Params) {
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

  const amount = creditsForBytes(job.total_bytes || 0);
  try {
    await deductCreditsForJob({ userId, email, jobId, amount });
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
    status: "analyzing",
    stage: "analyzing",
    progress: 5,
    error: null,
  });

  after(async () => {
    try {
      await processJob(jobId, userId);
      await finalizeJobCredits({
        userId,
        email,
        jobId,
        outcome: "consumed",
      });
    } catch (error) {
      console.error("processJob failed", error);
      try {
        await finalizeJobCredits({
          userId,
          email,
          jobId,
          outcome: "restored",
        });
      } catch (restoreError) {
        console.error("credit restore failed", restoreError);
      }
    }
  });

  return NextResponse.json({
    ok: true,
    status: "analyzing",
    creditsCharged: amount,
  });
}
