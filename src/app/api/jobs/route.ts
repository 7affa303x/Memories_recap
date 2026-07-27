import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createJob } from "@/lib/jobs";
import { estimateProcessingSeconds } from "@/lib/types";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    files?: { name: string; size: number; type: string }[];
  };

  const files = body.files ?? [];
  if (files.length === 0) {
    return NextResponse.json({ error: "Add at least one video" }, { status: 400 });
  }
  if (files.length > 20) {
    return NextResponse.json({ error: "Maximum 20 videos per recap" }, { status: 400 });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 5 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "Maximum 5 GB per recap" }, { status: 400 });
  }

  const job = await createJob({
    userId: session.user.id,
    email: session.user.email,
    totalBytes,
    fileCount: files.length,
    etaSeconds: estimateProcessingSeconds(totalBytes, files.length),
  });

  return NextResponse.json({ job });
}
