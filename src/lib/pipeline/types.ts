/**
 * Pipeline contracts — AI scores candidates only; FFmpeg executes from timeline.
 */

export const PIPELINE_STAGES = [
  "uploaded",
  "normalized",
  "frames_extracted",
  "scenes_detected",
  "deduped",
  "scored",
  "timeline_ready",
  "rendering",
  "done",
  "failed",
  "retrying",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const JOB_PIPELINE_STAGES = [
  "queued",
  "ingesting",
  "selecting",
  "timeline_ready",
  "rendering",
  "completed",
  "failed",
  "retrying",
  "cancelled",
] as const;

export type JobPipelineStage = (typeof JOB_PIPELINE_STAGES)[number];

export type ArtifactKind =
  | "media_probe"
  | "proxy"
  | "frames"
  | "scenes"
  | "candidates"
  | "scores"
  | "timeline"
  | "render_manifest";

export type ArtifactRef = {
  kind: ArtifactKind;
  path: string;
  created_at: string;
  upload_id?: string | null;
  bytes?: number | null;
  meta?: Record<string, unknown>;
};

export type MediaProbeArtifact = {
  version: 1;
  upload_id: string;
  file_name: string;
  storage_path: string;
  duration_seconds: number;
  width: number;
  height: number;
  work_name?: string;
};

export type SceneArtifact = {
  version: 1;
  upload_id: string;
  times: number[];
};

export type CandidateClip = {
  upload_id: string;
  source_index: number;
  start: number;
  duration: number;
  local_score: number;
  frame_path?: string | null;
};

export type CandidatesArtifact = {
  version: 1;
  candidates: CandidateClip[];
};

export type ScoredClip = CandidateClip & {
  ai_score?: number | null;
  ai_provider?: string | null;
  final_score: number;
  reason?: string | null;
};

export type ScoresArtifact = {
  version: 1;
  scored: ScoredClip[];
  scoring_config: {
    local_threshold: number;
    ai_weight: number;
    prompt_id: string;
  };
};

export type TimelineSegment = {
  upload_id: string;
  source_index: number;
  start: number;
  duration: number;
  score: number;
  reason?: string | null;
};

export type TimelineArtifact = {
  version: 1;
  segments: TimelineSegment[];
  mood: string;
  music_track_id: string | null;
  music_mode: string;
  outputs: Array<"landscape" | "vertical">;
  end_card: {
    hide: boolean;
    title: string | null;
    show_date: boolean;
  };
};

export type RenderManifestArtifact = {
  version: 1;
  generation: number;
  landscape_path: string | null;
  vertical_path: string | null;
  preview_path: string | null;
  duration_seconds: number | null;
};

export type PipelineJobState = {
  job_id: string;
  user_id: string;
  stage: JobPipelineStage;
  failed_stage: string | null;
  attempt: number;
  artifacts: ArtifactRef[];
  updated_at: string;
};

/** Stable scoring snapshot — change prompt_id when prompt text changes. */
export const SCORING_CONFIG = {
  local_threshold: 0.18,
  ai_weight: 1.2,
  prompt_id: "memory-frame-v1",
} as const;

export const LEASE_STALE_MS = 3 * 60 * 1000;
export const LEASE_HEARTBEAT_MS = 30_000;
export const DEFAULT_MAX_GLOBAL_ENCODES = 4;
export const DEFAULT_MAX_USER_ENCODES = 1;
