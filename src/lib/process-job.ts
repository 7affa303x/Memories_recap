import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import { getServiceSupabase, publicRecapUrl } from "@/lib/supabase/admin";
import { listUploads, updateJob } from "@/lib/jobs";
import { spawn } from "node:child_process";

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `ffmpeg exited with ${code}`));
    });
  });
}

async function downloadToFile(path: string, dest: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from("memories").download(path);
  if (error || !data) throw new Error(error?.message || "Download failed");
  await pipeline(Readable.fromWeb(data.stream() as never), createWriteStream(dest));
}

async function probeDuration(file: string, bin: string) {
  return new Promise<number>((resolve) => {
    const child = spawn(bin, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) {
        resolve(8);
        return;
      }
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3]);
      resolve(hours * 3600 + minutes * 60 + seconds);
    });
  });
}

export async function processJob(jobId: string, userId: string) {
  const bin = ffmpegPath;
  if (!bin) throw new Error("ffmpeg binary missing");

  const uploads = await listUploads(jobId);
  if (uploads.length === 0) {
    await updateJob(jobId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error: "No videos uploaded",
    });
    return;
  }

  const workDir = await mkdtemp(join(tmpdir(), "memory-recap-"));
  const clipPaths: string[] = [];

  try {
    await updateJob(jobId, {
      status: "analyzing",
      stage: "analyzing",
      progress: 10,
      eta_seconds: 90,
      error: null,
    });

    const localFiles: { path: string; duration: number }[] = [];
    for (const [index, upload] of uploads.entries()) {
      const dest = join(workDir, `src-${index}.mp4`);
      await downloadToFile(upload.storage_path, dest);
      const duration = await probeDuration(dest, bin);
      localFiles.push({ path: dest, duration });
      await updateJob(jobId, {
        progress: 10 + Math.round(((index + 1) / uploads.length) * 20),
        eta_seconds: Math.max(30, 90 - index * 5),
      });
    }

    await updateJob(jobId, {
      status: "selecting",
      stage: "selecting",
      progress: 35,
      eta_seconds: 70,
    });

    const perClip = Math.min(8, Math.max(3, Math.floor(60 / localFiles.length)));
    for (const [index, file] of localFiles.entries()) {
      const start = Math.max(0, file.duration / 2 - perClip / 2);
      const clip = join(workDir, `clip-${index}.mp4`);
      await run(bin, [
        "-y",
        "-ss",
        start.toFixed(2),
        "-i",
        file.path,
        "-t",
        String(perClip),
        "-vf",
        "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-movflags",
        "+faststart",
        clip,
      ]);
      clipPaths.push(clip);
      await updateJob(jobId, {
        progress: 35 + Math.round(((index + 1) / localFiles.length) * 20),
      });
    }

    await updateJob(jobId, {
      status: "building",
      stage: "building",
      progress: 60,
      eta_seconds: 40,
    });

    const listFile = join(workDir, "concat.txt");
    await writeFile(
      listFile,
      clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
    );

    const landscapeLocal = join(workDir, "landscape.mp4");
    await run(bin, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      landscapeLocal,
    ]);

    await updateJob(jobId, {
      status: "rendering",
      stage: "rendering",
      progress: 78,
      eta_seconds: 25,
    });

    const verticalLocal = join(workDir, "vertical.mp4");
    await run(bin, [
      "-y",
      "-i",
      landscapeLocal,
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      verticalLocal,
    ]);

    const supabase = getServiceSupabase();
    const landscapePath = `${userId}/${jobId}/landscape.mp4`;
    const verticalPath = `${userId}/${jobId}/vertical.mp4`;

    const landscapeBytes = await readFile(landscapeLocal);
    const verticalBytes = await readFile(verticalLocal);

    const upLandscape = await supabase.storage
      .from("recaps")
      .upload(landscapePath, landscapeBytes, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (upLandscape.error) throw new Error(upLandscape.error.message);

    const upVertical = await supabase.storage
      .from("recaps")
      .upload(verticalPath, verticalBytes, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (upVertical.error) throw new Error(upVertical.error.message);

    const duration = await probeDuration(landscapeLocal, bin);

    const { error: recapError } = await supabase.from("recaps").upsert(
      {
        job_id: jobId,
        user_id: userId,
        landscape_path: landscapePath,
        vertical_path: verticalPath,
        duration_seconds: duration,
      },
      { onConflict: "job_id" }
    );
    if (recapError) throw new Error(recapError.message);

    await updateJob(jobId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      eta_seconds: 0,
      completed_at: new Date().toISOString(),
      error: null,
    });

    return {
      landscapeUrl: publicRecapUrl(landscapePath),
      verticalUrl: publicRecapUrl(verticalPath),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await updateJob(jobId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error: message,
      eta_seconds: 0,
    });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
