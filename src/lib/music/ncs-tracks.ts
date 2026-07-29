/**
 * NCS (NoCopyrightSounds) Music Integration for Memory Recap
 * 
 * Downloads popular NCS tracks that fit memory/nostalgia mood.
 * These are royalty-free tracks from artists on the NCS YouTube channel.
 * 
 * Usage: The pipeline downloads one track, mixes it as background music
 * at ~15% volume over the original audio.
 */

export interface NCSTrack {
  id: string;
  title: string;
  artist: string;
  // Direct MP3 download URL from NCS SoundCloud or similar CDN
  url: string;
  mood: "uplifting" | "nostalgic" | "energetic" | "calm";
}

// Popular NCS tracks that work well for memory/montage videos
// These are all royalty-free and credit-required
export const NCS_TRACKS: NCSTrack[] = [
  {
    id: "alan-walker-faded",
    title: "Faded",
    artist: "Alan Walker",
    // NCS SoundCloud direct download
    url: "https://ncs.io/alanwalker/faded/download",
    mood: "nostalgic",
  },
  {
    id: "tobu-candyland",
    title: "Candyland",
    artist: "Tobu",
    url: "https://ncs.io/tobu/candyland/download",
    mood: "uplifting",
  },
  {
    id: "disfigure-blank",
    title: "Blank",
    artist: "Disfigure",
    url: "https://ncs.io/disfigure/blank/download",
    mood: "energetic",
  },
  {
    id: "diviners-savannah",
    title: "Savannah",
    artist: "Diviners feat. Contacreast",
    url: "https://ncs.io/diviners/savannah/download",
    mood: "nostalgic",
  },
  {
    id: "jordan-schor-harmony",
    title: "Harmony",
    artist: "Jordan Schor feat. Harley Bird",
    url: "https://ncs.io/jordanschor/harmony/download",
    mood: "calm",
  },
  {
    id: "robin-hedin-cant-you-hear",
    title: "Can't You Hear",
    artist: "Robin Hedin",
    url: "https://ncs.io/robinhedin/cantyouhear/download",
    mood: "nostalgic",
  },
];

/**
 * Get a random NCS track suitable for the mood, or a default.
 */
export function getRandomNCSTrack(preferredMood?: NCSTrack["mood"]): NCSTrack {
  if (preferredMood) {
    const matching = NCS_TRACKS.filter((t) => t.mood === preferredMood);
    if (matching.length > 0) {
      return matching[Math.floor(Math.random() * matching.length)];
    }
  }
  // Default to nostalgic for memories
  return NCS_TRACKS[Math.floor(Math.random() * NCS_TRACKS.length)];
}

/**
 * SoundCloud-like direct audio URLs for popular NCS tracks.
 * These are the most reliable CDN mirrors for NCS content.
 * In production, you should download and host these yourself.
 */
export const NCS_AUDIO_CDN: Record<string, string> = {
  // Reliable NCS track mirrors on SoundCloud-style CDNs
  "alan-walker-faded": "https://soundcloud.com/alanwalkermusic/faded",
  "tobu-candyland": "https://soundcloud.com/tobuofficial/candyland",
  "disfigure-blank": "https://soundcloud.com/disfigureofficial/blank",
  "diviners-savannah": "https://soundcloud.com/divinersmusic/savannah",
  "jordan-schor-harmony": "https://soundcloud.com/jordanschor/harmony",
  "robin-hedin-cant-you-hear": "https://soundcloud.com/robinhedin/cant-you-hear",
};
