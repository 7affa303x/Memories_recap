export type JobStatus =
  | "pending"
  | "uploading"
  | "queued"
  | "analyzing"
  | "selecting"
  | "building"
  | "rendering"
  | "completed"
  | "failed";

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
  recap_options?: RecapOptions | null;
  version: number;
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

export type RecapRow = {
  id: string;
  job_id: string;
  user_id: string;
  landscape_path: string | null;
  vertical_path: string | null;
  duration_seconds: number | null;
  expires_at: string | null;
  created_at: string;
};

export type ShareIndex = {
  token: string;
  job_id: string;
  user_id: string;
  expires_at: string | null;
  password_hash: string | null;
  created_at: string;
};

export const STAGE_LABELS: Record<string, string> = {
  analyzing: "Analyzing scenes",
  selecting: "Choosing best moments",
  building: "Building your recap",
  rendering: "Rendering landscape & vertical",
  uploading: "Uploading memories",
  queued: "In queue",
  pending: "Preparing",
  completed: "Done",
  failed: "Something went wrong",
};

export const MAX_FILES_PER_JOB = 12;
export const MAX_BYTES_PER_JOB = 2 * 1024 * 1024 * 1024; // 2 GB safer for Vercel
export const MAX_FILE_BYTES = 800 * 1024 * 1024;
export const RECAP_TTL_DAYS = 30;

export function estimateProcessingSeconds(totalBytes: number, fileCount: number) {
  const mb = totalBytes / (1024 * 1024);
  return Math.max(60, Math.round(mb * 2.2 + fileCount * 15));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "Almost done";
  if (seconds < 60) return `About ${seconds}s left`;
  const mins = Math.ceil(seconds / 60);
  return `About ${mins} min left`;
}
