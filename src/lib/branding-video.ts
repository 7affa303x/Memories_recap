import { join } from "node:path";
import { BRAND_NAME } from "@/lib/brand";

/** Free-tier overlay watermark — subtle, ~33% from top */
export function watermarkDrawtextFilter(options?: {
  fontSize?: number;
  yRatio?: number;
  opacity?: number;
}) {
  const fontSize = options?.fontSize ?? 28;
  const yRatio = options?.yRatio ?? 0.33;
  const opacity = options?.opacity ?? 0.38;
  const text = BRAND_NAME.replace(/:/g, "\\:");
  // Prefer bundled DejaVu if present; ffmpeg falls back gracefully
  const fontFile = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf";
  return `drawtext=fontfile=${fontFile}:text='${text}':fontsize=${fontSize}:fontcolor=white@${opacity}:x=(w-text_w)/2:y=h*${yRatio}`;
}

export function endCardImagePath(orientation: "landscape" | "vertical") {
  const name =
    orientation === "vertical"
      ? "end-card-vertical.png"
      : "end-card-landscape.png";
  return join(process.cwd(), "public", "brand", name);
}

export const END_CARD_SECONDS = 1.8;
