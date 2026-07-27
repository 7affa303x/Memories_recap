import { getServiceSupabase } from "@/lib/supabase/admin";
import type { JobRow, RecapRow, UploadRow } from "@/lib/types";

export async function getJobForUser(jobId: string, userId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as JobRow | null;
}

export async function listUploads(jobId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UploadRow[];
}

export async function getRecap(jobId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("recaps")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RecapRow | null;
}

export async function updateJob(
  jobId: string,
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
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as JobRow;
}
