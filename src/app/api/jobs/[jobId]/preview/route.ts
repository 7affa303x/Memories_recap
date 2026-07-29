import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import {
  getJobForUser,
  getRecap,
  setRecapPreviewPath,
} from "@/lib/jobs";
import { getServiceSupabase, signedRecapUrl } from "@/lib/supabase/admin";
import { downloadSourceToFile } from "@/lib/source-download";

type Params = { params: Promise<{ jobId: string }> };

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-400) || `ffmpeg ${code}`));
    });
  });
}

/**
 * On-demand 6s preview clip from the landscape recap (when not baked at process time).
 */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const userId = session.user.id;
  const job = await getJobForUser(jobId, userId);
  if (!job || job.status !== "completed") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const recap = await getRecap(jobId, userId);
  if (!recap?.landscape_path) {
    return NextResponse.json({ error: "No landscape output" }, { status: 404 });
  }

  if (recap.preview_path) {
    return NextResponse.json({
      ok: true,
      previewUrl: await signedRecapUrl(recap.preview_path),
      cached: true,
    });
  }

  const bin = ffmpegPath;
  if (!bin) {
    return NextResponse.json({ error: "ffmpeg missing" }, { status: 500 });
  }

  const workDir = await mkdtemp(join(tmpdir(), "preview-"));
  try {
    const src = join(workDir, "src.mp4");
    const out = join(workDir, "preview.mp4");
    await downloadSourceToFile(recap.landscape_path, src);
    await run(bin, [
      "-y",
      "-i",
      src,
      "-t",
      "6",
      "-vf",
      "scale=960:-2,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-an",
      "-movflags",
      "+faststart",
      out,
    ]);
    const generation = recap.current_generation || 1;
    const previewPath = `outputs/${userId}/${jobId}/v${generation}/preview-6s.mp4`;
    const bytes = await readFile(out);
    const supabase = getServiceSupabase();
    const up = await supabase.storage.from("memories").upload(previewPath, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (up.error) throw new Error(up.error.message);

    await setRecapPreviewPath(jobId, userId, previewPath);

    return NextResponse.json({
      ok: true,
      previewUrl: await signedRecapUrl(previewPath),
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Preview failed",
      },
      { status: 500 }
    );
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
