import { join } from "node:path";
import { accessSync } from "node:fs";

export function endCardImagePath(orientation: "landscape" | "vertical") {
  const name =
    orientation === "vertical"
      ? "end-card-vertical.png"
      : "end-card-landscape.png";
  return join(process.cwd(), "public", "brand", name);
}

export function watermarkOverlayPath() {
  return join(process.cwd(), "public", "brand", "watermark-overlay.png");
}

export function resolveBundledFont() {
  const candidates = [
    join(process.cwd(), "public", "fonts", "DejaVuSerif.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  ];
  for (const path of candidates) {
    try {
      accessSync(path);
      return path;
    } catch {
      // next
    }
  }
  return null;
}

export const END_CARD_SECONDS = 1.8;

export type OutputQuality = "fhd" | "uhd";

export function renderSizes(quality: OutputQuality) {
  if (quality === "uhd") {
    return {
      landscape: { w: 3840, h: 2160 },
      vertical: { w: 2160, h: 3840 },
      crf: 20,
      preset: "fast" as const,
      watermarkScale: 3840,
    };
  }
  return {
    landscape: { w: 1920, h: 1080 },
    vertical: { w: 1080, h: 1920 },
    crf: 22,
    preset: "veryfast" as const,
    watermarkScale: 1920,
  };
}

/**
 * Overlay watermark at ~33% height (works with ffmpeg-static without drawtext).
 * Expects: input0 = video, input1 = watermark png
 */
export function watermarkOverlayFilter(videoWidth: number) {
  return `[1:v]scale=${videoWidth}:-1[wm];[0:v][wm]overlay=(W-w)/2:H*0.33-h/2,format=yuv420p`;
}
