import { NextResponse } from "next/server";
import {
  getJobForUser,
  getRecap,
  getShareByToken,
  recordShareView,
  verifySharePassword,
} from "@/lib/jobs";
import { signedRecapUrl } from "@/lib/supabase/admin";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sharePasswordFromRequest } from "@/lib/share-password";
import { parseOr400, sharePasswordBodySchema } from "@/lib/validation";

type Params = { params: Promise<{ token: string }> };

async function resolveSharePayload(
  token: string,
  password: string | null | undefined
) {
  const share = await getShareByToken(token);
  if (!share) {
    return { status: 404 as const, body: { error: "Not found" } };
  }
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { status: 410 as const, body: { error: "Link expired" } };
  }

  if (share.password_hash) {
    if (!password || !verifySharePassword(password, share.password_hash)) {
      return {
        status: 401 as const,
        body: { error: "Password required", passwordRequired: true },
      };
    }
  }

  const job = await getJobForUser(share.job_id, share.user_id);
  const recap = await getRecap(share.job_id, share.user_id);
  if (!job || job.status !== "completed" || !recap?.landscape_path) {
    return { status: 404 as const, body: { error: "Not found" } };
  }

  const landscapeUrl = await signedRecapUrl(recap.landscape_path, 60 * 30);
  const verticalUrl = recap.vertical_path
    ? await signedRecapUrl(recap.vertical_path, 60 * 30)
    : null;

  const viewed = await recordShareView(token).catch(() => share);

  return {
    status: 200 as const,
    body: {
      title: job.title || "Memories Recap",
      expiresAt: share.expires_at,
      landscapeUrl,
      verticalUrl,
      durationSeconds: recap.duration_seconds,
      viewCount: viewed?.view_count ?? share.view_count ?? 0,
    },
  };
}

export async function GET(request: Request, { params }: Params) {
  const rl = rateLimit({
    key: `share:${clientKey(request)}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const url = new URL(request.url);
  // Password must not travel in the URL query string — use POST with JSON body.
  const password = sharePasswordFromRequest({
    method: "GET",
    queryPassword: url.searchParams.get("password"),
    bodyPassword: null,
  });
  const result = await resolveSharePayload(token, password);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request, { params }: Params) {
  const rl = rateLimit({
    key: `share-post:${clientKey(request)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const raw = await request.json().catch(() => ({}));
  const parsed = parseOr400(sharePasswordBodySchema, raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, details: parsed.details },
      { status: 400 }
    );
  }
  const password = sharePasswordFromRequest({
    method: "POST",
    queryPassword: null,
    bodyPassword: parsed.data.password ?? null,
  });
  const result = await resolveSharePayload(token, password);
  return NextResponse.json(result.body, { status: result.status });
}
