import { getServiceSupabase } from "@/lib/supabase/admin";

export type StreakState = {
  userId: string;
  /** Current consecutive UTC days with a visit/grant */
  current: number;
  longest: number;
  /** YYYY-MM-DD UTC of last counted day */
  lastDay: string | null;
  updatedAt: string;
};

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function dayOffset(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

export async function readStreak(userId: string): Promise<StreakState> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from("app-data")
      .download(`streaks/${userId}.json`);
    if (error || !data) {
      return {
        userId,
        current: 0,
        longest: 0,
        lastDay: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return JSON.parse(await data.text()) as StreakState;
  } catch {
    return {
      userId,
      current: 0,
      longest: 0,
      lastDay: null,
      updatedAt: new Date().toISOString(),
    };
  }
}

async function writeStreak(state: StreakState) {
  const supabase = getServiceSupabase();
  await supabase.storage.from("app-data").upload(
    `streaks/${state.userId}.json`,
    JSON.stringify(state),
    { contentType: "application/json", upsert: true }
  );
}

/**
 * Count today toward the streak. Returns updated streak + whether this call
 * newly advanced the streak (for bonus grants).
 */
export async function touchStreak(userId: string): Promise<{
  streak: StreakState;
  advanced: boolean;
  hit7: boolean;
  hit30: boolean;
}> {
  const today = utcDayKey();
  const prev = await readStreak(userId);
  if (prev.lastDay === today) {
    return { streak: prev, advanced: false, hit7: false, hit30: false };
  }

  let current = 1;
  if (prev.lastDay) {
    const gap = dayOffset(prev.lastDay, today);
    current = gap === 1 ? prev.current + 1 : 1;
  }

  const streak: StreakState = {
    userId,
    current,
    longest: Math.max(prev.longest, current),
    lastDay: today,
    updatedAt: new Date().toISOString(),
  };
  await writeStreak(streak);

  return {
    streak,
    advanced: true,
    hit7: current === 7,
    hit30: current === 30,
  };
}
