import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { MAX_FILE_BYTES } from "@/lib/media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fileName, fileSize, mimeType, jobId } = await request.json();

    if (!fileName || !fileSize || !jobId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (fileSize > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const storagePath = `uploads/${session.user.id}/${jobId}/${Date.now()}-${fileName}`;

    // Create a signed upload URL for Supabase Storage
    // This allows the client to upload directly to the bucket
    const { data, error } = await supabase.storage
      .from("memories")
      .createSignedUploadUrl(storagePath);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      storagePath,
      provider: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
