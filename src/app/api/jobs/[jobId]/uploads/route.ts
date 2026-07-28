import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createUpload,
  getJobForUser,
  getUpload,
  listUploads,
} from "@/lib/jobs";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";
import { MAX_FILE_BYTES } from "@/lib/types";

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
    resumeUploadId?: string;
  };

  if (!body.fileName || !body.size) {
    return NextResponse.json({ error: "Invalid file metadata" }, { status: 400 });
  }
  if (body.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 800 MB)" }, { status: 400 });
  }
  if (!body.type?.startsWith("video/")) {
    return NextResponse.json({ error: "Only video files are supported" }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Resume: if prior upload exists and object is present, skip re-upload
  if (body.resumeUploadId) {
    const existing = await getUpload(jobId, session.user.id, body.resumeUploadId);
    if (existing) {
      const { data } = await supabase.storage
        .from("memories")
        .list(`${session.user.id}/${jobId}`, { limit: 100 });
      const name = existing.storage_path.split("/").pop();
      const found = (data || []).some((item) => item.name === name && (item.metadata?.size || 0) >= body.size * 0.98);
      if (found) {
        return NextResponse.json({
          upload: existing,
          alreadyUploaded: true,
          signedUrl: null,
        });
      }
    }
  }

  const safeName = body.fileName.replace(/[^\w.\-()+ ]/g, "_");
  const storagePath = `${session.user.id}/${jobId}/${nanoid(10)}-${safeName}`;

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
    alreadyUploaded: false,
  });
}

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const uploads = await listUploads(jobId, session.user.id);
  return NextResponse.json({ uploads });
}
