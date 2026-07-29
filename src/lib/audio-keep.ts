import { spawn } from "node:child_process";

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

/**
 * Detect whether a clip window has a "keep-worthy" audio moment
 * (laughter / cheer / loud reaction) vs random ambient noise.
 * Uses ffmpeg astats mean_volume over the window.
 */
export async function shouldKeepOriginalAudio(input: {
  bin: string;
  sourcePath: string;
  start: number;
  duration: number;
}): Promise<{ keep: boolean; meanDb: number; peakDb: number }> {
  const { stderr } = await runCapture(input.bin, [
    "-ss",
    input.start.toFixed(2),
    "-t",
    Math.max(0.8, input.duration).toFixed(2),
    "-i",
    input.sourcePath,
    "-af",
    "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
    "-f",
    "null",
    "-",
  ]);

  const rmsMatches = [...stderr.matchAll(/RMS_level\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi)];
  const peakMatches = [
    ...stderr.matchAll(/Peak_level\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi),
  ];
  const rmsValues = rmsMatches.map((m) => Number(m[1])).filter(Number.isFinite);
  const peakValues = peakMatches
    .map((m) => Number(m[1]))
    .filter(Number.isFinite);

  const meanDb =
    rmsValues.length > 0
      ? rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
      : -80;
  const peakDb = peakValues.length > 0 ? Math.max(...peakValues) : meanDb;

  // Keep loud, dynamic moments; drop near-silence / flat ambient
  const keep = meanDb > -28 && peakDb > -18 && peakDb - meanDb > 4;
  return { keep, meanDb, peakDb };
}
