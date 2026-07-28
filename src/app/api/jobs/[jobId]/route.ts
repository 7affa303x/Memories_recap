import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, getRecap, listUploads } from "@/lib/jobs";
import { signedRecapUrl } from "@/lib/supabase/admin";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uploads = await listUploads(jobId, session.user.id);
  const recap = await getRecap(jobId, session.user.id);

  let landscapeUrl: string | null = null;
  let verticalUrl: string | null = null;
  if (recap?.landscape_path) {
    try {
      landscapeUrl = await signedRecapUrl(recap.landscape_path);
    } catch {
      landscapeUrl = null;
    }
  }
  if (recap?.vertical_path) {
    try {
      verticalUrl = await signedRecapUrl(recap.vertical_path);
    } catch {
      verticalUrl = null;
    }
  }

  return NextResponse.json({
    job,
    uploads,
    recap: recap
      ? {
          ...recap,
          landscapeUrl,
          verticalUrl,
        }
      : null,
  });
}
