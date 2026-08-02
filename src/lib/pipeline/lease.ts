import { hostname } from "node:os";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  DEFAULT_MAX_GLOBAL_ENCODES,
  DEFAULT_MAX_USER_ENCODES,
  LEASE_STALE_MS,
} from "@/lib/pipeline/types";
import { logInfo } from "@/lib/logger";
import { pgDeleteLease, pgInsertEvent, pgUpsertLease } from "@/lib/pipeline/pg";

export type ProcessingLease = {
  jobId: string;
  userId: string;
  ownerId: string;
  startedAt: string;
  heartbeatAt: string;
  attempt: number;
};

export function createOwnerId(prefix = "worker") {
  return `${prefix}-${hostname()}-${process.pid}-${Date.now().toString(36)}`;
}

/**
 * Exclusive lease: only one live owner may process a job.
 * Stale heartbeats can be stolen safely.
 */
export async function tryAcquireProcessingLease(input: {
  jobId: string;
  userId: string;
  ownerId: string;
  attempt?: number;
}): Promise<{ ok: true; lease: ProcessingLease } | { ok: false; reason: string }> {
  const supabase = getServiceSupabase();
  const now = new Date();
  const staleAt = new Date(now.getTime() - LEASE_STALE_MS).toISOString();

  // Try to acquire lease: either no lease exists, or it's stale, or we already own it
  const { data: existing, error: fetchError } = await supabase
    .from("job_leases")
    .select("*")
    .eq("job_id", input.jobId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    return { ok: false, reason: fetchError.message };
  }

  if (existing) {
    const isStale = new Date(existing.heartbeat_at).getTime() < new Date(staleAt).getTime();
    if (existing.owner_id !== input.ownerId && !isStale) {
      return { ok: false, reason: `held_by_${existing.owner_id}` };
    }
  }

  const lease: ProcessingLease = {
    jobId: input.jobId,
    userId: input.userId,
    ownerId: input.ownerId,
    startedAt: (existing && existing.owner_id === input.ownerId) ? existing.started_at : now.toISOString(),
    heartbeatAt: now.toISOString(),
    attempt: input.attempt ?? (existing?.attempt ?? 0) + 1,
  };

  const { error: upsertError } = await supabase.from("job_leases").upsert({
    job_id: lease.jobId,
    user_id: lease.userId,
    owner_id: lease.ownerId,
    started_at: lease.startedAt,
    heartbeat_at: lease.heartbeatAt,
    attempt: lease.attempt,
  }, { onConflict: "job_id" });

  if (upsertError) {
    return { ok: false, reason: upsertError.message };
  }

  await pgInsertEvent({
    jobId: lease.jobId,
    userId: lease.userId,
    event: "lease_acquired",
    detail: { ownerId: lease.ownerId, attempt: lease.attempt },
  });

  logInfo("lease_acquired", {
    jobId: input.jobId,
    ownerId: input.ownerId,
    attempt: lease.attempt,
  });

  return { ok: true, lease };
}

export async function heartbeatProcessingLease(
  jobId: string,
  ownerId: string
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("job_leases")
    .update({ heartbeat_at: now })
    .eq("job_id", jobId)
    .eq("owner_id", ownerId)
    .select();

  return !error && data && data.length > 0;
}

export async function releaseProcessingLease(
  jobId: string,
  ownerId?: string
): Promise<void> {
  const supabase = getServiceSupabase();
  let query = supabase.from("job_leases").delete().eq("job_id", jobId);
  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }
  
  const { data: existing } = await supabase.from("job_leases").select("user_id, owner_id").eq("job_id", jobId).single();
  
  await query;

  await pgInsertEvent({
    jobId,
    userId: existing?.user_id ?? "system",
    event: "lease_released",
    detail: { ownerId: ownerId ?? existing?.owner_id ?? null },
  });
}

export function maxGlobalEncodes() {
  const raw = Number(process.env.MAX_GLOBAL_ENCODES);
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_MAX_GLOBAL_ENCODES;
}

export function maxUserEncodes() {
  const raw = Number(process.env.MAX_USER_ENCODES);
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_MAX_USER_ENCODES;
}

/**
 * Global + per-user encode backpressure (Postgres-backed).
 */
export async function tryAcquireEncodeSlot(input: {
  ownerId: string;
  jobId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; reason: "global_full" | "user_full" }> {
  const supabase = getServiceSupabase();
  const staleAt = new Date(Date.now() - LEASE_STALE_MS).toISOString();

  // Prune stale leases first (optional, heartbeat handles it, but good for slot counting)
  // Actually, we just count non-stale leases
  const { data: activeLeases, error } = await supabase
    .from("job_leases")
    .select("user_id, owner_id")
    .gt("heartbeat_at", staleAt);

  if (error) return { ok: true }; // Best effort

  const globalMax = maxGlobalEncodes();
  const userMax = maxUserEncodes();

  const userCount = activeLeases.filter((h) => h.user_id === input.userId).length;
  if (userCount >= userMax) {
    return { ok: false, reason: "user_full" };
  }
  if (activeLeases.length >= globalMax) {
    return { ok: false, reason: "global_full" };
  }

  return { ok: true };
}

export async function releaseEncodeSlot(ownerId: string) {
  // Slots are tied to leases in this new SQL model
  // releaseProcessingLease handles it
}

export async function touchEncodeSlot(ownerId: string) {
  // heartbeatProcessingLease handles it
}
