import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobForUser, getRecap, listUploads } from "@/lib/jobs";
import { publicRecapUrl } from "@/lib/supabase/admin";

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

  return NextResponse.json({
    job,
    uploads,
    recap: recap
      ? {
          ...recap,
          landscapeUrl: recap.landscape_path
            ? publicRecapUrl(recap.landscape_path)
            : null,
          verticalUrl: recap.vertical_path
            ? publicRecapUrl(recap.vertical_path)
            : null,
        }
      : null,
  });
}
