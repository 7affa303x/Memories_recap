import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { getServiceSupabase, signedRecapUrl } from "@/lib/supabase/admin";
import {
  appendJobLog,
  dequeueJob,
  ensureShareLink,
  listUploads,
  updateJob,
  upsertRecap,
} from "@/lib/store";
import {
  probeDuration,
  selectBestClips,
  writeConcatList,
} from "@/lib/smart-select";
import { logError, logInfo } from "@/lib/logger";

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

export async function processJob(jobId: string, userId: string) {
  const bin = ffmpegPath;
  if (!bin) throw new Error("ffmpeg binary missing");

  const started = Date.now();
  await appendJobLog(userId, jobId, "process_start");
  logInfo("process_start", { jobId, userId });

  const uploads = await listUploads(jobId, userId);
  if (uploads.length === 0) {
    await updateJob(jobId, userId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error: "No videos uploaded",
    });
    throw new Error("No videos uploaded");
  }

  const workDir = await mkdtemp(join(tmpdir(), "memory-recap-"));
  const clipPaths: string[] = [];

  try {
    await updateJob(jobId, userId, {
      status: "analyzing",
      stage: "analyzing",
      progress: 8,
      eta_seconds: 120,
      error: null,
    });

    const localFiles: { path: string; duration: number }[] = [];
    for (const [index, upload] of uploads.entries()) {
      const dest = join(workDir, `src-${index}.mp4`);
      await downloadToFile(upload.storage_path, dest);
      const duration = await probeDuration(bin, dest);
      localFiles.push({ path: dest, duration });
      await updateJob(jobId, userId, {
        progress: 8 + Math.round(((index + 1) / uploads.length) * 18),
        eta_seconds: Math.max(40, 120 - index * 8),
      });
      await appendJobLog(userId, jobId, "downloaded_source", {
        index,
        duration,
      });
    }

    await updateJob(jobId, userId, {
      status: "selecting",
      stage: "selecting",
      progress: 30,
      eta_seconds: 90,
    });

    const picks = await selectBestClips({
      bin,
      workDir,
      files: localFiles,
      targetSeconds: 48,
    });
    await appendJobLog(userId, jobId, "clips_selected", {
      count: picks.length,
    });

    for (const [index, pick] of picks.entries()) {
      const clip = join(workDir, `clip-${index}.mp4`);
      await run(bin, [
        "-y",
        "-ss",
        pick.start.toFixed(2),
        "-i",
        pick.sourcePath,
        "-t",
        pick.duration.toFixed(2),
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
      await updateJob(jobId, userId, {
        progress: 30 + Math.round(((index + 1) / picks.length) * 25),
        eta_seconds: Math.max(25, 90 - index * 10),
      });
    }

    await updateJob(jobId, userId, {
      status: "building",
      stage: "building",
      progress: 60,
      eta_seconds: 45,
    });

    const listFile = join(workDir, "concat.txt");
    await writeConcatList(listFile, clipPaths);
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

    await updateJob(jobId, userId, {
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
    // Private outputs under memories bucket
    const landscapePath = `outputs/${userId}/${jobId}/landscape.mp4`;
    const verticalPath = `outputs/${userId}/${jobId}/vertical.mp4`;
    const landscapeBytes = await readFile(landscapeLocal);
    const verticalBytes = await readFile(verticalLocal);

    const upLandscape = await supabase.storage
      .from("memories")
      .upload(landscapePath, landscapeBytes, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (upLandscape.error) throw new Error(upLandscape.error.message);

    const upVertical = await supabase.storage
      .from("memories")
      .upload(verticalPath, verticalBytes, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (upVertical.error) throw new Error(upVertical.error.message);

    const duration = await probeDuration(bin, landscapeLocal);
    await upsertRecap({
      jobId,
      userId,
      landscapePath,
      verticalPath,
      durationSeconds: duration,
    });

    await ensureShareLink(jobId, userId, { expiresInDays: 14 });

    await updateJob(jobId, userId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      eta_seconds: 0,
      completed_at: new Date().toISOString(),
      error: null,
    });

    await dequeueJob(jobId).catch(() => undefined);
    await appendJobLog(userId, jobId, "process_completed", {
      ms: Date.now() - started,
      duration,
    });
    logInfo("process_completed", { jobId, userId, ms: Date.now() - started });

    return {
      landscapeUrl: await signedRecapUrl(landscapePath),
      verticalUrl: await signedRecapUrl(verticalPath),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    logError("process_failed", { jobId, userId, message });
    await appendJobLog(userId, jobId, "process_failed", { message });
    await updateJob(jobId, userId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error: message,
      eta_seconds: 0,
    });
    await dequeueJob(jobId).catch(() => undefined);
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
