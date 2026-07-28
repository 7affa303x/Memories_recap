import { NextResponse } from "next/server";
import {
  getJobForUser,
  getRecap,
  getShareByToken,
  verifySharePassword,
} from "@/lib/jobs";
import { signedRecapUrl } from "@/lib/supabase/admin";
import { clientKey, rateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

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
  const share = await getShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  const password = new URL(request.url).searchParams.get("password");
  if (share.password_hash) {
    if (!password || !verifySharePassword(password, share.password_hash)) {
      return NextResponse.json(
        { error: "Password required", passwordRequired: true },
        { status: 401 }
      );
    }
  }

  const job = await getJobForUser(share.job_id, share.user_id);
  const recap = await getRecap(share.job_id, share.user_id);
  if (!job || job.status !== "completed" || !recap?.landscape_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const landscapeUrl = await signedRecapUrl(recap.landscape_path, 60 * 30);
  const verticalUrl = recap.vertical_path
    ? await signedRecapUrl(recap.vertical_path, 60 * 30)
    : null;

  return NextResponse.json({
    title: job.title || "Memory Recap",
    expiresAt: share.expires_at,
    landscapeUrl,
    verticalUrl,
    durationSeconds: recap.duration_seconds,
  });
}
