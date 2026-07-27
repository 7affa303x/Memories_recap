import { randomUUID } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/admin";
import type { JobRow, JobStatus, RecapRow, UploadRow, UserRow } from "@/lib/types";

const BUCKET = "app-data";

async function readJson<T>(path: string): Promise<T | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text) as T;
}

async function writeJson(path: string, value: unknown) {
  const supabase = getServiceSupabase();
  const body = JSON.stringify(value, null, 2);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

async function removePath(path: string) {
  const supabase = getServiceSupabase();
  await supabase.storage.from(BUCKET).remove([path]);
}

async function listPaths(prefix: string) {
  const supabase = getServiceSupabase();
  const normalized = prefix.replace(/\/$/, "");
  const parts = normalized.split("/");
  const folder = parts.slice(0, -1).join("/");
  const { data, error } = await supabase.storage.from(BUCKET).list(folder || undefined, {
    limit: 1000,
  });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => `${folder ? `${folder}/` : ""}${item.name}`);
}

export async function upsertUser(input: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const existing = await readJson<UserRow>(`users/${input.id}.json`);
  const now = new Date().toISOString();
  const user: UserRow = {
    id: input.id,
    email: input.email,
    name: input.name ?? null,
    image: input.image ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeJson(`users/${input.id}.json`, user);
  return user;
}

export async function createJob(input: {
  userId: string;
  email: string;
  totalBytes: number;
  fileCount: number;
  etaSeconds: number;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const job: JobRow = {
    id,
    user_id: input.userId,
    status: "uploading",
    stage: "uploading",
    progress: 0,
    eta_seconds: input.etaSeconds,
    error: null,
    total_bytes: input.totalBytes,
    file_count: input.fileCount,
    notify_email: input.email,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  await writeJson(`jobs/${input.userId}/${id}.json`, job);
  return job;
}

export async function getJobForUser(jobId: string, userId: string) {
  return readJson<JobRow>(`jobs/${userId}/${jobId}.json`);
}

export async function updateJob(
  jobId: string,
  userId: string,
  patch: Partial<
    Pick<
      JobRow,
      | "status"
      | "stage"
      | "progress"
      | "eta_seconds"
      | "error"
      | "total_bytes"
      | "file_count"
      | "completed_at"
    >
  >
) {
  const current = await getJobForUser(jobId, userId);
  if (!current) throw new Error("Job not found");
  const next: JobRow = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await writeJson(`jobs/${userId}/${jobId}.json`, next);
  return next;
}

export async function createUpload(input: {
  jobId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}) {
  const id = randomUUID();
  const upload: UploadRow = {
    id,
    job_id: input.jobId,
    user_id: input.userId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    duration_seconds: null,
    sort_order: input.sortOrder,
    created_at: new Date().toISOString(),
  };
  await writeJson(`uploads/${input.userId}/${input.jobId}/${id}.json`, upload);
  return upload;
}

export async function listUploads(jobId: string, userId: string) {
  const paths = await listPaths(`uploads/${userId}/${jobId}/x`);
  const uploads: UploadRow[] = [];
  for (const path of paths) {
    const row = await readJson<UploadRow>(path);
    if (row) uploads.push(row);
  }
  return uploads.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getUpload(jobId: string, userId: string, uploadId: string) {
  return readJson<UploadRow>(`uploads/${userId}/${jobId}/${uploadId}.json`);
}

export async function deleteUpload(jobId: string, userId: string, uploadId: string) {
  await removePath(`uploads/${userId}/${jobId}/${uploadId}.json`);
}

export async function upsertRecap(input: {
  jobId: string;
  userId: string;
  landscapePath: string;
  verticalPath: string;
  durationSeconds: number;
}) {
  const existing = await readJson<RecapRow>(`recaps/${input.userId}/${input.jobId}.json`);
  const recap: RecapRow = {
    id: existing?.id ?? randomUUID(),
    job_id: input.jobId,
    user_id: input.userId,
    landscape_path: input.landscapePath,
    vertical_path: input.verticalPath,
    duration_seconds: input.durationSeconds,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  await writeJson(`recaps/${input.userId}/${input.jobId}.json`, recap);
  return recap;
}

export async function getRecap(jobId: string, userId: string) {
  return readJson<RecapRow>(`recaps/${userId}/${jobId}.json`);
}

export type { JobStatus };
