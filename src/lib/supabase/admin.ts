import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function getServiceSupabase() {
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase service configuration");
  }

  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return admin;
}

/** @deprecated Outputs are private — always use signedRecapUrl. */
export function publicRecapUrl(_path: string): never {
  throw new Error("publicRecapUrl disabled — use signedRecapUrl");
}

export async function signedRecapUrl(
  path: string,
  expiresInSeconds = 60 * 60 * 6
) {
  const supabase = getServiceSupabase();
  // Prefer private outputs in memories bucket; fall back to recaps.
  const primary = await supabase.storage
    .from("memories")
    .createSignedUrl(path, expiresInSeconds);
  if (!primary.error && primary.data?.signedUrl) {
    return primary.data.signedUrl;
  }
  const secondary = await supabase.storage
    .from("recaps")
    .createSignedUrl(path, expiresInSeconds);
  if (secondary.error || !secondary.data?.signedUrl) {
    throw new Error(secondary.error?.message || primary.error?.message || "Signed URL failed");
  }
  return secondary.data.signedUrl;
}
