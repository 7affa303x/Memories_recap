import { join } from "node:path";
import type { MoodId } from "@/lib/mood";

export type MusicMode = "none" | "manual" | "auto";

export type MusicTrack = {
  id: string;
  title: string;
  mood: MoodId;
  /** Relative path under /public */
  publicPath: string;
  provider: "free" | "uppbeat" | "epidemic";
  /** Shown in UI */
  vibe: string;
};

/**
 * Free catalog (active now).
 * Replace files in public/music with Uppbeat/Epidemic downloads when enabling paid.
 */
export const FREE_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "joyful-pulse",
    title: "Bright Pulse",
    mood: "joyful",
    publicPath: "/music/joyful.mp3",
    provider: "free",
    vibe: "Upbeat · warm energy",
  },
  {
    id: "nostalgic-haze",
    title: "Soft Haze",
    mood: "nostalgic",
    publicPath: "/music/nostalgic.mp3",
    provider: "free",
    vibe: "Reflective · filmic",
  },
  {
    id: "chill-breeze",
    title: "Easy Breeze",
    mood: "chill",
    publicPath: "/music/chill.mp3",
    provider: "free",
    vibe: "Calm · light",
  },
  {
    id: "epic-drive",
    title: "Rising Drive",
    mood: "epic",
    publicPath: "/music/epic.mp3",
    provider: "free",
    vibe: "Bold · cinematic",
  },
];

/**
 * Paid library stub — hidden until MUSIC_PAID_ENABLED=true and tracks are filled.
 * Wire Uppbeat or Epidemic here later without changing call sites.
 */
export const PAID_MUSIC_TRACKS: MusicTrack[] = [
  // Example shape (disabled):
  // { id: "uppbeat-joy-01", title: "…", mood: "joyful", publicPath: "/music/paid/…", provider: "uppbeat", vibe: "…" },
];

export function isPaidMusicEnabled() {
  return process.env.MUSIC_PAID_ENABLED === "true";
}

export function listMusicTracks(options?: { includePaid?: boolean }): MusicTrack[] {
  const paid =
    options?.includePaid || isPaidMusicEnabled() ? PAID_MUSIC_TRACKS : [];
  return [...FREE_MUSIC_TRACKS, ...paid];
}

export function getTrackById(id: string | null | undefined): MusicTrack | null {
  if (!id) return null;
  return listMusicTracks({ includePaid: true }).find((t) => t.id === id) || null;
}

export function pickAutoTrack(mood: MoodId): MusicTrack {
  const tracks = listMusicTracks().filter((t) => t.mood === mood);
  if (tracks.length === 0) return FREE_MUSIC_TRACKS[0];
  // Stable pick by mood (can randomize later)
  return tracks[0];
}

export function resolveMusicSelection(input: {
  mode: MusicMode;
  trackId?: string | null;
  mood: MoodId;
}): MusicTrack | null {
  if (input.mode === "none") return null;
  if (input.mode === "manual") {
    return getTrackById(input.trackId) || pickAutoTrack(input.mood);
  }
  return pickAutoTrack(input.mood);
}

/** Absolute filesystem path for ffmpeg */
export function trackAbsolutePath(track: MusicTrack) {
  return join(process.cwd(), "public", track.publicPath.replace(/^\//, ""));
}

export type RecapMusicOptions = {
  mode: MusicMode;
  trackId?: string | null;
  mood?: MoodId | null;
};
