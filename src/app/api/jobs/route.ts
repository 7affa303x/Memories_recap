import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getServiceSupabase } from "@/lib/supabase/admin";
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

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: session.user.id,
      status: "uploading",
      stage: "uploading",
      progress: 0,
      eta_seconds: estimateProcessingSeconds(totalBytes, files.length),
      total_bytes: totalBytes,
      file_count: files.length,
      notify_email: session.user.email,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}
