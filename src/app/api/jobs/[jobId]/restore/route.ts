import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, restoreRecapVersion, updateJob } from "@/lib/jobs";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job || job.status !== "completed") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    generation?: number;
  };
  const generation = Number(body.generation);
  if (!Number.isFinite(generation) || generation < 1) {
    return NextResponse.json({ error: "generation required" }, { status: 400 });
  }

  const recap = await restoreRecapVersion(jobId, session.user.id, generation);
  if (!recap) {
    return NextResponse.json(
      { error: "Version not found or media missing" },
      { status: 404 }
    );
  }

  await updateJob(jobId, session.user.id, {
    recap_generation: generation,
  });

  return NextResponse.json({ ok: true, generation, recap });
}

export const runtime = "nodejs";
