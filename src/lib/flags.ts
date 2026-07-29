/**
 * Simple env feature flags. Defaults keep launch-safe behavior off until enabled.
 *
 * | Flag | Env | Default | Notes |
 * |------|-----|---------|-------|
 * | SHARE_AUTO | SHARE_AUTO | false | Auto public share on recap complete |
 * | REFERRALS_ENABLED | REFERRALS_ENABLED | false | Invite UI + GET /api/referrals (?ref=userId). Credit rewards not wired. |
 * | MUSIC_PAID_ENABLED | MUSIC_PAID_ENABLED | false | Paid music library lane |
 * | MARKETING_EXPERIMENTS | MARKETING_EXPERIMENTS | false | Soft marketing A/B |
 * | WAITLIST_ENABLED | WAITLIST_ENABLED | false | Waitlist / early-access forms |
 */

function boolEnv(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const v = raw.toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/** Auto-create a public share link when a recap completes. */
export const SHARE_AUTO = boolEnv("SHARE_AUTO", false);

/**
 * Referral / invite scaffold.
 * When true: account page shows invite link (`?ref=userId`) and GET /api/referrals returns the code.
 * When false: /api/referrals responds 501. Credit rewards are not granted yet.
 */
export const REFERRALS_ENABLED = boolEnv("REFERRALS_ENABLED", false);

/** Paid music library lane (also gated in music.ts). */
export const MUSIC_PAID_ENABLED = boolEnv("MUSIC_PAID_ENABLED", false);

/** Soft marketing experiments (homepage A/B, etc.). */
export const MARKETING_EXPERIMENTS = boolEnv("MARKETING_EXPERIMENTS", false);

/** Allow waitlist / early-access capture forms. */
export const WAITLIST_ENABLED = boolEnv("WAITLIST_ENABLED", false);

export const flags = {
  SHARE_AUTO,
  REFERRALS_ENABLED,
  MUSIC_PAID_ENABLED,
  MARKETING_EXPERIMENTS,
  WAITLIST_ENABLED,
} as const;
