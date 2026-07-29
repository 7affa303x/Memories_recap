import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasVisionProvider, scoreMemoryFrame } from "@/lib/ai-vision";
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
  // Lightweight brightness/contrast proxy from JPEG bytes (not full decode).
  // Good enough to reject near-black / flat frames without heavy deps.
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
  // Prefer mid brightness + some contrast (faces/scenes usually sit here)
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
  // Always include chronological grid samples for coverage/diversity
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
 * Smart clip selection: scene changes + brightness/contrast scoring.
 * Keeps chronological order, spreads diversity, avoids black/flat frames.
 * Optional vision boost via Gemini → Groq → OpenAI when keys are set.
 */
export async function selectBestClips(input: {
  bin: string;
  workDir: string;
  files: Array<{ path: string; duration: number }>;
  targetSeconds?: number;
}): Promise<SelectedClip[]> {
  const target = input.targetSeconds ?? 48;
  const perSourceBudget = Math.max(
    1,
    Math.ceil(target / Math.max(1, input.files.length))
  );
  const selected: SelectedClip[] = [];

  for (const [fileIndex, file] of input.files.entries()) {
    const candidates = await detectSceneTimes(
      input.bin,
      file.path,
      file.duration
    );
    const scored: Array<{ start: number; score: number }> = [];

    for (const [i, at] of candidates.entries()) {
      const framePath = join(
        input.workDir,
        `frame-${fileIndex}-${i}.jpg`
      );
      try {
        await extractFrame(input.bin, file.path, at, framePath);
        const buf = await readFile(framePath);
        const { score } = scoreJpegBuffer(buf);
        // Mild preference for earlier chronological moments within a source
        const chronoBias = 1 - (i / Math.max(1, candidates.length)) * 0.08;
        scored.push({ start: at, score: score * chronoBias });
      } catch {
        // skip bad frames
      }
    }

    scored.sort((a, b) => b.score - a.score);

    // Vision AI: re-score top local candidates before picking
    if (hasVisionProvider()) {
      const top = scored.slice(0, Math.min(8, scored.length));
      for (const [i, candidate] of top.entries()) {
        const framePath = join(
          input.workDir,
          `ai-cand-${fileIndex}-${i}.jpg`
        );
        try {
          await extractFrame(input.bin, file.path, candidate.start, framePath);
          const vision = await scoreMemoryFrame(framePath);
          if (vision) candidate.score += vision.score * 1.15;
        } catch {
          // keep local score
        }
      }
      scored.sort((a, b) => b.score - a.score);
      logInfo("vision_candidates_scored", {
        fileIndex,
        count: top.length,
      });
    }

    const clipLen = Math.min(
      7,
      Math.max(2.5, perSourceBudget / Math.max(1, Math.min(3, scored.length)))
    );
    const picked: number[] = [];
    for (const candidate of scored) {
      if (picked.length >= Math.min(3, Math.max(1, Math.ceil(perSourceBudget / clipLen)))) {
        break;
      }
      // Diversity: avoid overlapping windows
      if (picked.some((t) => Math.abs(t - candidate.start) < clipLen * 0.85)) {
        continue;
      }
      if (candidate.score < 0.18) continue;
      picked.push(candidate.start);
    }

    if (picked.length === 0) {
      const fallbackStart = Math.max(0, file.duration / 2 - clipLen / 2);
      picked.push(fallbackStart);
    }

    picked
      .sort((a, b) => a - b)
      .forEach((start) => {
        const match = scored.find((s) => s.start === start);
        selected.push({
          sourcePath: file.path,
          start,
          duration: Math.min(clipLen, Math.max(1.5, file.duration - start)),
          score: match?.score ?? 1,
        });
      });
  }

  // Trim to target length while keeping chronological order
  // Prefer higher scores when over budget by dropping weakest within order windows later if needed.
  const ordered = selected.sort((a, b) => {
    const ai = input.files.findIndex((f) => f.path === a.sourcePath);
    const bi = input.files.findIndex((f) => f.path === b.sourcePath);
    if (ai !== bi) return ai - bi;
    return a.start - b.start;
  });

  const final: SelectedClip[] = [];
  let used = 0;
  for (const clip of ordered) {
    if (used >= target) break;
    const duration = Math.min(clip.duration, target - used);
    if (duration < 1.2) continue;
    final.push({ ...clip, duration });
    used += duration;
  }

  if (final.length === 0 && input.files[0]) {
    final.push({
      sourcePath: input.files[0].path,
      start: 0,
      duration: Math.min(6, input.files[0].duration),
      score: 0.5,
    });
  }

  return final;
}

export async function writeConcatList(path: string, files: string[]) {
  await writeFile(
    path,
    files.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
  );
}
