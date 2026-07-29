import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { customAlphabet } from "nanoid";
import { getServiceSupabase } from "@/lib/supabase/admin";
import type {
  JobRow,
  JobStatus,
  RecapRow,
  ShareIndex,
  UploadRow,
  UserRow,
} from "@/lib/types";
import { RECAP_TTL_DAYS } from "@/lib/types";

const BUCKET = "app-data";
const jobId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 26);
const shareToken = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  28
);

async function readJson<T>(path: string): Promise<T | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as T;
}

async function writeJson(path: string, value: unknown) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(
    path,
    JSON.stringify(value, null, 2),
    { contentType: "application/json", upsert: true }
  );
  if (error) throw new Error(error.message);
}

async function removePath(path: string) {
  const supabase = getServiceSupabase();
  await supabase.storage.from(BUCKET).remove([path]);
}

async function listJsonPaths(folder: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder || undefined, { limit: 1000 });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((item) => item.name.endsWith(".json"))
    .map((item) => `${folder ? `${folder}/` : ""}${item.name}`);
}

export function hashSharePassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySharePassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch {
    return false;
  }
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
  title?: string | null;
}) {
  const id = jobId();
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
    share_token: null,
    share_expires_at: null,
    share_password_hash: null,
    credits_charged: null,
    title: input.title ?? null,
    recap_options: null,
    version: 0,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  await writeJson(`jobs/${input.userId}/${id}.json`, job);
  return job;
}

export async function getJobForUser(jobIdValue: string, userId: string) {
  return readJson<JobRow>(`jobs/${userId}/${jobIdValue}.json`);
}

export async function listJobsForUser(userId: string) {
  const paths = await listJsonPaths(`jobs/${userId}`);
  const jobs: JobRow[] = [];
  for (const path of paths) {
    const row = await readJson<JobRow>(path);
    if (row) jobs.push(row);
  }
  return jobs.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateJob(
  jobIdValue: string,
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
      | "share_token"
      | "share_expires_at"
      | "share_password_hash"
      | "credits_charged"
      | "title"
      | "folder"
      | "recap_options"
      | "recap_generation"
    >
  >
) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await getJobForUser(jobIdValue, userId);
    if (!current) throw new Error("Job not found");
    const expected = current.version ?? 0;
    const next: JobRow = {
      ...current,
      ...patch,
      version: expected + 1,
      updated_at: new Date().toISOString(),
    };
    const confirm = await getJobForUser(jobIdValue, userId);
    if (!confirm || (confirm.version ?? 0) !== expected) continue;
    await writeJson(`jobs/${userId}/${jobIdValue}.json`, next);
    return next;
  }
  throw new Error("Could not update job (concurrent writes)");
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
  const id = jobId();
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

