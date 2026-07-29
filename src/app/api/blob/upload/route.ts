import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { MAX_FILE_BYTES } from "@/lib/media";

export const runtime = "nodejs";

/**
 * Client-token endpoint for Vercel Blob uploads (large videos).
 * Supabase Free caps direct uploads at 50 MB — Blob carries the rest.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload = JSON { userId, jobId }
        let payload: { userId?: string; jobId?: string } = {};
        try {
          payload = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          payload = {};
        }
        if (payload.userId && payload.userId !== session.user!.id) {
          throw new Error("Upload user mismatch");
        }
        if (!pathname.startsWith(`uploads/${session.user!.id}/`)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
            "video/x-matroska",
            "video/3gpp",
            "video/mpeg",
            "application/octet-stream",
          ],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({
            userId: session.user!.id,
            jobId: payload.jobId || null,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Credits / job metadata already tracked via our uploads API.
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Blob upload token failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
