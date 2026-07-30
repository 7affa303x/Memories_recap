/**
 * Feature flags. Defaults keep launch-safe / pipeline-safe behavior.
 *
 * | Flag | Env | Default | Notes |
 * |------|-----|---------|-------|
 * | SHARE_AUTO | SHARE_AUTO | false | Auto public share on recap complete |
 * | REFERRALS_ENABLED | REFERRALS_ENABLED | false | Invite UI + referrals API |
 * | MUSIC_PAID_ENABLED | MUSIC_PAID_ENABLED | false | Paid music library lane |
 * | MARKETING_EXPERIMENTS | MARKETING_EXPERIMENTS | false | Soft marketing A/B |
 * | WAITLIST_ENABLED | WAITLIST_ENABLED | false | Waitlist forms |
 * | RENDER_EXTRA_DERIVATIVES | RENDER_EXTRA_DERIVATIVES | false | story/tiktok/highlights encodes |
 * | PIPELINE_ARTIFACTS | PIPELINE_ARTIFACTS | true | Persist stage artifacts under app-data |
 * | PIPELINE_PG_DUALWRITE | PIPELINE_PG_DUALWRITE | true | Mirror leases/artifacts/events to Postgres |
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
export const MUSIC_PAID_ENABLED = boolEnv("MUSIC_PAID_ENABLED", false);
export const MARKETING_EXPERIMENTS = boolEnv("MARKETING_EXPERIMENTS", false);
export const WAITLIST_ENABLED = boolEnv("WAITLIST_ENABLED", false);

/**
 * When false (default): only landscape + vertical (+ cheap 6s preview).
 * Extra story/tiktok/highlights encodes are the main timeout amplifiers.
 */
export const RENDER_EXTRA_DERIVATIVES = boolEnv(
  "RENDER_EXTRA_DERIVATIVES",
  false
);

/** Persist pipeline artifacts (probes, timeline, scores) for resume/debug. */
export const PIPELINE_ARTIFACTS = boolEnv("PIPELINE_ARTIFACTS", true);

/** Mirror pipeline control data into Postgres tables (soft dual-write). */
export const PIPELINE_PG_DUALWRITE = boolEnv("PIPELINE_PG_DUALWRITE", true);

export const flags = {
  SHARE_AUTO,
  REFERRALS_ENABLED,
  MUSIC_PAID_ENABLED,
  MARKETING_EXPERIMENTS,
  WAITLIST_ENABLED,
  RENDER_EXTRA_DERIVATIVES,
  PIPELINE_ARTIFACTS,
  PIPELINE_PG_DUALWRITE,
} as const;
