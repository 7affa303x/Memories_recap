import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasVisionProvider, scoreMemoryFrame, type VisionTier } from "@/lib/ai-vision";
import { clipLengthRange, getMood, type MoodId } from "@/lib/mood";
import { applyBeatSync, applyNarrativeArc } from "@/lib/story-edit";
import { logInfo } from "@/lib/logger";

function runCapture(bin: string, args: string[]) {
  return new Promise<{ code: number; stderr: string; stdout: string }>(
    (resolve, reject) => {
      const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let stdout = "";
      child.stderr.on("data", (c) => {
        stderr += c.toString();
      });
      child.stdout.on("data", (c) => {
        stdout += c.toString();
      });
      child.on("error", reject);
      child.on("close", (code) =>
        resolve({ code: code ?? 1, stderr, stdout })
      );
    }
  );
}

export async function probeDuration(bin: string, file: string) {
  const { stderr } = await runCapture(bin, ["-i", file]);
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 8;
  return (
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  );
}

/** Best-effort width/height from ffmpeg -i stderr. */
export async function probeVideoSize(bin: string, file: string) {
  const { stderr } = await runCapture(bin, ["-i", file]);
  const match = stderr.match(/Video:.*?\s(\d{2,5})x(\d{2,5})/);
  if (!match) return { width: 0, height: 0 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function extractFrame(
  bin: string,
  file: string,
  at: number,
  outPath: string
) {
  await runCapture(bin, [
    "-y",
    "-ss",
    Math.max(0, at).toFixed(2),
    "-i",
    file,
    "-frames:v",
    "1",
    "-q:v",
    "5",
    outPath,
  ]);
}

function scoreJpegBuffer(buf: Buffer) {
  let sum = 0;
  let sumSq = 0;
  const step = Math.max(1, Math.floor(buf.length / 4000));
  let n = 0;
  for (let i = 0; i < buf.length; i += step) {
    const v = buf[i];
    sum += v;
    sumSq += v * v;
    n += 1;
  }
  if (n === 0) return { brightness: 0, contrast: 0, score: 0 };
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const contrast = Math.sqrt(variance);
  const brightnessScore =
    mean < 18 ? 0 : mean > 235 ? 0.15 : 1 - Math.abs(mean - 128) / 128;
  const contrastScore = Math.min(1, contrast / 45);
  const score = brightnessScore * 0.55 + contrastScore * 0.45;
  return { brightness: mean, contrast, score };
}

async function detectSceneTimes(bin: string, file: string, duration: number) {
  const { stderr } = await runCapture(bin, [
    "-i",
    file,
    "-filter:v",
    "select='gt(scene,0.28)',showinfo",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const times = new Set<number>();
  const re = /pts_time:(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stderr))) {
    const t = Number(match[1]);
    if (t > 0.4 && t < duration - 0.4) times.add(Number(t.toFixed(2)));
  }
  const step = Math.max(2, duration / 12);
  for (let t = step; t < duration - 1; t += step) {
    times.add(Number(t.toFixed(2)));
  }
  return [...times].sort((a, b) => a - b);
}

export type SelectedClip = {
  sourcePath: string;
  start: number;
  duration: number;
  score: number;
};

/**
 * Efficiency-based selection:
 * - Low-variety / dull stretches → keep only seconds
 * - Many strong, diverse moments → keep more (no fixed 48s cap)
 */
export async function selectBestClips(input: {
  bin: string;
  workDir: string;
  files: Array<{ path: string; duration: number }>;
  mood?: MoodId | null;
  visionTier?: VisionTier;
  /** Soft max only — not a hard target fill */
  maxSeconds?: number;
}): Promise<SelectedClip[]> {
  const mood = getMood(input.mood);
  const { min: minLen, max: maxLen } = clipLengthRange(mood);
  const softMax = input.maxSeconds ?? 180;
  const selected: SelectedClip[] = [];
  const visionTier = input.visionTier ?? "free";

  for (const [fileIndex, file] of input.files.entries()) {
    const candidates = await detectSceneTimes(
      input.bin,
      file.path,
      file.duration
    );
    const scored: Array<{ start: number; score: number }> = [];

    for (const [i, at] of candidates.entries()) {
      const framePath = join(input.workDir, `frame-${fileIndex}-${i}.jpg`);
      try {
        await extractFrame(input.bin, file.path, at, framePath);
        const buf = await readFile(framePath);
        const { score } = scoreJpegBuffer(buf);
        const chronoBias = 1 - (i / Math.max(1, candidates.length)) * 0.05;
        scored.push({ start: at, score: score * chronoBias });
      } catch {
        // skip
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (hasVisionProvider()) {
      const top = scored.slice(0, Math.min(10, scored.length));
      for (const [i, candidate] of top.entries()) {
        const framePath = join(
          input.workDir,
          `ai-cand-${fileIndex}-${i}.jpg`
        );
        try {
          await extractFrame(input.bin, file.path, candidate.start, framePath);
          const vision = await scoreMemoryFrame(framePath, visionTier);
          if (vision) candidate.score += vision.score * 1.2;
        } catch {
          // keep local
        }
      }
      scored.sort((a, b) => b.score - a.score);
      logInfo("vision_candidates_scored", {
        fileIndex,
        count: top.length,
        tier: visionTier,
      });
    }

    const strong = scored.filter((s) => s.score >= 0.42);
    const medium = scored.filter((s) => s.score >= 0.28 && s.score < 0.42);
    // Efficiency: dull source → few clips; rich source → many
    const maxPicks =
      strong.length >= 5
        ? Math.min(8, strong.length)
        : strong.length >= 2
          ? Math.min(4, Math.max(2, strong.length + 1))
          : medium.length >= 2
            ? 2
            : 1;

    const clipLen =
      strong.length >= 4
        ? Math.min(maxLen, Math.max(minLen, (minLen + maxLen) / 2))
        : Math.min(maxLen, Math.max(minLen + 0.5, maxLen * 0.7));

    const picked: number[] = [];
    const pool = strong.length > 0 ? [...strong, ...medium] : scored;
    for (const candidate of pool) {
      if (picked.length >= maxPicks) break;
      if (picked.some((t) => Math.abs(t - candidate.start) < clipLen * 0.8)) {
        continue;
      }
      if (candidate.score < 0.18) continue;
      picked.push(candidate.start);
    }

    if (picked.length === 0) {
      picked.push(Math.max(0, file.duration / 2 - clipLen / 2));
    }

    picked
      .sort((a, b) => a - b)
      .forEach((start) => {
        const match = scored.find((s) => s.start === start);
        const score = match?.score ?? 0.4;
        // Dull moments get shorter duration
        const durationScale = score >= 0.5 ? 1 : score >= 0.3 ? 0.7 : 0.45;
        const duration = Math.min(
          clipLen * durationScale,
          Math.max(1.2, file.duration - start)
        );
        selected.push({
          sourcePath: file.path,
          start,
          duration,
          score,
        });
      });
  }

  const ordered = selected.sort((a, b) => {
    const ai = input.files.findIndex((f) => f.path === a.sourcePath);
    const bi = input.files.findIndex((f) => f.path === b.sourcePath);
    if (ai !== bi) return ai - bi;
    return a.start - b.start;
  });

  // Diversity pass: drop near-duplicate low scores when over soft max
  const final: SelectedClip[] = [];
  let used = 0;
  const byScore = [...ordered].sort((a, b) => b.score - a.score);
  const keepSet = new Set<SelectedClip>();
  for (const clip of byScore) {
    if (used >= softMax && clip.score < 0.55) continue;
    keepSet.add(clip);
    used += clip.duration;
  }

  for (const clip of ordered) {
    if (!keepSet.has(clip)) continue;
    if (clip.duration < 1.1) continue;
    final.push(clip);
  }

  if (final.length === 0 && input.files[0]) {
    final.push({
      sourcePath: input.files[0].path,
      start: 0,
      duration: Math.min(6, input.files[0].duration),
      score: 0.5,
    });
  }

  // Narrative + beat-aware finishing
  const moodProfile = getMood(input.mood);
  return applyBeatSync(applyNarrativeArc(final), moodProfile);
}

export async function writeConcatList(path: string, files: string[]) {
  await writeFile(
    path,
    files.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
  );
}
