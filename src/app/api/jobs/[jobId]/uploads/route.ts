import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createUpload, getJobForUser } from "@/lib/jobs";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJobForUser(jobId, session.user.id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    fileName: string;
    size: number;
    type: string;
    sortOrder?: number;
  };

  if (!body.fileName || !body.size) {
    return NextResponse.json({ error: "Invalid file metadata" }, { status: 400 });
  }

  if (!body.type?.startsWith("video/")) {
    return NextResponse.json({ error: "Only video files are supported" }, { status: 400 });
  }

  const safeName = body.fileName.replace(/[^\w.\-()+ ]/g, "_");
  const storagePath = `${session.user.id}/${jobId}/${nanoid(10)}-${safeName}`;
  const supabase = getServiceSupabase();

  const { data: signed, error: signError } = await supabase.storage
    .from("memories")
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (signError || !signed) {
    return NextResponse.json(
      { error: signError?.message || "Could not create upload URL" },
      { status: 500 }
    );
  }

  const upload = await createUpload({
    jobId,
    userId: session.user.id,
    storagePath,
    fileName: body.fileName,
    mimeType: body.type,
    sizeBytes: body.size,
    sortOrder: body.sortOrder ?? 0,
  });

  return NextResponse.json({
    upload,
    signedUrl: signed.signedUrl,
    token: signed.token,
    path: signed.path,
  });
}
