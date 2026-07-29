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
      | "total_bytes"
      | "file_count"
      | "completed_at"
      | "share_token"
      | "share_expires_at"
      | "share_password_hash"
      | "credits_charged"
      | "title"
      | "folder"
      | "hidden"
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
    await deleteMediaObject(upload.storage_path);
  }
  await removePath(`uploads/${userId}/${jobIdValue}/${uploadId}.json`);
}

/** Delete a media object from Vercel Blob or Supabase (memories, then recaps). */
export async function deleteMediaObject(storagePath: string) {
  if (!storagePath) return;
  if (storagePath.startsWith("blob:")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(storagePath.replace(/^blob:/, ""));
    } catch {
      // best-effort
    }
    return;
  }
  const supabase = getServiceSupabase();
  const memories = await supabase.storage.from("memories").remove([storagePath]);
  if (!memories.error) return;
  await supabase.storage.from("recaps").remove([storagePath]).catch(() => undefined);
}

function collectRecapMediaPaths(recap: RecapRow): string[] {
  const paths = new Set<string>();
  const add = (p: string | null | undefined) => {
    if (p) paths.add(p);
  };
  add(recap.landscape_path);
  add(recap.vertical_path);
  add(recap.highlights_path);
  add(recap.story_path);
  add(recap.tiktok_path);
  add(recap.preview_path);
  for (const version of recap.versions || []) {
    add(version.landscape_path);
    add(version.vertical_path);
    add(version.highlights_path);
    add(version.story_path);
    add(version.tiktok_path);
    add(version.preview_path);
  }
  return [...paths];
}

/**
 * Delete expired recap media objects and clear path fields.
 * Returns true when media was purged.
 */
export async function purgeExpiredRecapMedia(
  jobIdValue: string,
  userId: string
): Promise<boolean> {
  const path = `recaps/${userId}/${jobIdValue}.json`;
  const recap = await readJson<RecapRow>(path);
  if (!recap || !isRecapExpired(recap)) return false;

  const mediaPaths = collectRecapMediaPaths(recap);
  if (mediaPaths.length === 0) return false;

  await Promise.all(mediaPaths.map((p) => deleteMediaObject(p)));

  const clearedVersions = (recap.versions || []).map((v) => ({
    ...v,
    landscape_path: null as string | null,
    vertical_path: null as string | null,
    highlights_path: null as string | null,
    story_path: null as string | null,
    tiktok_path: null as string | null,
    preview_path: null as string | null,
  }));

  const cleared: RecapRow = {
    ...recap,
    landscape_path: null,
    vertical_path: null,
    highlights_path: null,
    story_path: null,
    tiktok_path: null,
    preview_path: null,
    versions: clearedVersions,
  };
  await writeJson(path, cleared).catch(() => undefined);
  return true;
}

/** Scan a bounded set of user/job recaps and purge expired media. */
export async function cleanupExpiredRecaps(limit = 40): Promise<number> {
  const supabase = getServiceSupabase();
  const { data: userFolders, error } = await supabase.storage
    .from(BUCKET)
    .list("recaps", { limit: 200 });
  if (error || !userFolders?.length) return 0;

  let cleaned = 0;
  for (const folder of userFolders) {
    if (cleaned >= limit) break;
    if (!folder.name || folder.name.includes(".")) continue;
    const userId = folder.name;
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`recaps/${userId}`, { limit: 100 });
    for (const file of files || []) {
      if (cleaned >= limit) break;
      if (!file.name.endsWith(".json")) continue;
      const jobIdValue = file.name.replace(/\.json$/, "");
      const did = await purgeExpiredRecapMedia(jobIdValue, userId);
      if (did) cleaned += 1;
    }
  }
  return cleaned;
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
  previewPath?: string | null;
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
    preview_path: input.previewPath ?? null,
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
    preview_path: input.previewPath ?? null,
    duration_seconds: input.durationSeconds,
    expires_at: expiresAt,
    created_at: existing?.created_at ?? new Date().toISOString(),
    current_generation: generation,
    versions,
    rating: existing?.rating ?? null,
    rated_at: existing?.rated_at ?? null,
  };
  await writeJson(`recaps/${input.userId}/${input.jobId}.json`, recap);
  return recap;
}

/** Point current recap media at a prior version (no re-render). */
export async function restoreRecapVersion(
  jobIdValue: string,
  userId: string,
  generation: number
) {
  const path = `recaps/${userId}/${jobIdValue}.json`;
  const recap = await readJson<RecapRow>(path);
  if (!recap) return null;
  const version = (recap.versions || []).find((v) => v.generation === generation);
  if (!version?.landscape_path) return null;
  const next: RecapRow = {
    ...recap,
    landscape_path: version.landscape_path,
    vertical_path: version.vertical_path,
    highlights_path: version.highlights_path ?? null,
    story_path: version.story_path ?? null,
    tiktok_path: version.tiktok_path ?? null,
    preview_path: version.preview_path ?? null,
    current_generation: version.generation,
  };
  await writeJson(path, next);
  return next;
}

