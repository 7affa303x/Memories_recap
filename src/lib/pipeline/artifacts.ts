import { getServiceSupabase } from "@/lib/supabase/admin";
import type {
  ArtifactKind,
  ArtifactRef,
  PipelineJobState,
} from "@/lib/pipeline/types";

const BUCKET = "app-data";

function artifactDir(userId: string, jobId: string) {
  return `artifacts/${userId}/${jobId}`;
}

function statePath(userId: string, jobId: string) {
  return `${artifactDir(userId, jobId)}/_pipeline.json`;
}

async function readJson<T>(path: string): Promise<T | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as T;
}

async function writeJson(path: string, value: unknown) {
  const supabase = getServiceSupabase();
  const body = JSON.stringify(value, null, 2);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return body.length;
}

export async function getPipelineState(
  userId: string,
  jobId: string
): Promise<PipelineJobState | null> {
  return readJson<PipelineJobState>(statePath(userId, jobId));
}

export async function savePipelineState(state: PipelineJobState) {
  await writeJson(statePath(state.user_id, state.job_id), state);
  return state;
}

export async function ensurePipelineState(
  userId: string,
  jobId: string,
  attempt = 1
): Promise<PipelineJobState> {
  const existing = await getPipelineState(userId, jobId);
  if (existing) return existing;
  const state: PipelineJobState = {
    job_id: jobId,
    user_id: userId,
    stage: "queued",
    failed_stage: null,
    attempt,
    artifacts: [],
    updated_at: new Date().toISOString(),
  };
  await savePipelineState(state);
  return state;
}

export async function setPipelineStage(
  userId: string,
  jobId: string,
  stage: PipelineJobState["stage"],
  extra?: Partial<Pick<PipelineJobState, "failed_stage" | "attempt">>
) {
  const state = await ensurePipelineState(userId, jobId);
  const next: PipelineJobState = {
    ...state,
    stage,
    failed_stage: extra?.failed_stage ?? state.failed_stage,
    attempt: extra?.attempt ?? state.attempt,
    updated_at: new Date().toISOString(),
  };
  await savePipelineState(next);
  return next;
}

export async function writeArtifact<T>(input: {
  userId: string;
  jobId: string;
  kind: ArtifactKind;
  name: string;
  data: T;
  uploadId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<ArtifactRef> {
  const path = `${artifactDir(input.userId, input.jobId)}/${input.name}`;
  const bytes = await writeJson(path, input.data);
  const ref: ArtifactRef = {
    kind: input.kind,
    path,
    created_at: new Date().toISOString(),
    upload_id: input.uploadId ?? null,
    bytes,
    meta: input.meta,
  };

  const state = await ensurePipelineState(input.userId, input.jobId);
  const artifacts = [
    ...state.artifacts.filter(
      (a) => !(a.kind === ref.kind && a.upload_id === ref.upload_id)
    ),
    ref,
  ];
  await savePipelineState({
    ...state,
    artifacts,
    updated_at: new Date().toISOString(),
  });

  return ref;
}

export async function readArtifact<T>(
  userId: string,
  jobId: string,
  kind: ArtifactKind,
  uploadId?: string | null
): Promise<T | null> {
  const state = await getPipelineState(userId, jobId);
  if (!state) return null;
  const ref = state.artifacts.find(
    (a) =>
      a.kind === kind &&
      (uploadId === undefined || (a.upload_id ?? null) === (uploadId ?? null))
  );
  if (!ref) return null;
  return readJson<T>(ref.path);
}
