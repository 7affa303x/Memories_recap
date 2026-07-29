import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, getRecap, setRecapRating } from "@/lib/jobs";

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

  const existing = await getRecap(jobId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Recap not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { rating?: number };
  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be 1–5" },
      { status: 400 }
    );
  }

  const recap = await setRecapRating(jobId, session.user.id, rating);
  return NextResponse.json({ ok: true, rating: recap?.rating });
}

export const runtime = "nodejs";
