import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureShareLink,
  getJobForUser,
  getShareByToken,
} from "@/lib/jobs";
import { getAppUrl } from "@/lib/billing/config";
import { parseOr400, shareCreateBodySchema } from "@/lib/validation";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job?.share_token) {
    return NextResponse.json({ url: null, viewCount: 0 });
  }
  const share = await getShareByToken(job.share_token);
  return NextResponse.json({
    url: `${getAppUrl()}/s/${job.share_token}`,
    viewCount: share?.view_count ?? 0,
    lastViewedAt: share?.last_viewed_at ?? null,
    expiresAt: share?.expires_at ?? job.share_expires_at,
  });
}

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

  const raw = await request.json().catch(() => ({}));
  const parsed = parseOr400(shareCreateBodySchema, raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, details: parsed.details },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const audience =
    body.audience === "family" || body.audience === "public"
      ? body.audience
      : "public";

  const password = body.password?.trim() || null;
  if (audience === "family" && (!password || password.length < 4)) {
    return NextResponse.json(
      { error: "Family shares need a password (at least 4 characters)" },
      { status: 400 }
    );
  }

  // Family links default to a shorter window
  const expiresInDays =
    body.expiresInDays ?? (audience === "family" ? 30 : 14);

  const { token, expiresAt } = await ensureShareLink(jobId, session.user.id, {
    expiresInDays,
    password,
    audience,
  });

  const url = `${getAppUrl()}/s/${token}`;
  return NextResponse.json({ url, token, expiresAt, audience });
}
