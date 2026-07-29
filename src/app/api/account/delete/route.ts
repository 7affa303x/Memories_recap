import { auth, signOut } from "@/auth";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { listJobsForUser } from "@/lib/store";

const BUCKET = "app-data";

/**
 * Soft-delete account: remove billing + job records best-effort,
 * write users/{id}.deleted.json, then clear session via sign-out redirect.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email ?? null;
  const supabase = getServiceSupabase();

  // Billing JSON — best-effort remove
  try {
    await supabase.storage.from(BUCKET).remove([`billing/${userId}.json`]);
  } catch {
    // ignore
  }

  // Jobs list — best-effort remove each job JSON
  try {
    const jobs = await listJobsForUser(userId);
    if (jobs.length > 0) {
      const paths = jobs.map((j) => `jobs/${userId}/${j.id}.json`);
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch {
    // ignore
  }

  // Soft-delete marker + clear active user profile best-effort
  const deletedAt = new Date().toISOString();
  const marker = {
    id: userId,
    email,
    deleted_at: deletedAt,
    reason: "user_requested",
  };
  const { error: markError } = await supabase.storage.from(BUCKET).upload(
    `users/${userId}.deleted.json`,
    JSON.stringify(marker, null, 2),
    { contentType: "application/json", upsert: true }
  );
  if (markError) {
    return new Response(markError.message || "Could not mark account deleted", {
      status: 500,
    });
  }

  try {
    await supabase.storage.from(BUCKET).remove([`users/${userId}.json`]);
  } catch {
    // ignore
  }

  // Clear session and redirect home
  await signOut({ redirectTo: "/" });
}
