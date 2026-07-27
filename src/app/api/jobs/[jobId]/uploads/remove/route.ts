import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJobForUser } from "@/lib/jobs";
import { getServiceSupabase } from "@/lib/supabase/admin";

type Params = { params: Promise<{ jobId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");
  if (!uploadId) {
    return NextResponse.json({ error: "uploadId required" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: upload, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("job_id", jobId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !upload) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  await supabase.storage.from("memories").remove([upload.storage_path]);
  await supabase.from("uploads").delete().eq("id", uploadId);

  return NextResponse.json({ ok: true });
}
