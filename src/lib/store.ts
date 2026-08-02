import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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

const jobId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 26);
const shareToken = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  28
);

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
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase.from("users").upsert({
    id: input.id,
    email: input.email,
    name: input.name ?? null,
    image: input.image ?? null,
    updated_at: now,
  }).select().single();

  if (error) throw new Error(error.message);
  return data as UserRow;
}

export async function createJob(input: {
  userId: string;
  email: string;
  totalBytes: number;
  fileCount: number;
  etaSeconds: number;
  title?: string | null;
}) {
  const supabase = getServiceSupabase();
  const id = jobId();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase.from("jobs").insert({
    id,
    user_id: input.userId,
    status: "uploading",
    stage: "uploading",
    progress: 0,
    eta_seconds: input.etaSeconds,
    total_bytes: input.totalBytes,
    file_count: input.fileCount,
    notify_email: input.email,
    title: input.title ?? null,
    version: 0,
    created_at: now,
    updated_at: now,
  }).select().single();

  if (error) throw new Error(error.message);
  return data as JobRow;
}

export async function getJobForUser(jobIdValue: string, userId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobIdValue)
    .eq("user_id", userId)
    .single();
    
  if (error) return null;
  return data as JobRow;
}

export async function listJobsForUser(userId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("hidden", false)
    .order("created_at", { ascending: false });
    
  if (error) throw new Error(error.message);
  return data as JobRow[];
}

export async function updateJob(
  jobIdValue: string,
  userId: string,
  patch: Partial<JobRow>
) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobIdValue)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as JobRow;
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
  const supabase = getServiceSupabase();
  const id = jobId();
  
  const { data, error } = await supabase.from("uploads").insert({
    id,
    job_id: input.jobId,
    user_id: input.userId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    sort_order: input.sortOrder,
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) throw new Error(error.message);
  return data as UploadRow;
}

export async function listUploads(jobIdValue: string, userId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("job_id", jobIdValue)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
    
  if (error) throw new Error(error.message);
  return data as UploadRow[];
}

export async function getUpload(
  jobIdValue: string,
  userId: string,
  uploadId: string
) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("job_id", jobIdValue)
    .eq("user_id", userId)
    .single();
    
  if (error) return null;
  return data as UploadRow;
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
  
  const supabase = getServiceSupabase();
  await supabase
    .from("uploads")
    .delete()
    .eq("id", uploadId)
    .eq("job_id", jobIdValue)
    .eq("user_id", userId);
}

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
  await supabase.storage.from("memories").remove([storagePath]);
  await supabase.storage.from("recaps").remove([storagePath]).catch(() => undefined);
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
  const supabase = getServiceSupabase();
  const ttl = input.ttlDays ?? RECAP_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: existing } = await supabase
    .from("recaps")
    .select("*")
    .eq("job_id", input.jobId)
    .single();

  const generation = input.generation ?? (existing?.current_generation ? existing.current_generation + 1 : 1);
  
  const { data, error } = await supabase.from("recaps").upsert({
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
    current_generation: generation,
    updated_at: new Date().toISOString(),
  }, { onConflict: "job_id" }).select().single();

  if (error) throw new Error(error.message);
  return data as RecapRow;
}

export async function getRecap(jobIdValue: string, userId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("recaps")
    .select("*")
    .eq("job_id", jobIdValue)
    .eq("user_id", userId)
    .single();
    
  if (error) return null;
  return data as RecapRow;
}

export async function appendJobLog(userId: string, jobId: string, event: string, detail?: any) {
  const supabase = getServiceSupabase();
  await supabase.from("pipeline_events").insert({
    job_id: jobId,
    user_id: userId,
    event,
    detail,
  });
}

export async function dequeueJob(jobId: string) {
  const supabase = getServiceSupabase();
  await supabase.from("job_leases").delete().eq("job_id", jobId);
}

export function isRecapExpired(recap: RecapRow) {
  return Boolean(recap.expires_at && new Date(recap.expires_at) < new Date());
}

export async function cleanupExpiredRecaps(limit = 40): Promise<number> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  
  const { data: expired } = await supabase
    .from("recaps")
    .select("job_id, user_id, landscape_path, vertical_path, highlights_path, story_path, tiktok_path, preview_path")
    .lt("expires_at", now)
    .limit(limit);

  if (!expired || expired.length === 0) return 0;

  let cleaned = 0;
  for (const recap of expired) {
    const paths = [
      recap.landscape_path,
      recap.vertical_path,
      recap.highlights_path,
      recap.story_path,
      recap.tiktok_path,
      recap.preview_path,
    ].filter(Boolean) as string[];

    if (paths.length > 0) {
      await Promise.all(paths.map(p => deleteMediaObject(p)));
      await supabase.from("recaps").update({
        landscape_path: null,
        vertical_path: null,
        highlights_path: null,
        story_path: null,
        tiktok_path: null,
        preview_path: null,
      }).eq("job_id", recap.job_id);
      cleaned++;
    }
  }
  return cleaned;
}