export async function listUploads(jobIdValue: string, userId: string) {
  const paths = await listJsonPaths(`uploads/${userId}/${jobIdValue}`);
  const uploads: UploadRow[] = [];
  for (const path of paths) {
    const row = await readJson<UploadRow>(path);
    if (row) uploads.push(row);
  }
  return uploads.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getUpload(
  jobIdValue: string,
  userId: string,
  uploadId: string
) {
  return readJson<UploadRow>(`uploads/${userId}/${jobIdValue}/${uploadId}.json`);
}

export async function deleteUpload(
  jobIdValue: string,
  userId: string,
  uploadId: string
) {
  const upload = await getUpload(jobIdValue, userId, uploadId);
  if (upload?.storage_path) {
    const supabase = getServiceSupabase();
    await supabase.storage.from("memories").remove([upload.storage_path]);
  }
  await removePath(`uploads/${userId}/${jobIdValue}/${uploadId}.json`);
}

export async function upsertRecap(input: {
  jobId: string;
  userId: string;
  landscapePath: string;
  verticalPath: string;
  durationSeconds: number;
  highlightsPath?: string | null;
  storyPath?: string | null;
  tiktokPath?: string | null;
  mood?: string | null;
  ttlDays?: number;
  generation?: number;
}) {
  const existing = await readJson<RecapRow>(
    `recaps/${input.userId}/${input.jobId}.json`
  );
  const ttl = input.ttlDays ?? RECAP_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString();
  const generation =
    input.generation ??
    (existing?.current_generation ? existing.current_generation + 1 : 1);
  const versionEntry = {
    generation,
    landscape_path: input.landscapePath,
    vertical_path: input.verticalPath,
    highlights_path: input.highlightsPath ?? null,
    story_path: input.storyPath ?? null,
    tiktok_path: input.tiktokPath ?? null,
    mood: input.mood ?? null,
    created_at: new Date().toISOString(),
  };
  const versions = [...(existing?.versions || []), versionEntry].slice(-12);
  const recap: RecapRow = {
    id: existing?.id ?? jobId(),
    job_id: input.jobId,
    user_id: input.userId,
    landscape_path: input.landscapePath,
    vertical_path: input.verticalPath,
    highlights_path: input.highlightsPath ?? null,
    story_path: input.storyPath ?? null,
    tiktok_path: input.tiktokPath ?? null,
    duration_seconds: input.durationSeconds,
    expires_at: expiresAt,
    created_at: existing?.created_at ?? new Date().toISOString(),
    current_generation: generation,
    versions,
  };
  await writeJson(`recaps/${input.userId}/${input.jobId}.json`, recap);
  return recap;
}

export async function getRecap(jobIdValue: string, userId: string) {
  return readJson<RecapRow>(`recaps/${userId}/${jobIdValue}.json`);
}

export async function ensureShareLink(
  jobIdValue: string,
  userId: string,
  options?: {
    expiresInDays?: number;
    password?: string | null;
    audience?: "public" | "family" | null;
  }
) {
  const job = await getJobForUser(jobIdValue, userId);
  if (!job) throw new Error("Job not found");

  const token = job.share_token || shareToken();
  const expiresAt = options?.expiresInDays
    ? new Date(
        Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000
      ).toISOString()
    : job.share_expires_at ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const passwordHash = options?.password
    ? hashSharePassword(options.password)
    : job.share_password_hash;

  const audience = options?.audience ?? null;

  const updated = await updateJob(jobIdValue, userId, {
    share_token: token,
    share_expires_at: expiresAt,
    share_password_hash: passwordHash,
  });

  const index: ShareIndex = {
    token,
    job_id: jobIdValue,
    user_id: userId,
    expires_at: expiresAt,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
    audience,
  };
  await writeJson(`shares/${token}.json`, index);
  return { job: updated, token, expiresAt, audience };
}

export async function getShareByToken(token: string) {
  return readJson<ShareIndex>(`shares/${token}.json`);
}

export async function appendJobLog(
  userId: string,
  jobIdValue: string,
  message: string,
  extra?: Record<string, unknown>
) {
  const path = `logs/${userId}/${jobIdValue}.json`;
  const existing =
    (await readJson<{ lines: Array<Record<string, unknown>> }>(path)) || {
      lines: [],
    };
  existing.lines.push({
    at: new Date().toISOString(),
    message,
    ...extra,
  });
  if (existing.lines.length > 200) {
    existing.lines = existing.lines.slice(-200);
  }
  await writeJson(path, existing);
}

export async function listQueuedJobs(limit = 10) {
  // Best-effort scan of recent user folders is expensive; use queue index.
  const paths = await listJsonPaths("queue");
  const items: Array<{ jobId: string; userId: string; at: string }> = [];
  for (const path of paths) {
    const row = await readJson<{ jobId: string; userId: string; at: string }>(
      path
    );
    if (row) items.push(row);
  }
  return items
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, limit);
}

export async function enqueueJob(jobIdValue: string, userId: string) {
  await writeJson(`queue/${jobIdValue}.json`, {
    jobId: jobIdValue,
    userId,
    at: new Date().toISOString(),
  });
}

export async function dequeueJob(jobIdValue: string) {
  await removePath(`queue/${jobIdValue}.json`);
}

export function fingerprintUpload(fileName: string, size: number) {
  return createHash("sha256").update(`${fileName}:${size}`).digest("hex").slice(0, 16);
}

export type { JobStatus };
