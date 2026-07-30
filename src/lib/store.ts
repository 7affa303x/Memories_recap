import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
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
    if (row && !row.hidden) jobs.push(row);
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
      | "notify_email"
      | "share_token"
      | "share_expires_at"
      | "share_password_hash"
      | "credits_charged"
      | "title"
      | "recap_options"
      | "recap_generation"
      | "completed_at"
      | "folder"
      | "hidden"
    >
  >
) {
  const path = `jobs/${userId}/${jobIdValue}.json`;
  const existing = await readJson<JobRow>(path);
  if (!existing) throw new Error("Job not found");

  const job: JobRow = {
    ...existing,
    ...patch,
    version: (existing.version || 0) + 1,
    updated_at: new Date().toISOString(),
  };
  await writeJson(path, job);
  return job;
}

export async function upsertRecap(input: Omit<RecapRow, "created_at" | "updated_at">) {
  const path = `recaps/${input.userId}/${input.jobId}.json`;
  const existing = await readJson<RecapRow>(path);
  const now = new Date().toISOString();
  const recap: RecapRow = {
    ...input,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeJson(path, recap);
  return recap;
}

export async function getRecapForJob(jobIdValue: string, userId: string) {
  return readJson<RecapRow>(`recaps/${userId}/${jobIdValue}.json`);
}

export async function listRecapsForUser(userId: string) {
  const paths = await listJsonPaths(`recaps/${userId}`);
  const recaps: RecapRow[] = [];
  for (const path of paths) {
    const row = await readJson<RecapRow>(path);
    if (row) recaps.push(row);
  }
  return recaps.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function listAllRecaps(limit = 1000) {
  const userFolders = await listFolders("recaps");
  const all: RecapRow[] = [];
  for (const userDir of userFolders) {
    const paths = await listJsonPaths(`recaps/${userDir}`);
    for (const path of paths) {
      const row = await readJson<RecapRow>(path);
      if (row) all.push(row);
      if (all.length >= limit) break;
    }
    if (all.length >= limit) break;
  }
  return all;
}

async function listFolders(root: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).list(root);
  if (error) return [];
  return (data ?? []).map((d) => d.name);
}

export async function addUpload(
  jobIdValue: string,
  userId: string,
  input: Omit<UploadRow, "id" | "job_id" | "user_id" | "created_at">
) {
  const id = customAlphabet("0123456789abcdef", 16)();
  const upload: UploadRow = {
    ...input,
    id,
    job_id: jobIdValue,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  await writeJson(`uploads/${userId}/${jobIdValue}/${id}.json`, upload);
  return upload;
}

export async function listUploads(jobIdValue: string, userId: string) {
  const paths = await listJsonPaths(`uploads/${userId}/${jobIdValue}`);
  const uploads: UploadRow[] = [];
  for (const path of paths) {
    const row = await readJson<UploadRow>(path);
    if (row) uploads.push(row);
  }
  return uploads.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function removeUpload(
  jobIdValue: string,
  userId: string,
  uploadId: string
) {
  await removePath(`uploads/${userId}/${jobIdValue}/${uploadId}.json`);
}

export async function createShareLink(input: {
  jobId: string;
  userId: string;
  expiresAt?: string | null;
  password?: string | null;
}) {
  const token = shareToken();
  const now = new Date().toISOString();
  const share: ShareIndex = {
    token,
    job_id: input.jobId,
    user_id: input.userId,
    expires_at: input.expiresAt ?? null,
    password_hash: input.password ? hashSharePassword(input.password) : null,
    created_at: now,
  };
  await writeJson(`shares/${token}.json`, share);
  return share;
}

export async function getShareByToken(token: string) {
  return readJson<ShareIndex>(`shares/${token}.json`);
}

export async function removeShare(token: string) {
  await removePath(`shares/${token}.json`);
}

export async function enqueueJob(jobIdValue: string, userId: string) {
  await writeJson(`queue/${jobIdValue}.json`, {
    jobId: jobIdValue,
    userId,
    enqueued_at: new Date().toISOString(),
  });
}

export async function dequeueJob(jobIdValue: string) {
  await removePath(`queue/${jobIdValue}.json`);
}

export async function listQueuedJobs(limit = 10) {
  const paths = await listJsonPaths("queue");
  const queued: Array<{ jobId: string; userId: string; enqueued_at: string }> =
    [];
  for (const path of paths.slice(0, limit)) {
    const row = await readJson<{
      jobId: string;
      userId: string;
      enqueued_at: string;
    }>(path);
    if (row) queued.push(row);
  }
  return queued.sort(
    (a, b) =>
      new Date(a.enqueued_at).getTime() - new Date(b.enqueued_at).getTime()
  );
}

export async function enqueueProcessingClaim(jobIdValue: string, userId: string) {
  await writeJson(`processing/${jobIdValue}.json`, {
    jobId: jobIdValue,
    userId,
    claimed_at: new Date().toISOString(),
  });
}

export async function clearProcessingClaim(jobIdValue: string) {
  await removePath(`processing/${jobIdValue}.json`);
}

export async function listProcessingClaims(limit = 20) {
  const paths = await listJsonPaths("processing");
  const claims: Array<{ jobId: string; userId: string; claimed_at: string }> =
    [];
  for (const path of paths.slice(0, limit)) {
    const row = await readJson<{
      jobId: string;
      userId: string;
      claimed_at: string;
    }>(path);
    if (row) claims.push(row);
  }
  return claims;
}

export async function appendJobLog(
  userId: string,
  jobIdValue: string,
  event: string,
  data?: unknown
) {
  const now = new Date().toISOString();
  const log = { event, data, timestamp: now };
  const path = `logs/${userId}/${jobIdValue}.json`;
  const existing = (await readJson<unknown[]>(path)) || [];
  existing.push(log);
  await writeJson(path, existing);
}

export async function cleanupExpiredRecaps(limit = 50) {
  const all = await listAllRecaps(limit * 2);
  const now = new Date();
  let count = 0;
  for (const recap of all) {
    if (count >= limit) break;
    const expiry = new Date(recap.created_at);
    expiry.setDate(expiry.getDate() + (recap.ttlDays || RECAP_TTL_DAYS));
    if (now > expiry) {
      await deleteRecapMedia(recap);
      await removePath(`recaps/${recap.userId}/${recap.jobId}.json`);
      await updateJob(recap.jobId, recap.userId, { hidden: true });
      count++;
    }
  }
  return count;
}

async function deleteRecapMedia(recap: RecapRow) {
  const supabase = getServiceSupabase();
  const paths = [
    recap.landscapePath,
    recap.verticalPath,
    recap.highlightsPath,
    recap.storyPath,
    recap.tiktokPath,
    recap.previewPath,
  ].filter(Boolean) as string[];

  if (paths.length > 0) {
    await supabase.storage.from("memories").remove(paths);
  }

  // Also try to delete from Vercel Blob if used (paths might be blob URLs)
  const { del } = await import("@vercel/blob");
  for (const p of paths) {
    if (p.startsWith("http") && p.includes("public.blob.vercel-storage.com")) {
      await del(p).catch(() => undefined);
    }
  }
}
