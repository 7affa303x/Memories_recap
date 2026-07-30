/**
 * Best-effort Postgres dual-write for pipeline tables.
 * Storage JSON remains the source of truth until full cutover.
 * Failures never break encode — they only affect observability/queryability.
 */

import { getServiceSupabase } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";
import type { ArtifactKind } from "@/lib/pipeline/types";

function dualWriteEnabled() {
  const raw = process.env.PIPELINE_PG_DUALWRITE;
  if (raw == null || raw === "") return true; // on by default once tables exist
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase().trim());
}

async function soft(label: string, fn: () => Promise<unknown>) {
  if (!dualWriteEnabled()) return;
  try {
    await fn();
  } catch (error) {
    logError("pipeline_pg_dualwrite_failed", {
      label,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function pgUpsertLease(input: {
  jobId: string;
  userId: string;
  ownerId: string;
  startedAt: string;
  heartbeatAt: string;
  attempt: number;
}) {
  await soft("upsert_lease", async () => {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from("job_leases").upsert(
      {
        job_id: input.jobId,
        user_id: input.userId,
        owner_id: input.ownerId,
        started_at: input.startedAt,
        heartbeat_at: input.heartbeatAt,
        attempt: input.attempt,
      },
      { onConflict: "job_id" }
    );
    if (error) throw new Error(error.message);
  });
}

export async function pgDeleteLease(jobId: string) {
  await soft("delete_lease", async () => {
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("job_leases")
      .delete()
      .eq("job_id", jobId);
    if (error) throw new Error(error.message);
  });
}

export async function pgUpsertArtifact(input: {
  jobId: string;
  userId: string;
  kind: ArtifactKind;
  storagePath: string;
  uploadId?: string | null;
  bytes?: number | null;
  meta?: Record<string, unknown>;
}) {
  await soft("upsert_artifact", async () => {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from("job_artifacts").upsert(
      {
        job_id: input.jobId,
        user_id: input.userId,
        kind: input.kind,
        storage_path: input.storagePath,
        upload_id: input.uploadId ?? null,
        bytes: input.bytes ?? null,
        meta: input.meta ?? null,
      },
      { onConflict: "job_id,kind,storage_path" }
    );
    if (error) throw new Error(error.message);
  });
}

export async function pgInsertEvent(input: {
  jobId: string;
  userId: string;
  stage?: string | null;
  event: string;
  detail?: Record<string, unknown> | null;
}) {
  await soft("insert_event", async () => {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from("pipeline_events").insert({
      job_id: input.jobId,
      user_id: input.userId,
      stage: input.stage ?? null,
      event: input.event,
      detail: input.detail ?? null,
    });
    if (error) throw new Error(error.message);
  });
}

/** Soft probe used by /api/health — does not throw. */
export async function pgPipelineTablesOk(): Promise<{
  ok: boolean;
  detail: string;
}> {
  if (!dualWriteEnabled()) {
    return { ok: true, detail: "dualwrite_disabled" };
  }
  try {
    const supabase = getServiceSupabase();
    const checks = await Promise.all([
      supabase.from("job_artifacts").select("id", { head: true, count: "exact" }),
      supabase.from("job_leases").select("job_id", { head: true, count: "exact" }),
      supabase.from("pipeline_events").select("id", { head: true, count: "exact" }),
    ]);
    const failed = checks.find((c) => c.error);
    if (failed?.error) {
      return { ok: false, detail: failed.error.message };
    }
    return { ok: true, detail: "job_artifacts,job_leases,pipeline_events" };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "probe_failed",
    };
  }
}