export async function listQueuedJobs(limit = 8) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, user_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
    
  if (error) throw new Error(error.message);
  return (data || []).map(row => ({ jobId: row.id, userId: row.user_id }));
}

export async function listProcessingClaims(limit = 20) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("job_leases")
    .select("job_id, user_id")
    .limit(limit);
    
  if (error) throw new Error(error.message);
  return (data || []).map(row => ({ jobId: row.job_id, userId: row.user_id }));
}

export async function clearProcessingClaim(jobId: string) {
  const supabase = getServiceSupabase();
  await supabase.from("job_leases").delete().eq("job_id", jobId);
}

export async function enqueueJob(jobId: string, userId: string) {
  // Job is already in 'queued' status when created or updated
  await updateJob(jobId, userId, { status: "queued" });
}

export async function enqueueProcessingClaim(jobId: string, userId: string, ownerId: string) {
  const supabase = getServiceSupabase();
  await supabase.from("job_leases").upsert({
    job_id: jobId,
    user_id: userId,
    owner_id: ownerId,
    started_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  });
}

export async function listRecentJobsForRecovery(limit = 50) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .in("status", ["analyzing", "selecting", "building", "rendering"])
    .order("updated_at", { ascending: false })
    .limit(limit);
    
  if (error) throw new Error(error.message);
  return (data || []) as JobRow[];
}

async function readShareIndex(token: string): Promise<ShareIndex | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from("app-data")
    .download(`shares/${token}.json`);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as ShareIndex;
  } catch {
    return null;
  }
}

async function writeShareIndex(token: string, index: ShareIndex) {
  const supabase = getServiceSupabase();
  const body = JSON.stringify(index, null, 2);
  const { error } = await supabase.storage
    .from("app-data")
    .upload(`shares/${token}.json`, body, {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export async function purgeExpiredRecapMedia(
  jobIdValue: string,
  userId: string
): Promise<boolean> {
  const recap = await getRecap(jobIdValue, userId);
  if (!recap || !isRecapExpired(recap)) return false;
  const mediaPaths = [
    recap.landscape_path,
    recap.vertical_path,
    recap.highlights_path,
    recap.story_path,
    recap.tiktok_path,
    recap.preview_path,
  ].filter(Boolean) as string[];
  if (mediaPaths.length === 0) return false;
  await Promise.all(mediaPaths.map((p) => deleteMediaObject(p)));
  const supabase = getServiceSupabase();
  await supabase
    .from("recaps")
    .update({
      landscape_path: null,
      vertical_path: null,
      highlights_path: null,
      story_path: null,
      tiktok_path: null,
      preview_path: null,
    })
    .eq("job_id", jobIdValue)
    .eq("user_id", userId);
  return true;
}

export async function restoreRecapVersion(
  jobIdValue: string,
  userId: string,
  generation: number
) {
  // Version history not fully dual-written in PG yet — current generation only.
  const recap = await getRecap(jobIdValue, userId);
  if (!recap?.landscape_path) return null;
  if (recap.current_generation && recap.current_generation !== generation) {
    return null;
  }
  return recap;
}

export async function setRecapRating(
  jobIdValue: string,
  userId: string,
  rating: number
) {
  const supabase = getServiceSupabase();
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  const { data, error } = await supabase
    .from("recaps")
    .update({
      rating: clamped,
      rated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobIdValue)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data as RecapRow;
}

export async function setRecapPreviewPath(
  jobIdValue: string,
  userId: string,
  previewPath: string
) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("recaps")
    .update({
      preview_path: previewPath,
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobIdValue)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data as RecapRow;
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

  const existing = await readShareIndex(token);
  const index: ShareIndex = {
    token,
    job_id: jobIdValue,
    user_id: userId,
    expires_at: expiresAt,
    password_hash: passwordHash,
    created_at: existing?.created_at || new Date().toISOString(),
    audience,
    view_count: existing?.view_count || 0,
    last_viewed_at: existing?.last_viewed_at || null,
  };
  await writeShareIndex(token, index);
  return { job: updated, token, expiresAt, audience };
}

export async function getShareByToken(token: string) {
  const fromFile = await readShareIndex(token);
  if (fromFile) return fromFile;

  // Fallback: look up by jobs.share_token
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("jobs")
    .select("id, user_id, share_token, share_expires_at, share_password_hash, created_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!data?.share_token) return null;
  return {
    token: data.share_token,
    job_id: data.id,
    user_id: data.user_id,
    expires_at: data.share_expires_at,
    password_hash: data.share_password_hash,
    created_at: data.created_at,
    view_count: 0,
    last_viewed_at: null,
  } satisfies ShareIndex;
}

export async function recordShareView(token: string) {
  const share = await getShareByToken(token);
  if (!share) return null;
  const next: ShareIndex = {
    ...share,
    view_count: (share.view_count || 0) + 1,
    last_viewed_at: new Date().toISOString(),
  };
  await writeShareIndex(token, next).catch(() => undefined);
  return next;
}
