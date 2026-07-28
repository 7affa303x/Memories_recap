import ffmpegPath from "ffmpeg-static";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { selectBestClips, probeDuration } from "../src/lib/smart-select";

async function main() {
  const bin = ffmpegPath;
  if (!bin) throw new Error("no ffmpeg");
  const workDir = await mkdtemp(join(tmpdir(), "recap-sel-"));
  const file = "/tmp/recap-smoke/sample.mp4";
  const duration = await probeDuration(bin, file);
  const picks = await selectBestClips({
    bin,
    workDir,
    files: [{ path: file, duration }],
    targetSeconds: 6,
  });
  console.log(JSON.stringify({ duration, pickCount: picks.length, picks }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
