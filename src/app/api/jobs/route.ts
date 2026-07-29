import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createJob } from "@/lib/jobs";
import { creditsForBytes } from "@/lib/billing/config";
import { getBillingSummary } from "@/lib/billing/credits";
import { estimateProcessingSeconds } from "@/lib/types";
import {
  friendlyFileLimitMessage,
  isLikelyVideoFile,
  MAX_BYTES_PER_JOB,
  MAX_FILE_BYTES,
  MAX_FILES_PER_JOB,
} from "@/lib/media";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rl = rateLimit({
    key: `jobs:${clientKey(request)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    files?: { name: string; size: number; type: string }[];
    title?: string;
  };

  const files = body.files ?? [];
  if (files.length === 0) {
    return NextResponse.json({ error: "Add at least one video" }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_JOB) {
    return NextResponse.json(
      { error: friendlyFileLimitMessage("count") },
      { status: 400 }
    );
  }
  if (files.some((f) => !isLikelyVideoFile(f.name, f.type))) {
    return NextResponse.json(
      {
        error:
          "We need video files (mp4, mov, m4v…). If your gallery hid the type, rename to .mp4 and try again — we’ve got you.",
      },
      { status: 400 }
    );
  }
  if (files.some((f) => f.size > MAX_FILE_BYTES)) {
    return NextResponse.json(
      { error: friendlyFileLimitMessage("file") },
      { status: 400 }
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_BYTES_PER_JOB) {
    return NextResponse.json(
      { error: friendlyFileLimitMessage("total") },
      { status: 400 }
    );
  }

  const creditsRequired = creditsForBytes(totalBytes);
  const summary = await getBillingSummary(session.user.id, session.user.email);

  const job = await createJob({
    userId: session.user.id,
    email: session.user.email,
    totalBytes,
    fileCount: files.length,
    etaSeconds: estimateProcessingSeconds(totalBytes, files.length),
    title: body.title || null,
  });

  return NextResponse.json({
    job,
    billing: {
      creditsRequired,
      balance: summary.balance,
      enough: summary.balance >= creditsRequired,
    },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { listJobsForUser } = await import("@/lib/jobs");
  const jobs = await listJobsForUser(session.user.id);
  return NextResponse.json({ jobs });
}
