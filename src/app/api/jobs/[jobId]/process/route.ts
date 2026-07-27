import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, listUploads, updateJob } from "@/lib/jobs";
import { processJob } from "@/lib/process-job";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
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
    return NextResponse.json({ ok: true, status: job.status, alreadyRunning: true });
  }

  const uploads = await listUploads(jobId);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Upload videos first" }, { status: 400 });
  }

  await updateJob(jobId, {
    status: "analyzing",
    stage: "analyzing",
    progress: 5,
    error: null,
  });

  const userId = session.user.id;

  after(async () => {
    try {
      await processJob(jobId, userId);
    } catch (error) {
      console.error("processJob failed", error);
    }
  });

  return NextResponse.json({ ok: true, status: "analyzing" });
}
