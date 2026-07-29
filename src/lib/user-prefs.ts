import { getServiceSupabase } from "@/lib/supabase/admin";
import type { MoodId } from "@/lib/mood";
import type { MusicMode } from "@/lib/music";
import type { OutputQuality } from "@/lib/branding-video";

const BUCKET = "app-data";

export type UserPrefs = {
  version: 1;
  userId: string;
  defaultMood: MoodId;
  defaultMusicMode: MusicMode;
  defaultTrackId: string | null;
  defaultOutputQuality: OutputQuality;
  lastFolder: string | null;
  /** Soft default end-card title */
  endCardTitle: string | null;
  endCardShowDate: boolean;
  /** Pro: omit end card by default when creating */
  hideEndCard: boolean;
  updatedAt: string;
};

function defaults(userId: string): UserPrefs {
  return {
    version: 1,
    userId,
    defaultMood: "joyful",
    defaultMusicMode: "auto",
    defaultTrackId: null,
    defaultOutputQuality: "fhd",
    lastFolder: null,
    endCardTitle: null,
    endCardShowDate: false,
    hideEndCard: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function getUserPrefs(userId: string): Promise<UserPrefs> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`prefs/${userId}.json`);
  if (error || !data) return defaults(userId);
  try {
    return { ...defaults(userId), ...(JSON.parse(await data.text()) as UserPrefs) };
  } catch {
    return defaults(userId);
  }
}

export async function saveUserPrefs(
  userId: string,
  patch: Partial<Omit<UserPrefs, "version" | "userId">>
) {
  const current = await getUserPrefs(userId);
  const next: UserPrefs = {
    ...current,
    ...patch,
    version: 1,
    userId,
    updatedAt: new Date().toISOString(),
  };
  const supabase = getServiceSupabase();
  await supabase.storage.from(BUCKET).upload(
    `prefs/${userId}.json`,
    JSON.stringify(next, null, 2),
    { contentType: "application/json", upsert: true }
  );
  return next;
}
