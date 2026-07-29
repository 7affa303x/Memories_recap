export type MoodId = "joyful" | "nostalgic" | "chill" | "epic";

export type MoodProfile = {
  id: MoodId;
  label: string;
  valence: number; // -1 sad … +1 happy
  energy: number; // 0…1
  saturation: number;
  contrast: number;
  temperature: "warm" | "cool" | "neutral";
  cutPace: "slow" | "medium" | "fast";
  /** How much original audio to keep when no peak moment */
  originalAudio: "mute" | "duck";
  /** ffmpeg eq / colorbalance style string fragment */
  colorFilter: string;
};

export const MOOD_PROFILES: Record<MoodId, MoodProfile> = {
  joyful: {
    id: "joyful",
    label: "Joyful",
    valence: 0.85,
    energy: 0.8,
    saturation: 1.25,
    contrast: 1.08,
    temperature: "warm",
    cutPace: "fast",
    originalAudio: "duck",
    colorFilter: "eq=saturation=1.25:contrast=1.08:brightness=0.03",
  },
  nostalgic: {
    id: "nostalgic",
    label: "Nostalgic",
    valence: -0.15,
    energy: 0.35,
    saturation: 0.85,
    contrast: 1.12,
    temperature: "warm",
    cutPace: "slow",
    originalAudio: "mute",
    colorFilter:
      "eq=saturation=0.85:contrast=1.12:brightness=-0.02,colorbalance=rs=0.04:gs=0.02:bs=-0.03",
  },
  chill: {
    id: "chill",
    label: "Chill",
    valence: 0.35,
    energy: 0.3,
    saturation: 0.95,
    contrast: 1.02,
    temperature: "cool",
    cutPace: "slow",
    originalAudio: "mute",
    colorFilter:
      "eq=saturation=0.95:contrast=1.02,colorbalance=rs=-0.02:bs=0.04",
  },
  epic: {
    id: "epic",
    label: "Epic",
    valence: 0.55,
    energy: 0.9,
    saturation: 1.15,
    contrast: 1.18,
    temperature: "neutral",
    cutPace: "fast",
    originalAudio: "duck",
    colorFilter: "eq=saturation=1.15:contrast=1.18:brightness=0.01",
  },
};

export const DEFAULT_MOOD: MoodId = "joyful";

export function getMood(id?: string | null): MoodProfile {
  if (id && id in MOOD_PROFILES) return MOOD_PROFILES[id as MoodId];
  return MOOD_PROFILES[DEFAULT_MOOD];
}

/** Clip length hints from cut pace */
export function clipLengthRange(mood: MoodProfile): { min: number; max: number } {
  if (mood.cutPace === "fast") return { min: 1.8, max: 4.5 };
  if (mood.cutPace === "slow") return { min: 3.5, max: 8 };
  return { min: 2.5, max: 6.5 };
}