export async function setRecapRating(
  jobIdValue: string,
  userId: string,
  rating: number
) {
  const path = `recaps/${userId}/${jobIdValue}.json`;
  const recap = await readJson<RecapRow>(path);
  if (!recap) return null;
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  const next: RecapRow = {
    ...recap,
    rating: clamped,
    rated_at: new Date().toISOString(),
  };
  await writeJson(path, next);
  return next;
}

export async function setRecapPreviewPath(
  jobIdValue: string,
  userId: string,
  previewPath: string
) {
  const path = `recaps/${userId}/${jobIdValue}.json`;
  const recap = await readJson<RecapRow>(path);
  if (!recap) return null;
  const generation = recap.current_generation || 1;
  const versions = (recap.versions || []).map((v) =>
    v.generation === generation ? { ...v, preview_path: previewPath } : v
  );
  const next: RecapRow = {
    ...recap,
    preview_path: previewPath,
    versions,
  };
  await writeJson(path, next);
  return next;
}

/** Light TTL helper: if expired, clear media paths on read. */
export function isRecapExpired(recap: RecapRow) {
  return Boolean(recap.expires_at && new Date(recap.expires_at) < new Date());
}

export async function getRecap(jobIdValue: string, userId: string) {
  const path = `recaps/${userId}/${jobIdValue}.json`;
  const recap = await readJson<RecapRow>(path);
  if (!recap) return null;
  if (!isRecapExpired(recap)) return recap;
  if (
    !recap.landscape_path &&
    !recap.vertical_path &&
    !recap.highlights_path &&
    !recap.story_path &&
    !recap.tiktok_path &&
    !recap.preview_path &&
    !(recap.versions || []).some(
      (v) =>
        v.landscape_path ||
        v.vertical_path ||
        v.highlights_path ||
        v.story_path ||
        v.tiktok_path ||
        v.preview_path
    )
  ) {
    return recap;
  }
  await purgeExpiredRecapMedia(jobIdValue, userId);
  return (await readJson<RecapRow>(path)) ?? recap;
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

/** Best-effort public view counter for share links. */
export async function recordShareView(token: string) {
  const path = `shares/${token}.json`;
  const share = await readJson<ShareIndex>(path);
  if (!share) return null;
  const next: ShareIndex = {
    ...share,
    view_count: (share.view_count || 0) + 1,
    last_viewed_at: new Date().toISOString(),
  };
  await writeJson(path, next);
  return next;
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

export type ProcessingClaim = {
  jobId: string;
  userId: string;
  startedAt: string;
};

/** Claim written when processJob starts so cron can find mid-process jobs. */
export async function enqueueProcessingClaim(
  jobIdValue: string,
  userId: string
) {
  await writeJson(`processing/${jobIdValue}.json`, {
    jobId: jobIdValue,
    userId,
    startedAt: new Date().toISOString(),
  } satisfies ProcessingClaim);
}

export async function clearProcessingClaim(jobIdValue: string) {
  await removePath(`processing/${jobIdValue}.json`);
}

export async function listProcessingClaims(limit = 50) {
  const paths = await listJsonPaths("processing");
  const items: ProcessingClaim[] = [];
  for (const path of paths) {
    const row = await readJson<ProcessingClaim>(path);
    if (row?.jobId && row?.userId) items.push(row);
  }
  return items
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )
    .slice(0, limit);
}

/**
 * Scan queue + processing claims for stuck-job recovery (avoids listing all users).
 */
export async function listRecentJobsForRecovery(limit = 50) {
  const queued = await listQueuedJobs(limit);
  const processing = await listProcessingClaims(limit);
  const byId = new Map<
    string,
    { jobId: string; userId: string; at: string; source: "queue" | "processing" }
  >();
  for (const item of queued) {
    byId.set(item.jobId, {
      jobId: item.jobId,
      userId: item.userId,
      at: item.at,
      source: "queue",
    });
  }
  for (const item of processing) {
    const existing = byId.get(item.jobId);
    if (!existing || new Date(item.startedAt) < new Date(existing.at)) {
      byId.set(item.jobId, {
        jobId: item.jobId,
        userId: item.userId,
        at: item.startedAt,
        source: "processing",
      });
    }
  }
  return [...byId.values()]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, limit);
}

export function fingerprintUpload(fileName: string, size: number) {
  return createHash("sha256").update(`${fileName}:${size}`).digest("hex").slice(0, 16);
}

export type { JobStatus };
