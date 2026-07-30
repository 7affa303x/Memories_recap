/**
 * Feature flags. Defaults keep launch-safe / pipeline-safe behavior.
 *
 * | Flag | Env | Default | Notes |
 * |------|-----|---------|-------|
 * | SHARE_AUTO | false | Auto public share on complete |
 * | REFERRALS_ENABLED | false | Invite rewards (enable when ready) |
 * | EARN_ENABLED | true | Moments / Earn page + streak UI |
 * | MUSIC_PAID_ENABLED | false | Paid music library lane |
 * | PROFS_ENABLED | false | Professionals testimonials block |
 * | ULTRA_ENABLED | true | Show Ultra plan on pricing |
 * | RENDER_EXTRA_DERIVATIVES | false | story/tiktok/highlights |
 * | PIPELINE_ARTIFACTS | true | Persist stage artifacts |
 * | PIPELINE_PG_DUALWRITE | true | Mirror to Postgres |
 */

function boolEnv(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const v = raw.toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

export const SHARE_AUTO = boolEnv("SHARE_AUTO", false);
export const REFERRALS_ENABLED = boolEnv("REFERRALS_ENABLED", false);
export const EARN_ENABLED = boolEnv("EARN_ENABLED", true);
export const MUSIC_PAID_ENABLED = boolEnv("MUSIC_PAID_ENABLED", false);
export const MARKETING_EXPERIMENTS = boolEnv("MARKETING_EXPERIMENTS", false);
export const WAITLIST_ENABLED = boolEnv("WAITLIST_ENABLED", false);
export const PROFS_ENABLED = boolEnv("PROFS_ENABLED", false);
export const ULTRA_ENABLED = boolEnv("ULTRA_ENABLED", true);
export const RENDER_EXTRA_DERIVATIVES = boolEnv(
  "RENDER_EXTRA_DERIVATIVES",
  false
);
export const PIPELINE_ARTIFACTS = boolEnv("PIPELINE_ARTIFACTS", true);
export const PIPELINE_PG_DUALWRITE = boolEnv("PIPELINE_PG_DUALWRITE", true);

export const flags = {
  SHARE_AUTO,
  REFERRALS_ENABLED,
  EARN_ENABLED,
  MUSIC_PAID_ENABLED,
  MARKETING_EXPERIMENTS,
  WAITLIST_ENABLED,
  PROFS_ENABLED,
  ULTRA_ENABLED,
  RENDER_EXTRA_DERIVATIVES,
  PIPELINE_ARTIFACTS,
  PIPELINE_PG_DUALWRITE,
} as const;
