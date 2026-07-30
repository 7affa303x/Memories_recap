export type JobStatus =
  | "pending"
  | "uploading"
  | "queued"
  | "analyzing"
  | "selecting"
  | "building"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
};

export type RecapOptions = {
  musicMode: "none" | "manual" | "auto";
  trackId?: string | null;
  mood?: "joyful" | "nostalgic" | "chill" | "epic" | null;
  /** Pro-only: uhd = 4K landscape / 4K-tall vertical */
  outputQuality?: "fhd" | "uhd" | null;
  folder?: string | null;
  /** Soft target recap length in seconds (omit/null = auto). */
  maxSeconds?: number | null;
  /** Optional end-card title line (drawn when font available). */
  endCardTitle?: string | null;
  /** Show date on end card when true. */
  endCardShowDate?: boolean | null;
  /** Pro-only: omit branded end card. */
  hideEndCard?: boolean | null;
};

export type JobRow = {
  id: string;
  user_id: string;
  status: JobStatus;
  stage: string | null;
  progress: number;
  eta_seconds: number | null;
  error: string | null;
  total_bytes: number;
  file_count: number;
  notify_email: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  share_password_hash: string | null;
  credits_charged: number | null;
  title: string | null;
  folder?: string | null;
  /** Soft-hidden from dashboard list (completed jobs removed by user). */
  hidden?: boolean;
  recap_options?: RecapOptions | null;
  /** Concurrent write counter */
  version: number;
  /** Recap render generation (v1, v2…) */
  recap_generation?: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type UploadRow = {
  id: string;
  job_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  duration_seconds: number | null;
  sort_order: number;
  created_at: string;
};

export type RecapVersion = {
  generation: number;
  landscape_path: string | null;
  vertical_path: string | null;
  highlights_path?: string | null;
  story_path?: string | null;
  tiktok_path?: string | null;
  preview_path?: string | null;
  mood?: string | null;
  created_at: string;
};

export type RecapRow = {
  id: string;
  job_id: string;
  user_id: string;
  landscape_path: string | null;
  vertical_path: string | null;
  highlights_path?: string | null;
  story_path?: string | null;
  tiktok_path?: string | null;
  preview_path?: string | null;
  duration_seconds: number | null;
  expires_at: string | null;
  created_at: string;
  current_generation?: number;
  versions?: RecapVersion[];
  /** Optional 1–5 user rating after watch */
  rating?: number | null;
  rated_at?: string | null;
};

export type ShareIndex = {
  token: string;
  job_id: string;
  user_id: string;
  expires_at: string | null;
  password_hash: string | null;
  created_at: string;
  audience?: "public" | "family" | null;
  /** Public view count (best-effort). */
  view_count?: number;
  last_viewed_at?: string | null;
};

export const STAGE_LABELS: Record<string, string> = {
  analyzing: "Analyzing scenes",
  ingesting: "Preparing your videos",
  selecting: "Choosing best moments",
  timeline_ready: "Timeline ready",
  building: "Building your recap",
  rendering: "Rendering landscape & vertical",
  uploading: "Uploading memories",
  queued: "In queue",
  pending: "Preparing",
  completed: "Done",
  failed: "Something went wrong",
  cancelled: "Cancelled",
  retrying: "Retrying",
};

export {
  MAX_FILES_PER_JOB,
  MAX_BYTES_PER_JOB,
  MAX_FILE_BYTES,
} from "@/lib/media";
export const RECAP_TTL_DAYS = 30;
export const RECAP_TTL_DAYS_PRO = 90;
/** Platform process route maxDuration (Vercel Fluid / serverless). */
export const PROCESS_MAX_DURATION_SECONDS = 300;

export function estimateProcessingSeconds(totalBytes: number, fileCount: number) {
  const mb = totalBytes / (1024 * 1024);
  return Math.max(60, Math.round(mb * 2.2 + fileCount * 15));
}

/** Honest warning when estimated time may exceed the ~5 min process window. */
export function softLimitDurationMessage(estimateSeconds: number) {
  if (estimateSeconds <= PROCESS_MAX_DURATION_SECONDS) return null;
  const mins = Math.ceil(PROCESS_MAX_DURATION_SECONDS / 60);
  return `Large batches can run past our ~${mins} minute processing window. Split into fewer or shorter clips so the render finishes cleanly.`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "Almost done";
  if (seconds < 60) return `About ${seconds}s left`;
  const mins = Math.ceil(seconds / 60);
  return `About ${mins} min left`;
}
