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
    audience?: "public" | "family";
  };

  const audience =
    body.audience === "family" || body.audience === "public"
      ? body.audience
      : "public";

  // Family links default to a shorter window and encourage a password
  const expiresInDays =
    body.expiresInDays ?? (audience === "family" ? 30 : 14);

  const { token, expiresAt } = await ensureShareLink(jobId, session.user.id, {
    expiresInDays,
    password: body.password || null,
    audience,
  });

  const url = `${getAppUrl()}/s/${token}`;
  return NextResponse.json({ url, token, expiresAt, audience });
}
