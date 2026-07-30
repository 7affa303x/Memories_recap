/** Shared helpers for gallery video acceptance (phones often omit MIME). */

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|3gp|mts|m2ts|hevc)$/i;

export const MAX_FILES_PER_JOB = 8;
/**
 * Per-file ceiling — honest for serverless encode window.
 * Larger files need the dedicated worker path (future).
 */
export const MAX_FILE_BYTES = 768 * 1024 * 1024; // 768 MB
export const MAX_BYTES_PER_JOB = 1536 * 1024 * 1024; // 1.5 GB

/**
 * Supabase Free plan global storage limit is 50 MB.
 * Files at or above this use Vercel Blob instead.
 */
export const SUPABASE_DIRECT_MAX_BYTES = 45 * 1024 * 1024;

export function usesBlobUpload(sizeBytes: number) {
  return sizeBytes >= SUPABASE_DIRECT_MAX_BYTES;
}

export function isLikelyVideoFile(name: string, type?: string | null) {
  if (type?.startsWith("video/")) return true;
  if (type === "application/octet-stream" && VIDEO_EXT.test(name)) return true;
  if ((!type || type === "") && VIDEO_EXT.test(name)) return true;
  return VIDEO_EXT.test(name);
}

export function inferVideoMime(name: string, type?: string | null) {
  if (type?.startsWith("video/")) return type;
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.m4v$/i.test(name)) return "video/x-m4v";
  if (/\.mkv$/i.test(name)) return "video/x-matroska";
  if (/\.avi$/i.test(name)) return "video/x-msvideo";
  if (/\.3gp$/i.test(name)) return "video/3gpp";
  return "video/mp4";
}

export function friendlyFileLimitMessage(kind: "file" | "total" | "count") {
  if (kind === "count") {
    return `Take your time — up to ${MAX_FILES_PER_JOB} videos in one recap works best.`;
  }
  if (kind === "file") {
    return "That one clip is a bit heavy for one file (max ~768 MB). Split it or compress a little — we’re still here for the rest.";
  }
  return "This batch is over ~1.5 GB total. Remove one clip or split into two recaps — your memories are worth a clean render.";
}

export function formatLimitHint() {
  return `Up to ${MAX_FILES_PER_JOB} videos · ~${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB each · ~${(MAX_BYTES_PER_JOB / (1024 * 1024 * 1024)).toFixed(1)} GB total`;
}

/** Client-side batch validation before hitting the API. */
export function validateLocalVideoBatch(files: File[]) {
  if (files.length === 0) {
    return { ok: false as const, error: "Add at least one video from your gallery." };
  }
  if (files.length > MAX_FILES_PER_JOB) {
    return { ok: false as const, error: friendlyFileLimitMessage("count") };
  }
  for (const file of files) {
    if (!isLikelyVideoFile(file.name, file.type)) {
      return {
        ok: false as const,
        error: `"${file.name}" doesn’t look like a video we can read. Try mp4 or mov.`,
      };
    }
    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false as const,
        error: `"${file.name}" is too large (${friendlyFileLimitMessage("file")})`,
      };
    }
    if (!file.size) {
      return {
        ok: false as const,
        error: `"${file.name}" came through empty. Pick it again from your gallery.`,
      };
    }
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_BYTES_PER_JOB) {
    return { ok: false as const, error: friendlyFileLimitMessage("total") };
  }
  return { ok: true as const, totalBytes: total };
}
