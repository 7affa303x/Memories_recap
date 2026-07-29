import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MoodId } from "@/lib/mood";

export type MusicMode = "none" | "manual" | "auto";

export type MusicTrack = {
  id: string;
  title: string;
  mood: MoodId;
  /** Relative path under /public */
  publicPath: string;
  provider: "free" | "ncs" | "uppbeat" | "epidemic";
  /** Shown in UI */
  vibe: string;
  artist?: string;
  /** Required credit line for NCS / free-use catalogs */
  credit?: string;
  ncsUrl?: string;
};

/**
 * Famous NCS (NoCopyrightSounds) beds — free for creators with credit.
 * Files live under public/music/ncs/ (downloaded from ncs.io CDN).
 */
export const NCS_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "ncs-sky-high",
    title: "Sky High",
    artist: "Elektronomia",
    mood: "joyful",
    publicPath: "/music/ncs/elektronomia-sky-high.mp3",
    provider: "ncs",
    vibe: "NCS · uplifting drive",
    ncsUrl: "https://ncs.io/SkyHigh",
    credit:
      "Elektronomia - Sky High [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/SkyHigh",
  },
  {
    id: "ncs-why-do-i",
    title: "Why Do I (Instrumental)",
    artist: "Unknown Brain",
    mood: "joyful",
    publicPath: "/music/ncs/unknown-brain-why-do-i.mp3",
    provider: "ncs",
    vibe: "NCS · bright energy",
    ncsUrl: "https://ncs.io/WhyDoI",
    credit:
      "Unknown Brain - Why Do I [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/WhyDoI",
  },
  {
    id: "ncs-dreams",
    title: "Dreams",
    artist: "Lost Sky",
    mood: "nostalgic",
    publicPath: "/music/ncs/lost-sky-dreams.mp3",
    provider: "ncs",
    vibe: "NCS · soft & reflective",
    ncsUrl: "https://ncs.io/Dreams",
    credit:
      "Lost Sky - Dreams [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Dreams",
  },
  {
    id: "ncs-blank",
    title: "Blank",
    artist: "Disfigure",
    mood: "chill",
    publicPath: "/music/ncs/disfigure-blank.mp3",
    provider: "ncs",
    vibe: "NCS · melodic chill",
    ncsUrl: "https://ncs.io/Blank",
    credit:
      "Disfigure - Blank [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Blank",
  },
  {
    id: "ncs-mortals",
    title: "Mortals (feat. Laura Brehm)",
    artist: "Warriyo",
    mood: "epic",
    publicPath: "/music/ncs/warriyo-mortals.mp3",
    provider: "ncs",
    vibe: "NCS · cinematic power",
    ncsUrl: "https://ncs.io/Mortals",
    credit:
      "Warriyo - Mortals (feat. Laura Brehm) [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Mortals",
  },
  {
    id: "ncs-invincible",
    title: "Invincible",
    artist: "Deaf Kev",
    mood: "epic",
    publicPath: "/music/ncs/deaf-kavv-invincible.mp3",
    provider: "ncs",
    vibe: "NCS · big drop",
    ncsUrl: "https://ncs.io/Invincible",
    credit:
      "Deaf Kev - Invincible [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Invincible",
  },
  {
    id: "ncs-cradles",
    title: "Cradles",
    artist: "Sub Urban",
    mood: "nostalgic",
    publicPath: "/music/ncs/subway-cradles.mp3",
    provider: "ncs",
    vibe: "NCS · dark nostalgia",
    ncsUrl: "https://ncs.io/Cradles",
    credit:
      "Sub Urban - Cradles [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Cradles",
  },
  {
    id: "ncs-fearless",
    title: "Fearless",
    artist: "Lost Sky",
    mood: "chill",
    publicPath: "/music/ncs/lost-sky-fearless.mp3",
    provider: "ncs",
    vibe: "NCS · calm strength",
    ncsUrl: "https://ncs.io/Fearless",
    credit:
      "Lost Sky - Fearless [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Fearless",
  },
];

/** Short mood defaults (90s NCS excerpts) for quick auto-pick. */
export const FREE_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "joyful-pulse",
    title: "Sky High (edit)",
    artist: "Elektronomia",
    mood: "joyful",
    publicPath: "/music/joyful.mp3",
    provider: "ncs",
    vibe: "NCS edit · warm energy",
    credit:
      "Elektronomia - Sky High [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/SkyHigh",
  },
  {
    id: "nostalgic-haze",
    title: "Dreams (edit)",
    artist: "Lost Sky",
    mood: "nostalgic",
    publicPath: "/music/nostalgic.mp3",
    provider: "ncs",
    vibe: "NCS edit · reflective",
    credit:
      "Lost Sky - Dreams [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Dreams",
  },
  {
    id: "chill-breeze",
    title: "Blank (edit)",
    artist: "Disfigure",
    mood: "chill",
    publicPath: "/music/chill.mp3",
    provider: "ncs",
    vibe: "NCS edit · light",
    credit:
      "Disfigure - Blank [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Blank",
  },
  {
    id: "epic-drive",
    title: "Mortals (edit)",
    artist: "Warriyo",
    mood: "epic",
    publicPath: "/music/epic.mp3",
    provider: "ncs",
    vibe: "NCS edit · cinematic",
    credit:
      "Warriyo - Mortals [NCS Release] · Music provided by NoCopyrightSounds · https://ncs.io/Mortals",
  },
];

export const PAID_MUSIC_TRACKS: MusicTrack[] = [];

function trackFileExists(publicPath: string) {
  const rel = publicPath.replace(/^\//, "");
  return existsSync(join(process.cwd(), "public", rel));
}

export function isPaidMusicEnabled() {
  return process.env.MUSIC_PAID_ENABLED === "true";
}

export function listMusicTracks(options?: { includePaid?: boolean }): MusicTrack[] {
  const ncs = NCS_MUSIC_TRACKS.filter((t) => trackFileExists(t.publicPath));
  const free = FREE_MUSIC_TRACKS.filter((t) => trackFileExists(t.publicPath));
  const paid =
    options?.includePaid || isPaidMusicEnabled()
      ? PAID_MUSIC_TRACKS.filter((t) => trackFileExists(t.publicPath))
      : [];
  // Prefer full NCS catalog first, then short edits, then paid.
  const byId = new Map<string, MusicTrack>();
  for (const t of [...ncs, ...free, ...paid]) byId.set(t.id, t);
  return [...byId.values()];
}

export function getTrackById(id: string | null | undefined): MusicTrack | null {
  if (!id) return null;
  return listMusicTracks({ includePaid: true }).find((t) => t.id === id) || null;
}

export function pickAutoTrack(mood: MoodId): MusicTrack {
  const tracks = listMusicTracks();
  const match = tracks.filter((t) => t.mood === mood && t.provider === "ncs");
  if (match.length) return match[Math.floor(Math.random() * match.length)]!;
  const anyMood = tracks.filter((t) => t.mood === mood);
  if (anyMood.length) return anyMood[0]!;
  return tracks[0] || FREE_MUSIC_TRACKS[0]!;
}

export function absoluteMusicPath(track: MusicTrack) {
  return join(process.cwd(), "public", track.publicPath.replace(/^\//, ""));
}

/** Absolute filesystem path for ffmpeg */
export function trackAbsolutePath(track: MusicTrack) {
  return absoluteMusicPath(track);
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

export type RecapMusicOptions = {
  mode: MusicMode;
  trackId?: string | null;
  mood?: MoodId | null;
};
