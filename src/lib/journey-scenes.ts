export type JourneyScene = {
  id: string;
  title: string;
  subtitle: string;
  hint: string;
  /** Local poster used until Higgsfield film clips are wired in. */
  poster: string;
  /** Optional MP4 — when set, the player uses video instead of Ken Burns. */
  video?: string;
  accent: string;
  atmosphere: string;
};

/**
 * Interactive cinematic journey for Memories Recap.
 * Scene order matches the project handoff storyboard.
 * Drop Higgsfield Seedance URLs into `video` when Unlimited / credits allow.
 */
export const JOURNEY_SCENES: JourneyScene[] = [
  {
    id: "descent",
    title: "The Great Descent",
    subtitle: "From orbit to a morning beach with family.",
    hint: "Tap to leave the shore",
    poster: "/journey/beach.jpg",
    video: "/journey/beach.mp4",
    accent: "#f4d6a0",
    atmosphere:
      "radial-gradient(120% 80% at 50% 20%, #7ec8ff 0%, #1a5f8f 45%, #0b2a3d 100%)",
  },
  {
    id: "alpine",
    title: "Alpine Explorers",
    subtitle: "Sea spray becomes a golden-hour mountain ridge.",
    hint: "Tap toward the dunes",
    poster: "/journey/mountains.jpg",
    video: "/journey/mountains.mp4",
    accent: "#ffc48a",
    atmosphere:
      "radial-gradient(120% 80% at 50% 15%, #ffb347 0%, #6b3a2a 40%, #1a1210 100%)",
  },
  {
    id: "desert",
    title: "Desert Brotherhood",
    subtitle: "Dunes, campfire light, and shared coffee.",
    hint: "Tap into the night",
    poster: "/journey/desert.jpg",
    video: "/journey/desert.mp4",
    accent: "#e8b86d",
    atmosphere:
      "radial-gradient(120% 80% at 50% 30%, #f0c27a 0%, #b36b2e 40%, #2a1408 100%)",
  },
  {
    id: "arctic",
    title: "The Arctic Neon Gala",
    subtitle: "Aurora, black ice, and a glowing glass dome.",
    hint: "Tap to open the world map",
    poster: "/journey/arctic.jpg",
    video: "/journey/arctic.mp4",
    accent: "#b8a6ff",
    atmosphere:
      "radial-gradient(120% 80% at 50% 20%, #6a5acd 0%, #1a2744 45%, #05070f 100%)",
  },
];

export const JOURNEY_HUB = {
  id: "hub",
  title: "Choose a memory world",
  subtitle: "Tap any place to return. Or continue to Memories Recap.",
} as const;
