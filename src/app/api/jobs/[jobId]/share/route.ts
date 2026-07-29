import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureShareLink, getJobForUser } from "@/lib/jobs";
import { getAppUrl } from "@/lib/billing/config";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job || job.status !== "completed") {
    return NextResponse.json({ error: "Recap not ready" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    expiresInDays?: number;
    password?: string;
  };

  const { token, expiresAt } = await ensureShareLink(jobId, session.user.id, {
    expiresInDays: body.expiresInDays ?? 14,
    password: body.password || null,
  });

  const url = `${getAppUrl()}/s/${token}`;
  return NextResponse.json({ url, token, expiresAt });
}
