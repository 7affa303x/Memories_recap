import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { getServiceSupabase, signedRecapUrl } from "@/lib/supabase/admin";
import { downloadSourceToFile } from "@/lib/source-download";
import {
  appendJobLog,
  dequeueJob,
  ensureShareLink,
  getJobForUser,
  listUploads,
  updateJob,
  upsertRecap,
} from "@/lib/store";
import {
  probeDuration,
  selectBestClips,
  writeConcatList,
} from "@/lib/smart-select";
import { shouldKeepOriginalAudio } from "@/lib/audio-keep";
import {
  END_CARD_SECONDS,
  endCardImagePath,
  renderSizes,
  watermarkOverlayFilter,
  watermarkOverlayPath,
  type OutputQuality,
} from "@/lib/branding-video";
import { getMood } from "@/lib/mood";
import {
  resolveMusicSelection,
  trackAbsolutePath,
  type MusicMode,
} from "@/lib/music";
import { getBillingSummary } from "@/lib/billing/credits";
import { logError, logInfo } from "@/lib/logger";
import type { RecapOptions } from "@/lib/types";

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
  await downloadSourceToFile(path, dest);
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function makeEndCardClip(
  bin: string,
  orientation: "landscape" | "vertical",
  outPath: string,
  size: { w: number; h: number }
) {
  const image = endCardImagePath(orientation);
  const dim = `${size.w}:${size.h}`;
  await run(bin, [
    "-y",
    "-loop",
    "1",
    "-i",
    image,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    String(END_CARD_SECONDS),
    "-vf",
    `scale=${dim}:force_original_aspect_ratio=decrease,pad=${dim}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    outPath,
  ]);
}

export async function processJob(jobId: string, userId: string) {
  const bin = ffmpegPath;
  if (!bin) throw new Error("ffmpeg binary missing");

  const started = Date.now();
  await appendJobLog(userId, jobId, "process_start");
  logInfo("process_start", { jobId, userId });

  const job = await getJobForUser(jobId, userId);
  const options: RecapOptions = job?.recap_options ?? {
    musicMode: "auto",
    mood: "joyful",
    trackId: null,
  };
  const mood = getMood(options.mood);
  const musicMode = (options.musicMode || "auto") as MusicMode;
  const track = resolveMusicSelection({
    mode: musicMode,
    trackId: options.trackId,
    mood: mood.id,
  });

  let isPro = false;
  try {
    const summary = await getBillingSummary(userId, job?.notify_email || "");
    isPro = Boolean(
      summary.subscription &&
        ["active", "trialing"].includes(summary.subscription.status)
    );
  } catch {
    isPro = false;
  }

  const outputQuality: OutputQuality =
    isPro && options.outputQuality === "uhd" ? "uhd" : "fhd";
  const sizes = renderSizes(outputQuality);
  const lw = sizes.landscape.w;
  const lh = sizes.landscape.h;
  const vw = sizes.vertical.w;
  const vh = sizes.vertical.h;

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
      mood: mood.id,
      visionTier: isPro ? "pro" : "free",
    });
    await appendJobLog(userId, jobId, "clips_selected", {
      count: picks.length,
      mood: mood.id,
      musicMode,
      trackId: track?.id ?? null,
    });

    for (const [index, pick] of picks.entries()) {
      const clip = join(workDir, `clip-${index}.mp4`);
      let keepAudio = false;
      try {
        const audio = await shouldKeepOriginalAudio({
          bin,
          sourcePath: pick.sourcePath,
          start: pick.start,
          duration: pick.duration,
        });
        keepAudio = audio.keep;
      } catch {
        keepAudio = false;
      }

      // ~10–20% keep rate: only peak moments keep original audio
      const audioFilter = keepAudio
        ? ["-c:a", "aac", "-ac", "2", "-ar", "44100"]
        : ["-an"];

      await run(bin, [
        "-y",
        "-ss",
        pick.start.toFixed(2),
        "-i",
        pick.sourcePath,
        "-t",
        pick.duration.toFixed(2),
        "-vf",
        `scale=${lw}:${lh}:force_original_aspect_ratio=decrease,pad=${lw}:${lh}:(ow-iw)/2:(oh-ih)/2,fps=30,${mood.colorFilter}`,
        "-c:v",
        "libx264",
        "-preset",
        sizes.preset,
        "-crf",
        String(sizes.crf + 1),
        ...audioFilter,
        "-movflags",
        "+faststart",
        clip,
      ]);
      clipPaths.push(clip);
      await updateJob(jobId, userId, {
        progress: 30 + Math.round(((index + 1) / picks.length) * 22),
        eta_seconds: Math.max(25, 90 - index * 10),
      });
    }

    await updateJob(jobId, userId, {
      status: "building",
      stage: "building",
      progress: 55,
      eta_seconds: 50,
    });

    const listFile = join(workDir, "concat.txt");
    await writeConcatList(listFile, clipPaths);
    const concatLocal = join(workDir, "concat-raw.mp4");
    // Re-encode so silent + audio clips merge cleanly
    await run(bin, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex",
      "[0:v]format=yuv420p[v];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];[1:a][a0]amix=inputs=2:duration=first:dropout_transition=0,volume=1[a]",
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-shortest",
      concatLocal,
    ]).catch(async () => {
      await run(bin, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-shortest",
        concatLocal,
      ]);
    });

    const withAudioBase = concatLocal;
    let withAudio = withAudioBase;
    if (track && (await fileExists(trackAbsolutePath(track)))) {
      const mixed = join(workDir, "with-music.mp4");
      const musicPath = trackAbsolutePath(track);
      await run(bin, [
        "-y",
        "-i",
        withAudioBase,
        "-stream_loop",
        "-1",
        "-i",
        musicPath,
        "-filter_complex",
        "[0:a]volume=0.18[orig];[1:a]volume=0.72,afade=t=in:st=0:d=1.2[bg];[orig][bg]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        mixed,
      ]);
      withAudio = mixed;
    }

    await updateJob(jobId, userId, {
      status: "rendering",
      stage: "rendering",
      progress: 72,
      eta_seconds: 35,
    });

    const endLandscape = join(workDir, "end-landscape.mp4");
    const endVertical = join(workDir, "end-vertical.mp4");
    await makeEndCardClip(bin, "landscape", endLandscape, sizes.landscape);
    await makeEndCardClip(bin, "vertical", endVertical, sizes.vertical);

    const landscapeBody = join(workDir, "landscape-body.mp4");
    if (isPro) {
      await run(bin, [
        "-y",
        "-i",
        withAudio,
        "-vf",
        "format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        sizes.preset,
        "-crf",
        String(sizes.crf),
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        landscapeBody,
      ]);
    } else {
      await run(bin, [
        "-y",
        "-i",
        withAudio,
        "-i",
        watermarkOverlayPath(),
        "-filter_complex",
        watermarkOverlayFilter(lw),
        "-c:v",
        "libx264",
        "-preset",
        sizes.preset,
        "-crf",
        String(sizes.crf),
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        landscapeBody,
      ]);
    }

    const landscapeList = join(workDir, "landscape-final.txt");
    await writeConcatList(landscapeList, [landscapeBody, endLandscape]);
    const landscapeLocal = join(workDir, "landscape.mp4");
    await run(bin, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      landscapeList,
      "-c",
      "copy",
      landscapeLocal,
    ]).catch(async () => {
      // Re-encode concat if codecs mismatch
      await run(bin, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        landscapeList,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        landscapeLocal,
      ]);
    });

    const verticalBody = join(workDir, "vertical-body.mp4");
    // Face-biased vertical crop: prefer upper third (people usually higher in frame)
    const verticalBase = `scale=${vw}:${vh}:force_original_aspect_ratio=increase,crop=${vw}:${vh}:(iw-ow)/2:(ih-oh)*0.22`;
    if (isPro) {
      await run(bin, [
        "-y",
        "-i",
        withAudio,
        "-vf",
        `${verticalBase},format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        sizes.preset,
        "-crf",
        String(sizes.crf),
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        verticalBody,
      ]);
    } else {
      await run(bin, [
        "-y",
        "-i",
        withAudio,
        "-i",
        watermarkOverlayPath(),
        "-filter_complex",
        `[0:v]${verticalBase}[base];[1:v]scale=${vw}:-1[wm];[base][wm]overlay=(W-w)/2:H*0.33-h/2,format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        sizes.preset,
        "-crf",
        String(sizes.crf),
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        verticalBody,
      ]);
    }

    const verticalList = join(workDir, "vertical-final.txt");
    await writeConcatList(verticalList, [verticalBody, endVertical]);
    const verticalLocal = join(workDir, "vertical.mp4");
    await run(bin, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      verticalList,
      "-c",
      "copy",
      verticalLocal,
    ]).catch(async () => {
      await run(bin, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        verticalList,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        verticalLocal,
      ]);
    });

    const supabase = getServiceSupabase();
    const generation = (job?.recap_generation || 0) + 1;
    const landscapePath = `outputs/${userId}/${jobId}/v${generation}/landscape.mp4`;
    const verticalPath = `outputs/${userId}/${jobId}/v${generation}/vertical.mp4`;
    const highlightsPath = `outputs/${userId}/${jobId}/v${generation}/highlights.mp4`;
    const storyPath = `outputs/${userId}/${jobId}/v${generation}/story.mp4`;
    const tiktokPath = `outputs/${userId}/${jobId}/v${generation}/tiktok.mp4`;

    // Platform-oriented vertical copies (safe margins for Stories / TikTok)
    const storyLocal = join(workDir, "story.mp4");
    const tiktokLocal = join(workDir, "tiktok.mp4");
    await run(bin, [
      "-y",
      "-i",
      verticalLocal,
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
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
      storyLocal,
    ]);
    await run(bin, [
      "-y",
      "-i",
      verticalLocal,
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      tiktokLocal,
    ]);

    // Pro highlights: shorter cut of strongest moments (first ~40% of timeline)
    let highlightsLocal: string | null = null;
    if (isPro) {
      highlightsLocal = join(workDir, "highlights.mp4");
      const fullDur = await probeDuration(bin, landscapeLocal);
      const highlightDur = Math.max(6, Math.min(24, fullDur * 0.4));
      await run(bin, [
        "-y",
        "-i",
        landscapeLocal,
        "-t",
        highlightDur.toFixed(2),
        "-c",
        "copy",
        highlightsLocal,
      ]).catch(async () => {
        await run(bin, [
          "-y",
          "-i",
          landscapeLocal,
          "-t",
          highlightDur.toFixed(2),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          highlightsLocal!,
        ]);
      });
    }

    const landscapeBytes = await readFile(landscapeLocal);
    const verticalBytes = await readFile(verticalLocal);
    const storyBytes = await readFile(storyLocal);
    const tiktokBytes = await readFile(tiktokLocal);

    const uploadsOut: Array<[string, Buffer]> = [
      [landscapePath, landscapeBytes],
      [verticalPath, verticalBytes],
      [storyPath, storyBytes],
      [tiktokPath, tiktokBytes],
    ];
    if (highlightsLocal) {
      uploadsOut.push([highlightsPath, await readFile(highlightsLocal)]);
    }
    for (const [path, bytes] of uploadsOut) {
      const up = await supabase.storage.from("memories").upload(path, bytes, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);
    }

    const duration = await probeDuration(bin, landscapeLocal);
    const { RECAP_TTL_DAYS, RECAP_TTL_DAYS_PRO } = await import("@/lib/types");
    await upsertRecap({
      jobId,
      userId,
      landscapePath,
      verticalPath,
      highlightsPath: highlightsLocal ? highlightsPath : null,
      storyPath,
      tiktokPath,
      durationSeconds: duration,
      mood: mood.id,
      ttlDays: isPro ? RECAP_TTL_DAYS_PRO : RECAP_TTL_DAYS,
      generation,
    });

    await ensureShareLink(jobId, userId, {
      expiresInDays: isPro ? 90 : 14,
    });

    await updateJob(jobId, userId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      eta_seconds: 0,
      completed_at: new Date().toISOString(),
      error: null,
      recap_generation: generation,
      folder: options.folder || job?.folder || null,
    });

    await dequeueJob(jobId).catch(() => undefined);
    await appendJobLog(userId, jobId, "process_completed", {
      ms: Date.now() - started,
      duration,
      isPro,
      mood: mood.id,
      music: track?.id ?? null,
      outputQuality,
    });
    logInfo("process_completed", { jobId, userId, ms: Date.now() - started });

    try {
      const { sendRecapReadyEmail } = await import("@/lib/email");
      const { getAppUrl } = await import("@/lib/billing/config");
      if (job?.notify_email) {
        await sendRecapReadyEmail({
          to: job.notify_email,
          jobId,
          resultUrl: `${getAppUrl()}/result/${jobId}`,
        });
      }
    } catch (emailError) {
      logError("recap_email_failed", {
        jobId,
        error:
          emailError instanceof Error ? emailError.message : "email_failed",
      });
    }

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
