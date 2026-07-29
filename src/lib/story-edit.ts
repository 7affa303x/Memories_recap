import type { SelectedClip } from "@/lib/smart-select";
import type { MoodProfile } from "@/lib/mood";

/** Approximate BPM from mood energy (no audio decode required). */
export function moodBpm(mood: MoodProfile) {
  if (mood.energy >= 0.8) return 118;
  if (mood.energy >= 0.55) return 102;
  if (mood.energy >= 0.35) return 88;
  return 72;
}

function snap(seconds: number, beatSec: number, min: number, max: number) {
  const beats = Math.max(1, Math.round(seconds / beatSec));
  return Math.min(max, Math.max(min, beats * beatSec));
}

/**
 * Snap clip lengths to a beat grid and gently favor cuts on beat boundaries.
 */
export function applyBeatSync(
  clips: SelectedClip[],
  mood: MoodProfile
): SelectedClip[] {
  const bpm = moodBpm(mood);
  const beatSec = 60 / bpm;
  return clips.map((clip) => ({
    ...clip,
    start: Math.max(0, Math.round(clip.start / beatSec) * beatSec),
    duration: snap(clip.duration, beatSec, beatSec * 2, beatSec * 8),
  }));
}

/**
 * Narrative arc: opening (calm) → peak (highest scores) → closing (emotional).
 * Reorders while keeping a watchable story.
 */
export function applyNarrativeArc(clips: SelectedClip[]): SelectedClip[] {
  if (clips.length <= 2) return clips;
  const ranked = [...clips].sort((a, b) => b.score - a.score);
  const peak = ranked[0];
  const rest = ranked.slice(1);
  const opening = rest[rest.length - 1] || rest[0];
  const closing =
    rest.find((c) => c !== opening && c.score >= 0.35) ||
    rest[0] ||
    peak;
  const middle = ranked.filter(
    (c) => c !== peak && c !== opening && c !== closing
  );
  // Shape: open → rising middles by score → peak → close
  const rising = [...middle].sort((a, b) => a.score - b.score);
  const story = [opening, ...rising, peak, closing].filter(Boolean);
  // Dedupe while preserving order
  const seen = new Set<string>();
  const out: SelectedClip[] = [];
  for (const clip of story) {
    const key = `${clip.sourcePath}:${clip.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clip);
  }
  return out.length ? out : clips;
}
