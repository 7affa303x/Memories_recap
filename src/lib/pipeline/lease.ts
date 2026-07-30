import { hostname } from "node:os";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  DEFAULT_MAX_GLOBAL_ENCODES,
  DEFAULT_MAX_USER_ENCODES,
  LEASE_STALE_MS,
} from "@/lib/pipeline/types";
import { logInfo } from "@/lib/logger";
import { pgDeleteLease, pgInsertEvent, pgUpsertLease } from "@/lib/pipeline/pg";

const BUCKET = "app-data";

export type ProcessingLease = {
  jobId: string;
  userId: string;
  ownerId: string;
  startedAt: string;
  heartbeatAt: string;
  attempt: number;
};

function leasePath(jobId: string) {
  return `processing/${jobId}.json`;
}

function slotsPath() {
  return `system/encode-slots.json`;
}

type EncodeSlots = {
  holders: Array<{
    ownerId: string;
    jobId: string;
    userId: string;
    at: string;
  }>;
};

async function readJson<T>(path: string): Promise<T | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
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

function isStale(lease: ProcessingLease, now = Date.now()) {
  const beat = new Date(lease.heartbeatAt || lease.startedAt).getTime();
  return now - beat >= LEASE_STALE_MS;
}

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
  const existing = await readJson<ProcessingLease>(leasePath(input.jobId));
  const now = Date.now();
  const iso = new Date(now).toISOString();

  if (
    existing &&
    existing.ownerId !== input.ownerId &&
    !isStale(existing, now)
  ) {
    return {
      ok: false,
      reason: `held_by_${existing.ownerId}`,
    };
  }

  const lease: ProcessingLease = {
    jobId: input.jobId,
    userId: input.userId,
    ownerId: input.ownerId,
    startedAt: existing?.startedAt && existing.ownerId === input.ownerId
      ? existing.startedAt
      : iso,
    heartbeatAt: iso,
    attempt: input.attempt ?? (existing?.attempt ?? 0) + 1,
  };

  await writeJson(leasePath(input.jobId), lease);
  // Re-read to reduce races (best-effort without CAS)
  const confirm = await readJson<ProcessingLease>(leasePath(input.jobId));
  if (!confirm || confirm.ownerId !== input.ownerId) {
    return { ok: false, reason: "lost_race" };
  }
  await pgUpsertLease({
    jobId: lease.jobId,
    userId: lease.userId,
    ownerId: lease.ownerId,
    startedAt: lease.startedAt,
    heartbeatAt: lease.heartbeatAt,
    attempt: lease.attempt,
  });
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
  const existing = await readJson<ProcessingLease>(leasePath(jobId));
  if (!existing || existing.ownerId !== ownerId) return false;
  const heartbeatAt = new Date().toISOString();
  await writeJson(leasePath(jobId), {
    ...existing,
    heartbeatAt,
  } satisfies ProcessingLease);
  await pgUpsertLease({
    jobId: existing.jobId,
    userId: existing.userId,
    ownerId: existing.ownerId,
    startedAt: existing.startedAt,
    heartbeatAt,
    attempt: existing.attempt,
  });
  return true;
}

export async function releaseProcessingLease(
  jobId: string,
  ownerId?: string
): Promise<void> {
  const existing = await readJson<ProcessingLease>(leasePath(jobId));
  if (ownerId && existing && existing.ownerId !== ownerId) return;
  const supabase = getServiceSupabase();
  await supabase.storage.from(BUCKET).remove([leasePath(jobId)]);
  await pgDeleteLease(jobId);
  await pgInsertEvent({
    jobId,
    userId: existing?.userId ?? "system",
    event: "lease_released",
    detail: { ownerId: ownerId ?? existing?.ownerId ?? null },
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

function pruneSlots(slots: EncodeSlots, now = Date.now()): EncodeSlots {
  const keep = slots.holders.filter((h) => {
    const age = now - new Date(h.at).getTime();
    return age < LEASE_STALE_MS;
  });
  return { holders: keep };
}

/**
 * Global + per-user encode backpressure (Storage-backed, best-effort).
 */
export async function tryAcquireEncodeSlot(input: {
  ownerId: string;
  jobId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; reason: "global_full" | "user_full" }> {
  const raw = (await readJson<EncodeSlots>(slotsPath())) ?? { holders: [] };
  const slots = pruneSlots(raw);
  const globalMax = maxGlobalEncodes();
  const userMax = maxUserEncodes();

  const userCount = slots.holders.filter((h) => h.userId === input.userId)
    .length;
  if (userCount >= userMax) {
    return { ok: false, reason: "user_full" };
  }
  if (slots.holders.length >= globalMax) {
    return { ok: false, reason: "global_full" };
  }

  // Replace same owner if reconnecting
  const holders = [
    ...slots.holders.filter((h) => h.ownerId !== input.ownerId),
    {
      ownerId: input.ownerId,
      jobId: input.jobId,
      userId: input.userId,
      at: new Date().toISOString(),
    },
  ];
  await writeJson(slotsPath(), { holders } satisfies EncodeSlots);
  return { ok: true };
}

export async function releaseEncodeSlot(ownerId: string) {
  const raw = (await readJson<EncodeSlots>(slotsPath())) ?? { holders: [] };
  const holders = raw.holders.filter((h) => h.ownerId !== ownerId);
  await writeJson(slotsPath(), { holders } satisfies EncodeSlots);
}

export async function touchEncodeSlot(ownerId: string) {
  const raw = (await readJson<EncodeSlots>(slotsPath())) ?? { holders: [] };
  const holders = raw.holders.map((h) =>
    h.ownerId === ownerId ? { ...h, at: new Date().toISOString() } : h
  );
  await writeJson(slotsPath(), { holders } satisfies EncodeSlots);
}
