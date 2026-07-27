export type JobStatus =
  | "pending"
  | "uploading"
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
  created_at: string;
};

export const STAGE_LABELS: Record<string, string> = {
  analyzing: "Analyzing scenes",
  selecting: "Selecting best moments",
  building: "Building recap",
  rendering: "Rendering",
  uploading: "Uploading memories",
  pending: "Preparing",
  completed: "Done",
  failed: "Something went wrong",
};

export function estimateProcessingSeconds(totalBytes: number, fileCount: number) {
  const mb = totalBytes / (1024 * 1024);
  return Math.max(45, Math.round(mb * 1.8 + fileCount * 12));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
