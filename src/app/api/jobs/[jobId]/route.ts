import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  dequeueJob,
  getJobForUser,
  getRecap,
  listUploads,
  updateJob,
} from "@/lib/jobs";
import { signedRecapUrl } from "@/lib/supabase/admin";
import { finalizeJobCredits } from "@/lib/billing/credits";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uploads = await listUploads(jobId, session.user.id);
  const recap = await getRecap(jobId, session.user.id);

  let landscapeUrl: string | null = null;
  let verticalUrl: string | null = null;
  if (recap?.landscape_path) {
    try {
      landscapeUrl = await signedRecapUrl(recap.landscape_path);
    } catch {
      landscapeUrl = null;
    }
  }
  if (recap?.vertical_path) {
    try {
      verticalUrl = await signedRecapUrl(recap.vertical_path);
    } catch {
      verticalUrl = null;
    }
  }

  return NextResponse.json({
    job,
    uploads,
    recap: recap
      ? {
          ...recap,
          landscapeUrl,
          verticalUrl,
        }
      : null,
  });
}

/** Cancel an in-progress job, or soft-hide a completed one from the dashboard. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email ?? "";
  const { jobId } = await params;
  const job = await getJobForUser(jobId, userId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (job.status === "completed") {
    const updated = await updateJob(jobId, userId, { hidden: true });
    return NextResponse.json({ ok: true, job: updated, hidden: true });
  }

  if (job.status === "cancelled" || job.status === "failed") {
    await dequeueJob(jobId).catch(() => undefined);
    const updated = await updateJob(jobId, userId, { hidden: true });
    return NextResponse.json({ ok: true, job: updated, hidden: true });
  }

  const updated = await updateJob(jobId, userId, {
    status: "cancelled",
    stage: "cancelled",
    progress: 100,
    eta_seconds: 0,
    error: "Cancelled by user",
    completed_at: new Date().toISOString(),
  });

  await dequeueJob(jobId).catch(() => undefined);

  if (email) {
    try {
      await finalizeJobCredits({
        userId,
        email,
        jobId,
        outcome: "restored",
      });
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true, job: updated });
}
