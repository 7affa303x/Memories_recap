import { access, mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { getServiceSupabase, signedRecapUrl } from "@/lib/supabase/admin";
import { downloadSourceToFile } from "@/lib/source-download";
import {
  appendJobLog,
  dequeueJob,
  getJobForUser,
  listUploads,
  updateJob,
  upsertRecap,
} from "@/lib/store";
import {
  probeDuration,
  probeVideoSize,
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
import { getUserPrefs } from "@/lib/user-prefs";
import { logError, logInfo } from "@/lib/logger";
import type { RecapOptions } from "@/lib/types";
import { PIPELINE_ARTIFACTS, RENDER_EXTRA_DERIVATIVES } from "@/lib/flags";
import {
  createOwnerId,
  ensurePipelineState,
  heartbeatProcessingLease,
  releaseEncodeSlot,
  releaseProcessingLease,
  setPipelineStage,
  toFriendlyProcessError,
  touchEncodeSlot,
  tryAcquireEncodeSlot,
  tryAcquireProcessingLease,
  writeArtifact,
  SCORING_CONFIG,
  type TimelineArtifact,
} from "@/lib/pipeline";

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

/**
 * Brand end-card only — no drawtext (ffmpeg-static often lacks libfreetype).
 * Title/date stay on the timeline artifact for a future PNG overlay path.
 */
async function makeEndCardClip(
  bin: string,
  orientation: "landscape" | "vertical",
  outPath: string,
  size: { w: number; h: number }
) {
  const image = endCardImagePath(orientation);
  const dim = `${size.w}:${size.h}`;
  const vf = `scale=${dim}:force_original_aspect_ratio=decrease,pad=${dim}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
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
    vf,
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
  const ownerId = createOwnerId("encode");

  const slot = await tryAcquireEncodeSlot({ ownerId, jobId, userId });
  if (!slot.ok) {
    logInfo("encode_slot_deferred", { jobId, userId, reason: slot.reason });
    await updateJob(jobId, userId, {
      status: "queued",
      stage: "queued",
      progress: 3,
      error: null,
      eta_seconds: 90,
    }).catch(() => undefined);
    // Leave queue entry; cron will retry when a slot frees.
    return null;
  }

  const lease = await tryAcquireProcessingLease({ jobId, userId, ownerId });
  if (!lease.ok) {
    await releaseEncodeSlot(ownerId).catch(() => undefined);
    logInfo("lease_deferred", { jobId, userId, reason: lease.reason });
    return null;
  }

  const heartbeat = setInterval(() => {
    void heartbeatProcessingLease(jobId, ownerId).catch(() => undefined);
    void touchEncodeSlot(ownerId).catch(() => undefined);
  }, 30_000);

  await appendJobLog(userId, jobId, "process_start", { ownerId });
  logInfo("process_start", { jobId, userId, ownerId });
  if (PIPELINE_ARTIFACTS) {
    await ensurePipelineState(userId, jobId, lease.lease.attempt).catch(
      () => undefined
    );
    await setPipelineStage(userId, jobId, "ingesting").catch(() => undefined);
  }

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
  let watermarkExempt = false;
  try {
    const summary = await getBillingSummary(userId, job?.notify_email || "");
    isPro = Boolean(
      summary.subscription &&
        ["active", "trialing"].includes(summary.subscription.status)
    );
    watermarkExempt = Boolean(summary.watermarkExempt);
  } catch {
    isPro = false;
    watermarkExempt = false;
  }
  const skipOverlayWatermark = isPro || watermarkExempt;

  let prefsEndTitle: string | null = null;
  let prefsShowDate = false;
  let prefsHideEnd = false;
  try {
    const prefs = await getUserPrefs(userId);
    prefsEndTitle = prefs.endCardTitle;
    prefsShowDate = prefs.endCardShowDate;
    prefsHideEnd = prefs.hideEndCard;
  } catch {
    /* defaults */
  }

  const endCardTitle =
    options.endCardTitle?.trim() || prefsEndTitle?.trim() || null;
  const endCardShowDate = Boolean(options.endCardShowDate ?? prefsShowDate);
  const hideEndCard = Boolean(isPro && (options.hideEndCard ?? prefsHideEnd));

  let outputQuality: OutputQuality =
    isPro && options.outputQuality === "uhd" ? "uhd" : "fhd";
  let sizes = renderSizes(outputQuality);
  let lw = sizes.landscape.w;
  let lh = sizes.landscape.h;
  let vw = sizes.vertical.w;
  let vh = sizes.vertical.h;

  const uploads = await listUploads(jobId, userId);
  if (uploads.length === 0) {
    clearInterval(heartbeat);
    await updateJob(jobId, userId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error: toFriendlyProcessError("No videos uploaded").userMessage,
    });
    await releaseProcessingLease(jobId, ownerId).catch(() => undefined);
    await releaseEncodeSlot(ownerId).catch(() => undefined);
    throw new Error("No videos uploaded");
  }

  const workDir = await mkdtemp(join(tmpdir(), "memory-recap-"));
  const clipPaths: string[] = [];

  try {
    await updateJob(jobId, userId, {
      status: "analyzing",
      stage: "ingesting",
      progress: 8,
      eta_seconds: 120,
      error: null,
    });

    const localFiles: { path: string; duration: number; uploadId: string }[] =
      [];
    let maxSourceEdge = 0;
    for (const [index, upload] of uploads.entries()) {
      const dest = join(workDir, `src-${index}.mp4`);
      await downloadToFile(upload.storage_path, dest);
      const duration = await probeDuration(bin, dest);
      const size = await probeVideoSize(bin, dest);
      maxSourceEdge = Math.max(maxSourceEdge, size.width || 0, size.height || 0);
      localFiles.push({ path: dest, duration, uploadId: upload.id });
      if (PIPELINE_ARTIFACTS) {
        await writeArtifact({
          userId,
          jobId,
          kind: "media_probe",
          name: `probe-${upload.id}.json`,
          uploadId: upload.id,
          data: {
            version: 1 as const,
            upload_id: upload.id,
            file_name: upload.file_name,
            storage_path: upload.storage_path,
            duration_seconds: duration,
            width: size.width,
            height: size.height,
            work_name: `src-${index}.mp4`,
          },
        }).catch(() => undefined);
      }
      await updateJob(jobId, userId, {
        progress: 8 + Math.round(((index + 1) / uploads.length) * 18),
        eta_seconds: Math.max(40, 120 - index * 8),
      });
      await appendJobLog(userId, jobId, "downloaded_source", {
        index,
        duration,
        width: size.width,
        height: size.height,
      });
    }

    // 4K only when at least one source is near-UHD (≥1440 on the long edge)
    if (outputQuality === "uhd" && maxSourceEdge > 0 && maxSourceEdge < 1440) {
      outputQuality = "fhd";
      sizes = renderSizes(outputQuality);
      lw = sizes.landscape.w;
      lh = sizes.landscape.h;
      vw = sizes.vertical.w;
      vh = sizes.vertical.h;
      await appendJobLog(userId, jobId, "uhd_downgraded", {
        maxSourceEdge,
        reason: "sources_below_1440p",
      });
      logInfo("uhd_downgraded", { jobId, maxSourceEdge });
    }

    await updateJob(jobId, userId, {
      status: "selecting",
      stage: "selecting",
      progress: 30,
      eta_seconds: 90,
    });
    if (PIPELINE_ARTIFACTS) {
      await setPipelineStage(userId, jobId, "selecting").catch(() => undefined);
    }

    const picks = await selectBestClips({
      bin,
      workDir,
      files: localFiles,
      mood: mood.id,
      visionTier: isPro ? "pro" : "free",
      maxSeconds: options.maxSeconds ?? undefined,
    });
    await appendJobLog(userId, jobId, "clips_selected", {
      count: picks.length,
      mood: mood.id,
      musicMode,
      trackId: track?.id ?? null,
    });

    if (PIPELINE_ARTIFACTS) {
      const scored = picks.map((pick) => {
        const source_index = localFiles.findIndex(
          (f) => f.path === pick.sourcePath
        );
        const upload_id =
          source_index >= 0
            ? localFiles[source_index]!.uploadId
            : uploads[0]?.id || "";
        return {
          upload_id,
          source_index: Math.max(0, source_index),
          start: pick.start,
          duration: pick.duration,
          local_score: pick.score,
          ai_score: null,
          ai_provider: null,
          final_score: pick.score,
          reason: "heuristic+vision_rank",
        };
      });
      await writeArtifact({
        userId,
        jobId,
        kind: "scores",
        name: "scores.json",
        data: {
          version: 1 as const,
          scored,
          scoring_config: { ...SCORING_CONFIG },
        },
      }).catch(() => undefined);

      const timeline: TimelineArtifact = {
        version: 1,
        segments: scored.map((s) => ({
          upload_id: s.upload_id,
          source_index: s.source_index,
          start: s.start,
          duration: s.duration,
          score: s.final_score,
          reason: s.reason,
        })),
        mood: mood.id,
        music_track_id: track?.id ?? null,
        music_mode: musicMode,
        outputs: ["landscape", "vertical"],
        end_card: {
          hide: hideEndCard,
          title: endCardTitle,
          show_date: endCardShowDate,
        },
      };
      await writeArtifact({
        userId,
        jobId,
        kind: "timeline",
        name: "timeline.json",
        data: timeline,
      }).catch(() => undefined);
      await setPipelineStage(userId, jobId, "timeline_ready").catch(
        () => undefined
      );
      await updateJob(jobId, userId, {
        stage: "timeline_ready",
        progress: 36,
      }).catch(() => undefined);
    }
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
    if (!hideEndCard) {
      await makeEndCardClip(bin, "landscape", endLandscape, sizes.landscape);
      await makeEndCardClip(bin, "vertical", endVertical, sizes.vertical);
    }

    if (PIPELINE_ARTIFACTS) {
      await setPipelineStage(userId, jobId, "rendering").catch(() => undefined);
    }

    const landscapeBody = join(workDir, "landscape-body.mp4");
    if (skipOverlayWatermark) {
      await run(bin, [
        "-y",
        "-i",
        withAudio,
        "-vf",
        "format=yuv420p",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
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
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
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

    const landscapeLocal = join(workDir, "landscape.mp4");
    if (hideEndCard) {
      await run(bin, [
        "-y",
        "-i",
        landscapeBody,
        "-c",
        "copy",
        landscapeLocal,
      ]);
    } else {
      const landscapeList = join(workDir, "landscape-final.txt");
      await writeConcatList(landscapeList, [landscapeBody, endLandscape]);
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
    }

    const verticalBody = join(workDir, "vertical-body.mp4");
    // Face-biased vertical crop: prefer upper third (people usually higher in frame)
    const verticalBase = `scale=${vw}:${vh}:force_original_aspect_ratio=increase,crop=${vw}:${vh}:(iw-ow)/2:(ih-oh)*0.22`;
    if (skipOverlayWatermark) {
      await run(bin, [
        "-y",
        "-i",
        withAudio,
        "-vf",
        `${verticalBase},format=yuv420p`,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
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
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
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

    const verticalLocal = join(workDir, "vertical.mp4");
    if (hideEndCard) {
      await run(bin, ["-y", "-i", verticalBody, "-c", "copy", verticalLocal]);
    } else {
      const verticalList = join(workDir, "vertical-final.txt");
      await writeConcatList(verticalList, [verticalBody, endVertical]);
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
    }

    const supabase = getServiceSupabase();
    const generation = (job?.recap_generation || 0) + 1;
    const landscapePath = `outputs/${userId}/${jobId}/v${generation}/landscape.mp4`;
    const verticalPath = `outputs/${userId}/${jobId}/v${generation}/vertical.mp4`;
    const highlightsPath = `outputs/${userId}/${jobId}/v${generation}/highlights.mp4`;
    const storyPath = `outputs/${userId}/${jobId}/v${generation}/story.mp4`;
    const tiktokPath = `outputs/${userId}/${jobId}/v${generation}/tiktok.mp4`;
    const previewPath = `outputs/${userId}/${jobId}/v${generation}/preview-6s.mp4`;

    // Cheap 6s preview always. Extra story/tiktok/highlights are opt-in
    // (RENDER_EXTRA_DERIVATIVES) — they dominate serverless timeouts.
    const storyLocal = join(workDir, "story.mp4");
    const tiktokLocal = join(workDir, "tiktok.mp4");
    const previewLocal = join(workDir, "preview-6s.mp4");
    await run(bin, [
      "-y",
      "-i",
      landscapeLocal,
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
      previewLocal,
    ]).catch(() => undefined);

    const wantExtras = RENDER_EXTRA_DERIVATIVES;
    if (wantExtras) {
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
    }

    // Pro highlights only when extra derivatives enabled
    let highlightsLocal: string | null = null;
    if (isPro && wantExtras) {
      highlightsLocal = join(workDir, "highlights.mp4");
      const builtFromPicks =
        picks.length > 0 &&
        clipPaths.length === picks.length &&
        (await (async () => {
          const totalDur = picks.reduce((sum, p) => sum + p.duration, 0);
          const targetDur = Math.max(6, Math.min(24, totalDur * 0.4));
          const ranked = picks
            .map((pick, index) => ({
              pick,
              path: clipPaths[index]!,
              index,
            }))
            .sort((a, b) => b.pick.score - a.pick.score);

          const chosen: typeof ranked = [];
          let acc = 0;
          for (const item of ranked) {
            if (chosen.length > 0 && acc >= targetDur) break;
            chosen.push(item);
            acc += item.pick.duration;
          }
          if (chosen.length === 0) {
            const half = Math.max(1, Math.ceil(ranked.length / 2));
            chosen.push(...ranked.slice(0, half));
          }

          chosen.sort((a, b) => a.index - b.index);
          const hlList = join(workDir, "highlights-concat.txt");
          await writeConcatList(
            hlList,
            chosen.map((c) => c.path)
          );

          try {
            await run(bin, [
              "-y",
              "-f",
              "concat",
              "-safe",
              "0",
              "-i",
              hlList,
              "-vf",
              `scale=${lw}:${lh}:force_original_aspect_ratio=decrease,pad=${lw}:${lh}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
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
              highlightsLocal!,
            ]);
            return true;
          } catch {
            return false;
          }
        })());

      if (!builtFromPicks) {
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
    }

    const uploadsOut: Array<[string, string]> = [
      [landscapePath, landscapeLocal],
      [verticalPath, verticalLocal],
    ];
    if (wantExtras) {
      uploadsOut.push([storyPath, storyLocal], [tiktokPath, tiktokLocal]);
    }
    if (highlightsLocal) {
      uploadsOut.push([highlightsPath, highlightsLocal]);
    }
    let previewUploaded: string | null = null;
    if (await fileExists(previewLocal)) {
      uploadsOut.push([previewPath, previewLocal]);
      previewUploaded = previewPath;
    }

    await updateJob(jobId, userId, {
      progress: 80,
      eta_seconds: 20,
    });

    for (const [path, localPath] of uploadsOut) {
      const { data, error: uploadError } = await supabase.storage
        .from("memories")
        .upload(path, createReadStream(localPath), {
          contentType: "video/mp4",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    await updateJob(jobId, userId, {
      progress: 90,
      eta_seconds: 10,
    });

    const duration = await probeDuration(bin, landscapeLocal);
    const { RECAP_TTL_DAYS, RECAP_TTL_DAYS_PRO } = await import("@/lib/types");
    await upsertRecap({
      jobId,
      userId,
      landscapePath,
      verticalPath,
      highlightsPath: highlightsLocal ? highlightsPath : null,
      storyPath: wantExtras ? storyPath : null,
      tiktokPath: wantExtras ? tiktokPath : null,
      previewPath: previewUploaded,
      durationSeconds: duration,
      mood: mood.id,
      ttlDays: isPro ? RECAP_TTL_DAYS_PRO : RECAP_TTL_DAYS,
      generation,
    });

    // Share links are opt-in from the result page (ShareControls), not auto-created.

    if (PIPELINE_ARTIFACTS) {
      await writeArtifact({
        userId,
        jobId,
        kind: "render_manifest",
        name: "render-manifest.json",
        data: {
          version: 1 as const,
          generation,
          landscape_path: landscapePath,
          vertical_path: verticalPath,
          preview_path: previewUploaded,
          duration_seconds: duration,
        },
      }).catch(() => undefined);
      await setPipelineStage(userId, jobId, "completed").catch(() => undefined);
    }

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
      extras: wantExtras,
    });
    logInfo("process_completed", { jobId, userId, ms: Date.now() - started });

    try {
      const { grantFirstRecapReward } = await import("@/lib/rewards/grants");
      if (job?.notify_email) {
        await grantFirstRecapReward(userId, job.notify_email, jobId).catch(
          () => undefined
        );
      }
    } catch {
      /* optional earn reward */
    }

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
    const friendly = toFriendlyProcessError(error);
    const raw = error instanceof Error ? error.message : "Processing failed";
    logError("process_failed", {
      jobId,
      userId,
      code: friendly.code,
      message: raw,
    });
    await appendJobLog(userId, jobId, "process_failed", {
      code: friendly.code,
      message: raw.slice(0, 500),
    });
    if (PIPELINE_ARTIFACTS) {
      await setPipelineStage(userId, jobId, "failed", {
        failed_stage: friendly.code,
      }).catch(() => undefined);
    }
    await updateJob(jobId, userId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      error: friendly.userMessage,
      eta_seconds: 0,
    });
    await dequeueJob(jobId).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(heartbeat);
    await releaseProcessingLease(jobId, ownerId).catch(() => undefined);
    await releaseEncodeSlot(ownerId).catch(() => undefined);
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
